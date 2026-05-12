import { Prisma } from "@prisma/client";
import {
  DeliveryAssignmentStatus,
  DeliveryAvailabilityStatus,
  DeliveryOfferStatus,
  OrderStatus,
  Role,
} from "../../constants/enums.js";
import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { emitDeliveryLocationUpdate, emitOrderStatusUpdate } from "../../socket/index.js";
import { AppError } from "../../utils/app-error.js";
import { calculateDistanceKm } from "../../utils/geo.js";
import { calculateDeliveryIntelligence } from "../../utils/order-intelligence.js";
import {
  areIndianPhoneNumbersEqual,
  getIndianPhoneSearchVariants,
  normalizeIndianPhoneNumber,
} from "../../utils/phone.js";
import {
  normalizeLicenseNumber,
  normalizeVehicleNumber,
} from "../../utils/vehicle.js";
import { ensureDeliveryPartnerProfileByUserId } from "./delivery-partner-profile.js";
import { orderDispatchService } from "../orders/order-dispatch.service.js";
import {
  FALLBACK_ASSIGNMENT_RADIUS_KM,
  PRIMARY_ASSIGNMENT_RADIUS_KM,
} from "../../services/delivery-partner-availability.service.js";
import {
  PARTNER_NEARBY_RESTAURANT_RADIUS_KM,
  calculateRestaurantPickupDistanceKm,
  getCurrentDeliveryPartnerCoordinates,
  getNearbyRestaurantsForDeliveryPartner,
} from "../../services/delivery-partner-availability.service.js";
import { resolveRegionIdForAssignment } from "../regions/regions.service.js";

const ensureDeliveryPartnerUserUniqueness = async (input: {
  email?: string;
  phone?: string;
  excludeUserId?: number;
}) => {
  const normalizedEmail = input.email?.trim();
  const normalizedPhone = normalizeIndianPhoneNumber(input.phone);
  const uniqueConditions = [
    ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
    ...getIndianPhoneSearchVariants(normalizedPhone).map((phone) => ({ phone })),
  ];

  if (!uniqueConditions.length) {
    return;
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: uniqueConditions,
      ...(input.excludeUserId
        ? {
            NOT: {
              id: input.excludeUserId,
            },
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      phone: true,
    },
  });

  if (!existingUser) {
    return;
  }

  const conflictsWithEmail = normalizedEmail && existingUser.email === normalizedEmail;
  const conflictsWithPhone = normalizedPhone && areIndianPhoneNumbersEqual(existingUser.phone, normalizedPhone);

  throw new AppError(
    StatusCodes.CONFLICT,
    conflictsWithEmail
      ? "An account with this email already exists"
      : conflictsWithPhone
        ? "An account with this phone number already exists"
        : "An account with these details already exists",
    "ACCOUNT_ALREADY_EXISTS",
  );
};

const adminPartnerInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      profileImage: true,
      role: true,
      opsState: true,
      opsDistrict: true,
      opsNotes: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  },
  documents: true,
  _count: {
    select: {
      orders: true,
      documents: true,
    },
  },
} as const;

const deliveryOrderInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      phone: true,
    },
  },
  restaurant: {
    select: {
      id: true,
      ownerId: true,
      name: true,
      slug: true,
      coverImage: true,
      addressLine: true,
      area: true,
      city: true,
      state: true,
      pincode: true,
      latitude: true,
      longitude: true,
      avgDeliveryTime: true,
      preparationTime: true,
    },
  },
  address: {
    select: {
      id: true,
      title: true,
      houseNo: true,
      street: true,
      landmark: true,
      area: true,
      city: true,
      state: true,
      pincode: true,
      latitude: true,
      longitude: true,
    },
  },
  deliveryPartner: {
    select: {
      id: true,
      currentLatitude: true,
      currentLongitude: true,
      lastLocationUpdatedAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
    },
  },
  items: {
    select: {
      id: true,
      itemName: true,
      quantity: true,
      totalPrice: true,
    },
  },
  statusEvents: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      note: true,
      createdAt: true,
    },
  },
} as const;

const claimableDeliveryStatuses = [
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.LOOKING_FOR_DELIVERY_PARTNER,
] as const;
const terminalDeliveryStatuses = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
  OrderStatus.PAYMENT_FAILED,
] as const;

type DeliveryOrderRow = Prisma.OrderGetPayload<{ include: typeof deliveryOrderInclude }>;
type DeliveryOfferRow = Prisma.DeliveryAssignmentOfferGetPayload<{
  include: {
    order: {
      include: typeof deliveryOrderInclude;
    };
  };
}>;

const buildEstimatedMinutesFromDistance = (distanceKm?: number | null) => {
  if (distanceKm == null || !Number.isFinite(distanceKm)) {
    return null;
  }

  const averageSpeedKmPerHour = distanceKm > 8 ? 24 : 18;
  return Math.max(4, Math.round((distanceKm / averageSpeedKmPerHour) * 60));
};

const calculateRestaurantToCustomerDistanceKm = (
  order: Pick<
    DeliveryOrderRow,
    "restaurant" | "address"
  >,
) => {
  const distanceKm = calculateDistanceKm(
    order.restaurant.latitude,
    order.restaurant.longitude,
    order.address.latitude,
    order.address.longitude,
  );

  return Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(2)) : null;
};

const buildPartnerDeliveryRecord = (input: {
  order: DeliveryOrderRow;
  offer?: Pick<
    DeliveryOfferRow,
    | "id"
    | "batchNumber"
    | "radiusKm"
    | "distanceKm"
    | "offeredAt"
    | "expiresAt"
    | "status"
    | "respondedAt"
    | "acceptedAt"
    | "closedReason"
    | "deliveryPartnerId"
  > | null;
  partnerCoordinates?: {
    currentLatitude?: number | null;
    currentLongitude?: number | null;
  };
  partnerId: number;
  isCurrentDelivery: boolean;
}) => {
  const partnerToRestaurantDistanceKm =
    input.offer?.distanceKm ??
    calculateRestaurantPickupDistanceKm(input.order.restaurant, {
      currentLatitude:
        input.partnerCoordinates?.currentLatitude ??
        input.order.deliveryPartner?.currentLatitude,
      currentLongitude:
        input.partnerCoordinates?.currentLongitude ??
        input.order.deliveryPartner?.currentLongitude,
    });
  const restaurantToCustomerDistanceKm =
    calculateRestaurantToCustomerDistanceKm(input.order);
  const requestStatus =
    input.offer?.status ??
    (input.isCurrentDelivery
      ? DeliveryOfferStatus.ACCEPTED
      : DeliveryOfferStatus.CANCELLED);

  return {
    ...input.order,
    deliveryOffer: input.offer
      ? {
          id: input.offer.id,
          batchNumber: input.offer.batchNumber,
          radiusKm: input.offer.radiusKm,
          distanceKm: input.offer.distanceKm,
          offeredAt: input.offer.offeredAt,
          expiresAt: input.offer.expiresAt,
          status: input.offer.status,
        }
      : null,
    request: {
      id: input.offer?.id ?? null,
      orderId: input.order.id,
      restaurantId: input.order.restaurant.id,
      deliveryPartnerId: input.offer?.deliveryPartnerId ?? input.partnerId,
      status: requestStatus,
      requestedAt: input.offer?.offeredAt ?? input.order.assignedAt ?? input.order.orderedAt,
      respondedAt: input.offer?.respondedAt ?? input.offer?.acceptedAt ?? input.order.assignedAt ?? null,
      expiresAt: input.offer?.expiresAt ?? null,
      rejectionReason: input.offer?.closedReason ?? null,
      distanceKm: partnerToRestaurantDistanceKm,
      batchNumber: input.offer?.batchNumber ?? 1,
    },
    deliveryAssignmentStatus:
      input.order.deliveryAssignmentStatus ?? DeliveryAssignmentStatus.FINDING_PARTNER,
    restaurantDistanceKm: partnerToRestaurantDistanceKm,
    restaurantToCustomerDistanceKm,
    estimatedPickupMinutes: buildEstimatedMinutesFromDistance(
      partnerToRestaurantDistanceKm,
    ),
    estimatedDropoffMinutes: input.order.estimatedDeliveryMinutes ?? null,
    deliveryCoverageType:
      partnerToRestaurantDistanceKm == null
        ? null
        : partnerToRestaurantDistanceKm > PRIMARY_ASSIGNMENT_RADIUS_KM
          ? "FALLBACK"
          : "PRIMARY",
    isPendingRequest: requestStatus === DeliveryOfferStatus.PENDING,
    isCurrentDelivery: input.isCurrentDelivery,
    canAccept:
      requestStatus === DeliveryOfferStatus.PENDING &&
      input.order.deliveryPartnerId == null,
    canReject:
      requestStatus === DeliveryOfferStatus.PENDING &&
      input.order.deliveryPartnerId == null,
  };
};

const buildBoundingBox = (latitude: number, longitude: number, radiusKm: number) => {
  const latitudeDelta = radiusKm / 111;
  const longitudeDivisor = Math.max(Math.cos((latitude * Math.PI) / 180), 0.2);
  const longitudeDelta = radiusKm / (111 * longitudeDivisor);

  return {
    minLatitude: latitude - latitudeDelta,
    maxLatitude: latitude + latitudeDelta,
    minLongitude: longitude - longitudeDelta,
    maxLongitude: longitude + longitudeDelta,
  };
};

const parseTimeToMinutes = (value?: string | null) => {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return null;
  }

  const match = normalizedValue.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
};

const isRestaurantOpenNow = (
  openingTime?: string | null,
  closingTime?: string | null,
  now: Date = new Date(),
) => {
  const openingMinutes = parseTimeToMinutes(openingTime);
  const closingMinutes = parseTimeToMinutes(closingTime);

  if (openingMinutes == null || closingMinutes == null) {
    return null;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (openingMinutes === closingMinutes) {
    return true;
  }

  if (closingMinutes > openingMinutes) {
    return currentMinutes >= openingMinutes && currentMinutes <= closingMinutes;
  }

  return currentMinutes >= openingMinutes || currentMinutes <= closingMinutes;
};

const syncNearbyDispatchOrdersForPartner = async (partner: {
  currentLatitude?: number | null;
  currentLongitude?: number | null;
}) => {
  const partnerCoordinates = getCurrentDeliveryPartnerCoordinates(partner);
  if (!partnerCoordinates) {
    return;
  }

  const boundingBox = buildBoundingBox(
    partnerCoordinates.latitude,
    partnerCoordinates.longitude,
    FALLBACK_ASSIGNMENT_RADIUS_KM,
  );
  const candidateOrders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      deliveryPartnerId: null,
      status: {
        in: [...claimableDeliveryStatuses],
      },
      restaurant: {
        latitude: {
          not: null,
          gte: boundingBox.minLatitude,
          lte: boundingBox.maxLatitude,
        },
        longitude: {
          not: null,
          gte: boundingBox.minLongitude,
          lte: boundingBox.maxLongitude,
        },
      },
    },
    select: {
      id: true,
      restaurant: {
        select: {
          latitude: true,
          longitude: true,
        },
      },
    },
  });

  const nearbyOrderIds = candidateOrders
    .filter((order) => {
      const restaurantDistanceKm = calculateRestaurantPickupDistanceKm(order.restaurant, {
        currentLatitude: partnerCoordinates.latitude,
        currentLongitude: partnerCoordinates.longitude,
      });
      return (
        restaurantDistanceKm != null &&
        restaurantDistanceKm <= FALLBACK_ASSIGNMENT_RADIUS_KM
      );
    })
    .map((order) => order.id);

  if (!nearbyOrderIds.length) {
    return;
  }

  await Promise.all(
    [...new Set(nearbyOrderIds)].map((orderId) => orderDispatchService.syncOrder(orderId)),
  );
};

const getNearbyRestaurantsForPartner = async (partner: {
  currentLatitude?: number | null;
  currentLongitude?: number | null;
}) => {
  const restaurants = await getNearbyRestaurantsForDeliveryPartner(
    partner,
    PARTNER_NEARBY_RESTAURANT_RADIUS_KM,
  );

  return restaurants
    .map((restaurant) => {
      const isOpenNow = isRestaurantOpenNow(
        restaurant.openingTime,
        restaurant.closingTime,
      );

      return {
        id: restaurant.id,
        name: restaurant.name,
        area: restaurant.area,
        addressLine: restaurant.addressLine,
        city: restaurant.city,
        distanceKm: restaurant.distanceKm,
        isOpenNow,
        openingTime: restaurant.openingTime,
        closingTime: restaurant.closingTime,
      };
    })
    .filter(
      (
        restaurant,
      ): restaurant is {
        id: number;
        name: string;
        area: string | null;
        addressLine: string | null;
        city: string;
        distanceKm: number;
        isOpenNow: boolean | null;
        openingTime: string | null;
        closingTime: string | null;
      } => Boolean(restaurant),
    )
    .sort((left, right) => left.distanceKm - right.distanceKm);
};

const listPartnerDeliveryRecords = async (partner: {
  id: number;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
}) => {
  const now = new Date();
  const [pendingOffers, activeOrders] = await Promise.all([
    prisma.deliveryAssignmentOffer.findMany({
      where: {
        deliveryPartnerId: partner.id,
        status: DeliveryOfferStatus.PENDING,
        expiresAt: {
          gt: now,
        },
        order: {
          deletedAt: null,
          deliveryPartnerId: null,
          status: {
            in: [...claimableDeliveryStatuses],
          },
        },
      },
      include: {
        order: {
          include: deliveryOrderInclude,
        },
      },
      orderBy: [{ distanceKm: "asc" }, { offeredAt: "desc" }],
    }),
    prisma.order.findMany({
      where: {
        deliveryPartnerId: partner.id,
        deletedAt: null,
        status: {
          notIn: [...terminalDeliveryStatuses],
        },
      },
      include: deliveryOrderInclude,
      orderBy: [{ assignedAt: "desc" }, { orderedAt: "desc" }],
    }),
  ]);

  const acceptedOffers = activeOrders.length
    ? await prisma.deliveryAssignmentOffer.findMany({
        where: {
          deliveryPartnerId: partner.id,
          orderId: {
            in: activeOrders.map((order) => order.id),
          },
          status: DeliveryOfferStatus.ACCEPTED,
        },
        select: {
          id: true,
          orderId: true,
          deliveryPartnerId: true,
          batchNumber: true,
          radiusKm: true,
          distanceKm: true,
          offeredAt: true,
          expiresAt: true,
          respondedAt: true,
          acceptedAt: true,
          closedReason: true,
          status: true,
        },
        orderBy: [{ acceptedAt: "desc" }, { createdAt: "desc" }],
      })
    : [];

  const acceptedOfferByOrderId = new Map<number, (typeof acceptedOffers)[number]>();
  acceptedOffers.forEach((offer) => {
    if (!acceptedOfferByOrderId.has(offer.orderId)) {
      acceptedOfferByOrderId.set(offer.orderId, offer);
    }
  });

  const pendingRecords = pendingOffers.map((offer) =>
    buildPartnerDeliveryRecord({
      order: offer.order,
      offer,
      partnerCoordinates: partner,
      partnerId: partner.id,
      isCurrentDelivery: false,
    }),
  );
  const activeRecords = activeOrders.map((order) =>
    buildPartnerDeliveryRecord({
      order,
      offer: acceptedOfferByOrderId.get(order.id) ?? null,
      partnerCoordinates: partner,
      partnerId: partner.id,
      isCurrentDelivery: true,
    }),
  );

  return {
    pendingRequests: pendingRecords,
    activeDeliveries: activeRecords,
    deliveries: [...pendingRecords, ...activeRecords],
  };
};

const getPartnerDeliveryRecordByOrderId = async (
  partner: {
    id: number;
    currentLatitude?: number | null;
    currentLongitude?: number | null;
  },
  orderId: number,
) => {
  const [activeOrder, acceptedOffer, latestOffer] = await Promise.all([
    prisma.order.findFirst({
      where: {
        id: orderId,
        deletedAt: null,
        deliveryPartnerId: partner.id,
      },
      include: deliveryOrderInclude,
    }),
    prisma.deliveryAssignmentOffer.findFirst({
      where: {
        orderId,
        deliveryPartnerId: partner.id,
        status: DeliveryOfferStatus.ACCEPTED,
      },
      select: {
        id: true,
        orderId: true,
        deliveryPartnerId: true,
        batchNumber: true,
        radiusKm: true,
        distanceKm: true,
        offeredAt: true,
        expiresAt: true,
        respondedAt: true,
        acceptedAt: true,
        closedReason: true,
        status: true,
      },
      orderBy: [{ acceptedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.deliveryAssignmentOffer.findFirst({
      where: {
        orderId,
        deliveryPartnerId: partner.id,
      },
      include: {
        order: {
          include: deliveryOrderInclude,
        },
      },
      orderBy: [{ createdAt: "desc" }, { offeredAt: "desc" }],
    }),
  ]);

  if (activeOrder) {
    return buildPartnerDeliveryRecord({
      order: activeOrder,
      offer: acceptedOffer,
      partnerCoordinates: partner,
      partnerId: partner.id,
      isCurrentDelivery: true,
    });
  }

  if (!latestOffer) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      "Delivery request not found",
      "DELIVERY_REQUEST_NOT_FOUND",
    );
  }

  return buildPartnerDeliveryRecord({
    order: latestOffer.order,
    offer: latestOffer,
    partnerCoordinates: partner,
    partnerId: partner.id,
    isCurrentDelivery: false,
  });
};

export const deliveryPartnersService = {
  async listAll(filters?: { search?: string; availabilityStatus?: string; isVerified?: boolean }) {
    const search = filters?.search?.trim();

    return prisma.deliveryPartner.findMany({
      where: {
        ...(filters?.availabilityStatus ? { availabilityStatus: filters.availabilityStatus } : {}),
        ...(filters?.isVerified !== undefined ? { isVerified: filters.isVerified } : {}),
        ...(search
          ? {
              OR: [
                { vehicleNumber: { contains: search } },
                { licenseNumber: { contains: search } },
                {
                  user: {
                    OR: [
                      { fullName: { contains: search } },
                      { email: { contains: search } },
                      { phone: { contains: search } },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      include: adminPartnerInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  async createByAdmin(input: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    profileImage?: string;
    vehicleType: string;
    vehicleNumber?: string;
    licenseNumber?: string;
    availabilityStatus?: string;
    isVerified?: boolean;
    opsState?: string;
    opsDistrict?: string;
    opsNotes?: string;
  }) {
    const email = input.email.trim().toLowerCase();
    const phone = normalizeIndianPhoneNumber(input.phone);
    const vehicleNumber = normalizeVehicleNumber(input.vehicleNumber);
    const licenseNumber = normalizeLicenseNumber(input.licenseNumber);

    await ensureDeliveryPartnerUserUniqueness({
      email,
      phone,
    });

    const passwordHash = await bcrypt.hash(input.password, 12);
    const region = await resolveRegionIdForAssignment(prisma, input.opsState, input.opsDistrict);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: input.fullName,
          email,
          phone,
          passwordHash,
          profileImage: input.profileImage,
          role: Role.DELIVERY_PARTNER,
          regionId: region?.id ?? null,
          opsState: input.opsState?.trim() || null,
          opsDistrict: input.opsDistrict?.trim() || null,
          opsNotes: input.opsNotes?.trim() || null,
          isActive: true,
        },
      });

      return tx.deliveryPartner.create({
        data: {
          userId: user.id,
          vehicleType: input.vehicleType,
          vehicleNumber,
          licenseNumber,
          availabilityStatus: input.availabilityStatus ?? DeliveryAvailabilityStatus.OFFLINE,
          isVerified: input.isVerified ?? false,
        },
        include: adminPartnerInclude,
      });
    });

    return created;
  },

  async updateByAdmin(
    partnerId: number,
    input: {
      fullName?: string;
      email?: string;
      phone?: string;
      password?: string;
      profileImage?: string;
      vehicleType?: string;
      vehicleNumber?: string;
      licenseNumber?: string;
      availabilityStatus?: string;
      isVerified?: boolean;
    },
  ) {
    const partner = await prisma.deliveryPartner.findUnique({
      where: { id: partnerId },
      select: { id: true, userId: true },
    });

    if (!partner) {
      throw new AppError(StatusCodes.NOT_FOUND, "Delivery partner not found", "DELIVERY_PARTNER_NOT_FOUND");
    }

    const email = input.email?.trim().toLowerCase();
    const phone =
      input.phone !== undefined ? normalizeIndianPhoneNumber(input.phone) : undefined;
    const vehicleNumber =
      input.vehicleNumber !== undefined ? normalizeVehicleNumber(input.vehicleNumber) : undefined;
    const licenseNumber =
      input.licenseNumber !== undefined ? normalizeLicenseNumber(input.licenseNumber) : undefined;

    await ensureDeliveryPartnerUserUniqueness({
      email,
      phone,
      excludeUserId: partner.userId,
    });

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: partner.userId },
        data: {
          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          ...(input.email !== undefined ? { email } : {}),
          ...(input.phone !== undefined ? { phone } : {}),
          ...(input.password !== undefined ? { passwordHash: await bcrypt.hash(input.password, 12) } : {}),
          ...(input.profileImage !== undefined ? { profileImage: input.profileImage } : {}),
        },
      });

      await tx.deliveryPartner.update({
        where: { id: partnerId },
        data: {
          ...(input.vehicleType !== undefined ? { vehicleType: input.vehicleType } : {}),
          ...(input.vehicleNumber !== undefined ? { vehicleNumber } : {}),
          ...(input.licenseNumber !== undefined ? { licenseNumber } : {}),
          ...(input.availabilityStatus !== undefined
            ? { availabilityStatus: input.availabilityStatus }
            : {}),
          ...(input.isVerified !== undefined ? { isVerified: input.isVerified } : {}),
        },
      });
    });

    return prisma.deliveryPartner.findUnique({
      where: { id: partnerId },
      include: adminPartnerInclude,
    });
  },

  async archiveByAdmin(partnerId: number) {
    const partner = await prisma.deliveryPartner.findUnique({
      where: { id: partnerId },
      select: { id: true, userId: true },
    });

    if (!partner) {
      throw new AppError(StatusCodes.NOT_FOUND, "Delivery partner not found", "DELIVERY_PARTNER_NOT_FOUND");
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: partner.userId },
        data: {
          isActive: false,
        },
      });

      await tx.deliveryPartner.update({
        where: { id: partnerId },
        data: {
          availabilityStatus: DeliveryAvailabilityStatus.OFFLINE,
        },
      });
    });

    return prisma.deliveryPartner.findUnique({
      where: { id: partnerId },
      include: adminPartnerInclude,
    });
  },

  async getProfile(userId: number) {
    return ensureDeliveryPartnerProfileByUserId(userId);
  },

  async updateProfile(
    userId: number,
    input: {
      fullName?: string;
      phone?: string;
      vehicleNumber?: string;
      licenseNumber?: string;
    },
  ) {
    const { profile: partner } = await ensureDeliveryPartnerProfileByUserId(userId);
    const phone =
      input.phone !== undefined ? normalizeIndianPhoneNumber(input.phone) : undefined;
    const vehicleNumber =
      input.vehicleNumber !== undefined ? normalizeVehicleNumber(input.vehicleNumber) : undefined;
    const licenseNumber =
      input.licenseNumber !== undefined ? normalizeLicenseNumber(input.licenseNumber) : undefined;

    await ensureDeliveryPartnerUserUniqueness({
      phone,
      excludeUserId: partner.userId,
    });

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: partner.userId },
        data: {
          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          ...(input.phone !== undefined ? { phone } : {}),
        },
      });

      await tx.deliveryPartner.update({
        where: { id: partner.id },
        data: {
          ...(input.vehicleNumber !== undefined ? { vehicleNumber } : {}),
          ...(input.licenseNumber !== undefined ? { licenseNumber } : {}),
        },
      });
    });

    return (await ensureDeliveryPartnerProfileByUserId(userId)).profile;
  },

  async updateAvailability(userId: number, availabilityStatus: string) {
    const { profile: partner } = await ensureDeliveryPartnerProfileByUserId(userId);
    const updatedPartner = await prisma.deliveryPartner.update({
      where: { id: partner.id },
      data: {
        availabilityStatus: availabilityStatus as never,
      },
      include: {
        user: true,
        documents: true,
      },
    });

    if (availabilityStatus !== DeliveryAvailabilityStatus.ONLINE) {
      const pendingOffers = await prisma.deliveryAssignmentOffer.findMany({
        where: {
          deliveryPartnerId: partner.id,
          status: DeliveryOfferStatus.PENDING,
        },
        select: {
          orderId: true,
        },
      });

      if (pendingOffers.length) {
        await prisma.deliveryAssignmentOffer.updateMany({
          where: {
            deliveryPartnerId: partner.id,
            status: DeliveryOfferStatus.PENDING,
          },
          data: {
            status: DeliveryOfferStatus.CANCELLED,
            respondedAt: new Date(),
            closedReason: "PARTNER_UNAVAILABLE",
          },
        });

        const orderIds = [...new Set(pendingOffers.map((offer) => offer.orderId))];
        await Promise.all(orderIds.map((orderId) => orderDispatchService.syncOrder(orderId)));
      }
    }

    if (availabilityStatus === DeliveryAvailabilityStatus.ONLINE) {
      await syncNearbyDispatchOrdersForPartner(updatedPartner);
    }

    return updatedPartner;
  },

  async updateLocation(userId: number, latitude: number, longitude: number) {
    const { profile: partner } = await ensureDeliveryPartnerProfileByUserId(userId);

    const updatedPartner = await prisma.deliveryPartner.update({
      where: { id: partner.id },
      data: {
        currentLatitude: latitude,
        currentLongitude: longitude,
        lastLocationUpdatedAt: new Date(),
      },
      include: {
        user: true,
        documents: true,
      },
    });

    const activeOrders = await prisma.order.findMany({
      where: {
        deliveryPartnerId: partner.id,
        deletedAt: null,
        status: {
          in: [
            OrderStatus.DELIVERY_PARTNER_ASSIGNED,
            OrderStatus.PICKED_UP,
            OrderStatus.ON_THE_WAY,
            OrderStatus.OUT_FOR_DELIVERY,
            OrderStatus.DELAYED,
          ],
        },
      },
      include: {
        restaurant: {
          select: {
            id: true,
            ownerId: true,
            latitude: true,
            longitude: true,
            preparationTime: true,
            avgDeliveryTime: true,
          },
        },
        address: {
          select: {
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    await Promise.all(
      activeOrders.map(async (order) => {
        const intelligence = await calculateDeliveryIntelligence({
          status: order.status,
          restaurant: order.restaurant,
          address: order.address,
          deliveryPartner: {
            currentLatitude: latitude,
            currentLongitude: longitude,
          },
        });

        await prisma.order.update({
          where: { id: order.id },
          data: {
            routeDistanceKm: intelligence.routeDistanceKm,
            travelDurationMinutes: intelligence.travelDurationMinutes,
            estimatedDeliveryMinutes: intelligence.estimatedDeliveryMinutes,
            trafficDelayMinutes: intelligence.trafficDelayMinutes,
            weatherDelayMinutes: intelligence.weatherDelayMinutes,
            delayMinutes: intelligence.delayMinutes,
          },
        });
      }),
    );

    activeOrders.forEach((order) => {
      emitDeliveryLocationUpdate({
        orderId: order.id,
        latitude,
        longitude,
        userId: order.userId,
        ownerId: order.restaurant.ownerId,
        deliveryPartnerUserId: partner.userId,
        restaurantId: order.restaurant.id,
        deliveryPartnerId: partner.id,
      });

      emitOrderStatusUpdate({
        orderId: order.id,
        userId: order.userId,
        ownerId: order.restaurant.ownerId,
        deliveryPartnerUserId: partner.userId,
        restaurantId: order.restaurant.id,
        deliveryPartnerId: partner.id,
        status: "LOCATION_UPDATED",
        note: "Delivery partner location refreshed.",
      });
    });

    await syncNearbyDispatchOrdersForPartner(updatedPartner);

    return updatedPartner;
  },

  async listNearbyRestaurants(userId: number) {
    const { profile: partner } = await ensureDeliveryPartnerProfileByUserId(userId);
    return getNearbyRestaurantsForPartner(partner);
  },

  async listNewRequests(user: { id: number; role: Role }) {
    if (user.role === Role.DELIVERY_PARTNER) {
      const { profile: partner } = await ensureDeliveryPartnerProfileByUserId(user.id);
      await syncNearbyDispatchOrdersForPartner(partner);
      return (await listPartnerDeliveryRecords(partner)).pendingRequests;
    }

    return orderDispatchService.listOpenOffersForUser(user);
  },

  async listDeliveries(userId: number) {
    const { profile: partner } = await ensureDeliveryPartnerProfileByUserId(userId);
    return listPartnerDeliveryRecords(partner);
  },

  async getDeliveryByOrderId(userId: number, orderId: number) {
    const { profile: partner } = await ensureDeliveryPartnerProfileByUserId(userId);
    return getPartnerDeliveryRecordByOrderId(partner, orderId);
  },

  async declineRequest(userId: number, orderId: number, rejectionReason?: string) {
    await orderDispatchService.declineOffer(userId, orderId, rejectionReason);
  },

  async releaseAssignedOrder(userId: number, orderId: number, note?: string) {
    return orderDispatchService.releaseAssignedOrder(userId, orderId, note);
  },

  async listActiveDeliveries(userId: number) {
    const { profile: partner } = await ensureDeliveryPartnerProfileByUserId(userId);
    return (await listPartnerDeliveryRecords(partner)).activeDeliveries;
  },

  async listHistory(userId: number) {
    await ensureDeliveryPartnerProfileByUserId(userId);

    return prisma.order.findMany({
      where: {
        deliveryPartner: {
          userId,
        },
        deletedAt: null,
        status: {
          in: [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED],
        },
      },
      include: deliveryOrderInclude,
      orderBy: { orderedAt: "desc" },
    });
  },
};
