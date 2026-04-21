import {
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
import { calculateDeliveryIntelligence } from "../../utils/order-intelligence.js";
import { orderDispatchService } from "../orders/order-dispatch.service.js";
import { resolveRegionIdForAssignment } from "../regions/regions.service.js";

const getPartnerByUserId = async (userId: number) => {
  const partner = await prisma.deliveryPartner.findUnique({
    where: { userId },
    include: {
      user: true,
      documents: true,
    },
  });

  if (!partner) {
    throw new AppError(StatusCodes.NOT_FOUND, "Delivery profile not found", "DELIVERY_PROFILE_NOT_FOUND");
  }

  return partner;
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
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: input.email }, ...(input.phone ? [{ phone: input.phone }] : [])],
      },
      select: { id: true },
    });

    if (existingUser) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "An account with these details already exists",
        "ACCOUNT_ALREADY_EXISTS",
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const region = await resolveRegionIdForAssignment(prisma, input.opsState, input.opsDistrict);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
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
          vehicleNumber: input.vehicleNumber,
          licenseNumber: input.licenseNumber,
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

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: partner.userId },
        data: {
          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.password !== undefined ? { passwordHash: await bcrypt.hash(input.password, 12) } : {}),
          ...(input.profileImage !== undefined ? { profileImage: input.profileImage } : {}),
        },
      });

      await tx.deliveryPartner.update({
        where: { id: partnerId },
        data: {
          ...(input.vehicleType !== undefined ? { vehicleType: input.vehicleType } : {}),
          ...(input.vehicleNumber !== undefined ? { vehicleNumber: input.vehicleNumber } : {}),
          ...(input.licenseNumber !== undefined ? { licenseNumber: input.licenseNumber } : {}),
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
    return getPartnerByUserId(userId);
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
    const partner = await getPartnerByUserId(userId);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: partner.userId },
        data: {
          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
        },
      });

      await tx.deliveryPartner.update({
        where: { id: partner.id },
        data: {
          ...(input.vehicleNumber !== undefined ? { vehicleNumber: input.vehicleNumber } : {}),
          ...(input.licenseNumber !== undefined ? { licenseNumber: input.licenseNumber } : {}),
        },
      });
    });

    return getPartnerByUserId(userId);
  },

  async updateAvailability(userId: number, availabilityStatus: string) {
    const partner = await getPartnerByUserId(userId);
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

    return updatedPartner;
  },

  async updateLocation(userId: number, latitude: number, longitude: number) {
    const partner = await getPartnerByUserId(userId);

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
      });

      emitOrderStatusUpdate({
        orderId: order.id,
        userId: order.userId,
        ownerId: order.restaurant.ownerId,
        deliveryPartnerUserId: partner.userId,
        status: "LOCATION_UPDATED",
        note: "Delivery partner location refreshed.",
      });
    });

    return updatedPartner;
  },

  async listNewRequests(user: { id: number; role: Role }) {
    return orderDispatchService.listOpenOffersForUser(user);
  },

  async declineRequest(userId: number, orderId: number) {
    await orderDispatchService.declineOffer(userId, orderId);
  },

  async releaseAssignedOrder(userId: number, orderId: number, note?: string) {
    return orderDispatchService.releaseAssignedOrder(userId, orderId, note);
  },

  async listActiveDeliveries(userId: number) {
    return prisma.order.findMany({
      where: {
        deliveryPartner: {
          userId,
        },
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
      include: deliveryOrderInclude,
      orderBy: { orderedAt: "desc" },
    });
  },

  async listHistory(userId: number) {
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
