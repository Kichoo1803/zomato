import { Prisma } from "@prisma/client";
import {
  DeliveryAvailabilityStatus,
  DeliveryOfferStatus,
  NotificationType,
  OrderStatus,
  Role,
} from "../../constants/enums.js";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import {
  emitDispatchQueueUpdate,
  emitNotification,
  emitOrderStatusUpdate,
} from "../../socket/index.js";
import { AppError } from "../../utils/app-error.js";
import { hasCoordinates, haversineDistanceKm } from "../../utils/geo.js";

const deliveryOfferOrderInclude = {
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
      userId: true,
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
} satisfies Prisma.OrderInclude;

const dispatchOrderSelect = {
  id: true,
  userId: true,
  addressId: true,
  deliveryPartnerId: true,
  orderNumber: true,
  status: true,
  paymentMethod: true,
  totalAmount: true,
  tipAmount: true,
  routeDistanceKm: true,
  estimatedDeliveryMinutes: true,
  specialInstructions: true,
  orderedAt: true,
  readyForPickupAt: true,
  assignedAt: true,
  restaurant: {
    select: {
      id: true,
      ownerId: true,
      name: true,
      addressLine: true,
      area: true,
      city: true,
      state: true,
      pincode: true,
      latitude: true,
      longitude: true,
    },
  },
  address: {
    select: {
      id: true,
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
  user: {
    select: {
      fullName: true,
    },
  },
  items: {
    select: {
      itemName: true,
      quantity: true,
    },
  },
} satisfies Prisma.OrderSelect;

type DispatchOrder = Prisma.OrderGetPayload<{ select: typeof dispatchOrderSelect }>;
type DeliveryOfferOrder = Prisma.OrderGetPayload<{ include: typeof deliveryOfferOrderInclude }>;

const openDeliveryOfferStatuses = [DeliveryOfferStatus.PENDING] as const;
const claimableOrderStatuses = [
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.LOOKING_FOR_DELIVERY_PARTNER,
] as const;
const activeDeliveryStatuses = [
  OrderStatus.DELIVERY_PARTNER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.ON_THE_WAY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELAYED,
] as const;
const terminalOrderStatuses = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
  OrderStatus.PAYMENT_FAILED,
] as const;

const getDispatchRadiiKm = () => {
  const values = env.DELIVERY_ASSIGNMENT_RADII_KM
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  return values.length ? [...new Set(values)] : [2, 3, 5];
};

const dispatchConfig = {
  radiiKm: getDispatchRadiiKm(),
  offerTtlSeconds: env.DELIVERY_ASSIGNMENT_OFFER_TTL_SECONDS,
  staleLocationMinutes: env.DELIVERY_ASSIGNMENT_STALE_LOCATION_MINUTES,
  maxActiveOrders: env.DELIVERY_ASSIGNMENT_MAX_ACTIVE_ORDERS,
  maxBroadcastPartners: env.DELIVERY_ASSIGNMENT_MAX_BROADCAST_PARTNERS,
  reassignTimeoutMinutes: env.DELIVERY_ASSIGNMENT_REASSIGN_TIMEOUT_MINUTES,
};

const normalizeLocationValue = (value?: string | null) =>
  value
    ?.trim()
    .toLowerCase()
    .replace(/district|urban|rural/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim() ?? "";

const tokenizeLocation = (value?: string | null) =>
  normalizeLocationValue(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

const matchesServiceZone = (
  partner: {
    user: {
      opsState?: string | null;
      opsDistrict?: string | null;
    };
  },
  restaurant: {
    state?: string | null;
    city?: string | null;
    area?: string | null;
    pincode?: string | null;
  },
) => {
  const partnerState = normalizeLocationValue(partner.user.opsState);
  const restaurantState = normalizeLocationValue(restaurant.state);

  if (partnerState && restaurantState && partnerState !== restaurantState) {
    return false;
  }

  const districtTokens = tokenizeLocation(partner.user.opsDistrict);
  if (!districtTokens.length) {
    return true;
  }

  const restaurantTokens = [
    ...tokenizeLocation(restaurant.city),
    ...tokenizeLocation(restaurant.area),
    ...tokenizeLocation(restaurant.pincode),
  ];

  return districtTokens.some((token) => restaurantTokens.includes(token));
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

const buildAddressSummary = (parts: Array<string | null | undefined>) =>
  parts
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(", ");

const buildItemsSummary = (items: DispatchOrder["items"]) =>
  items
    .slice(0, 3)
    .map((item) => `${item.quantity}x ${item.itemName}`)
    .join(", ");

const buildDispatchMeta = (
  order: DispatchOrder,
  payload: {
    eventKey: string;
    status?: string;
    offer?: {
      radiusKm: number;
      distanceKm: number | null;
      expiresAt: Date;
      batchNumber: number;
    };
  },
) =>
  JSON.stringify({
    eventKey: payload.eventKey,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: payload.status ?? order.status,
    customerName: order.user.fullName,
    restaurantName: order.restaurant.name,
    itemsSummary: buildItemsSummary(order.items),
    addressSummary: buildAddressSummary([
      order.address.houseNo,
      order.address.street,
      order.address.area,
      order.address.city,
    ]),
    pickupSummary: buildAddressSummary([
      order.restaurant.addressLine,
      order.restaurant.area,
      order.restaurant.city,
    ]),
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod,
    estimatedDeliveryMinutes: order.estimatedDeliveryMinutes,
    routeDistanceKm: order.routeDistanceKm,
    specialInstructions: order.specialInstructions ?? null,
    deliveryOffer: payload.offer
      ? {
          radiusKm: payload.offer.radiusKm,
          distanceKm: payload.offer.distanceKm,
          expiresAt: payload.offer.expiresAt.toISOString(),
          batchNumber: payload.offer.batchNumber,
        }
      : null,
  });

const createDispatchNotification = async (
  userId: number,
  title: string,
  message: string,
  meta: string,
  realtimeTarget?: {
    restaurantId?: number | null;
    deliveryPartnerId?: number | null;
  },
) => {
  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type: NotificationType.ORDER,
      meta,
    },
  });

  // Keep persisted notifications as the REST fallback, then fan them out live over Socket.IO.
  emitNotification({
    userId,
    restaurantId: realtimeTarget?.restaurantId,
    deliveryPartnerId: realtimeTarget?.deliveryPartnerId,
    notification,
  });
};

const getNextRadiusSequence = (lastRadiusKm?: number | null) => {
  if (lastRadiusKm == null) {
    return dispatchConfig.radiiKm;
  }

  const nextIndex = dispatchConfig.radiiKm.findIndex((value) => value > lastRadiusKm + 0.001);
  return nextIndex === -1
    ? [dispatchConfig.radiiKm[dispatchConfig.radiiKm.length - 1]]
    : dispatchConfig.radiiKm.slice(nextIndex);
};

const getActiveOrderCountMap = async (partnerIds: number[]) => {
  if (!partnerIds.length) {
    return new Map<number, number>();
  }

  const groupedOrders = await prisma.order.groupBy({
    by: ["deliveryPartnerId"],
    where: {
      deletedAt: null,
      deliveryPartnerId: {
        in: partnerIds,
      },
      status: {
        in: [...activeDeliveryStatuses],
      },
    },
    _count: {
      _all: true,
    },
  });

  return new Map(
    groupedOrders
      .filter((entry) => entry.deliveryPartnerId != null)
      .map((entry) => [entry.deliveryPartnerId as number, entry._count._all]),
  );
};

const getLatestOfferBatch = async (orderId: number) =>
  prisma.deliveryAssignmentOffer.findFirst({
    where: { orderId },
    orderBy: [{ batchNumber: "desc" }, { createdAt: "desc" }],
    select: {
      batchNumber: true,
      radiusKm: true,
    },
  });

const closePendingOffersForOrder = async (
  orderId: number,
  payload: {
    status: DeliveryOfferStatus;
    closedReason: string;
    excludeOfferId?: number;
  },
) => {
  const now = new Date();
  const offers = await prisma.deliveryAssignmentOffer.findMany({
    where: {
      orderId,
      status: {
        in: [...openDeliveryOfferStatuses],
      },
      ...(payload.excludeOfferId ? { id: { not: payload.excludeOfferId } } : {}),
    },
    select: {
      id: true,
      deliveryPartner: {
        select: {
          id: true,
          userId: true,
        },
      },
    },
  });

  if (!offers.length) {
    return 0;
  }

  await prisma.deliveryAssignmentOffer.updateMany({
    where: {
      id: {
        in: offers.map((offer) => offer.id),
      },
    },
    data: {
      status: payload.status,
      respondedAt: now,
      closedReason: payload.closedReason,
    },
  });

  emitDispatchQueueUpdate({
    orderId,
    state: payload.status,
    userIds: offers.map((offer) => offer.deliveryPartner.userId),
    deliveryPartnerIds: offers.map((offer) => offer.deliveryPartner.id),
  });

  return offers.length;
};

const getDispatchOrderById = async (orderId: number) =>
  prisma.order.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
    },
    select: dispatchOrderSelect,
  });

const getEligiblePartnersForRadius = async (
  order: DispatchOrder,
  radiusKm: number,
) => {
  const staleLocationCutoff = new Date(
    Date.now() - dispatchConfig.staleLocationMinutes * 60 * 1000,
  );
  const restaurantHasCoordinates = hasCoordinates(order.restaurant);
  const boundingBox = restaurantHasCoordinates
    ? buildBoundingBox(
        order.restaurant.latitude as number,
        order.restaurant.longitude as number,
        radiusKm,
      )
    : null;

  const candidates = await prisma.deliveryPartner.findMany({
    where: {
      availabilityStatus: DeliveryAvailabilityStatus.ONLINE,
      isVerified: true,
      currentLatitude: restaurantHasCoordinates
        ? {
            gte: boundingBox!.minLatitude,
            lte: boundingBox!.maxLatitude,
          }
        : { not: null },
      currentLongitude: restaurantHasCoordinates
        ? {
            gte: boundingBox!.minLongitude,
            lte: boundingBox!.maxLongitude,
          }
        : { not: null },
      lastLocationUpdatedAt: {
        gte: staleLocationCutoff,
      },
      user: {
        isActive: true,
        ...(order.restaurant.state
          ? {
              OR: [
                { opsState: null },
                { opsState: order.restaurant.state },
              ],
            }
          : {}),
      },
    },
    select: {
      id: true,
      userId: true,
      currentLatitude: true,
      currentLongitude: true,
      lastLocationUpdatedAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          isActive: true,
          opsState: true,
          opsDistrict: true,
        },
      },
    },
    orderBy: [{ lastLocationUpdatedAt: "desc" }, { updatedAt: "desc" }],
    take: dispatchConfig.maxBroadcastPartners * 4,
  });

  const activeOrderCountMap = await getActiveOrderCountMap(candidates.map((partner) => partner.id));

  return candidates
    .map((partner) => {
      const partnerHasCoordinates = hasCoordinates({
        latitude: partner.currentLatitude,
        longitude: partner.currentLongitude,
      });
      const distanceKm =
        restaurantHasCoordinates && partnerHasCoordinates
          ? Number(
              haversineDistanceKm(
                {
                  latitude: partner.currentLatitude as number,
                  longitude: partner.currentLongitude as number,
                },
                {
                  latitude: order.restaurant.latitude as number,
                  longitude: order.restaurant.longitude as number,
                },
              ).toFixed(2),
            )
          : null;

      return {
        ...partner,
        activeOrderCount: activeOrderCountMap.get(partner.id) ?? 0,
        distanceKm,
      };
    })
    .filter((partner) => {
      if (!matchesServiceZone(partner, order.restaurant)) {
        return false;
      }

      if (partner.activeOrderCount >= dispatchConfig.maxActiveOrders) {
        return false;
      }

      if (restaurantHasCoordinates && partner.distanceKm != null) {
        return partner.distanceKm <= radiusKm;
      }

      return true;
    })
    .sort((left, right) => {
      const leftDistance = left.distanceKm ?? Number.MAX_SAFE_INTEGER;
      const rightDistance = right.distanceKm ?? Number.MAX_SAFE_INTEGER;

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return left.activeOrderCount - right.activeOrderCount;
    })
    .slice(0, dispatchConfig.maxBroadcastPartners);
};

const syncOrderDispatch = async (orderId: number) => {
  const order = await getDispatchOrderById(orderId);

  if (!order) {
    return {
      orderId,
      offersCreated: 0,
      radiusKm: null as number | null,
      rebroadcasted: false,
    };
  }

  if (
    order.deliveryPartnerId ||
    (terminalOrderStatuses as readonly OrderStatus[]).includes(order.status as OrderStatus)
  ) {
    await closePendingOffersForOrder(orderId, {
      status: DeliveryOfferStatus.CANCELLED,
      closedReason: order.deliveryPartnerId
        ? "ORDER_ASSIGNED"
        : `ORDER_${order.status}`,
    });

    return {
      orderId,
      offersCreated: 0,
      radiusKm: null as number | null,
      rebroadcasted: false,
    };
  }

  if (!(claimableOrderStatuses as readonly OrderStatus[]).includes(order.status as OrderStatus)) {
    return {
      orderId,
      offersCreated: 0,
      radiusKm: null as number | null,
      rebroadcasted: false,
    };
  }

  const now = new Date();
  const expiredOffers = await prisma.deliveryAssignmentOffer.findMany({
    where: {
      orderId,
      status: {
        in: [...openDeliveryOfferStatuses],
      },
      expiresAt: {
        lte: now,
      },
    },
    select: {
      id: true,
      deliveryPartner: {
        select: {
          id: true,
          userId: true,
        },
      },
    },
  });

  if (expiredOffers.length) {
    await prisma.deliveryAssignmentOffer.updateMany({
      where: {
        id: {
          in: expiredOffers.map((offer) => offer.id),
        },
      },
      data: {
        status: DeliveryOfferStatus.EXPIRED,
        respondedAt: now,
        closedReason: "OFFER_TIMEOUT",
      },
    });

    emitDispatchQueueUpdate({
      orderId,
      state: DeliveryOfferStatus.EXPIRED,
      userIds: expiredOffers.map((offer) => offer.deliveryPartner.userId),
      deliveryPartnerIds: expiredOffers.map((offer) => offer.deliveryPartner.id),
    });
  }

  const activeOfferCount = await prisma.deliveryAssignmentOffer.count({
    where: {
      orderId,
      status: {
        in: [...openDeliveryOfferStatuses],
      },
      expiresAt: {
        gt: now,
      },
    },
  });

  if (activeOfferCount > 0) {
    return {
      orderId,
      offersCreated: 0,
      radiusKm: null as number | null,
      rebroadcasted: expiredOffers.length > 0,
    };
  }

  const latestBatch = await getLatestOfferBatch(orderId);
  const nextRadii = getNextRadiusSequence(latestBatch?.radiusKm);

  for (const radiusKm of nextRadii) {
    const partners = await getEligiblePartnersForRadius(order, radiusKm);

    if (!partners.length) {
      continue;
    }

    const batchNumber = (latestBatch?.batchNumber ?? 0) + 1;
    const expiresAt = new Date(now.getTime() + dispatchConfig.offerTtlSeconds * 1000);

    await prisma.deliveryAssignmentOffer.createMany({
      data: partners.map((partner) => ({
        orderId,
        deliveryPartnerId: partner.id,
        batchNumber,
        status: DeliveryOfferStatus.PENDING,
        radiusKm,
        distanceKm: partner.distanceKm,
        expiresAt,
      })),
    });

    await Promise.all(
      partners.map((partner) =>
        createDispatchNotification(
          partner.userId,
          "Nearby delivery request",
          [
            `${order.orderNumber} from ${order.restaurant.name}`,
            `Pickup ${buildAddressSummary([
              order.restaurant.addressLine,
              order.restaurant.area,
              order.restaurant.city,
            ]) || order.restaurant.name}`,
            `Drop ${buildAddressSummary([
              order.address.area,
              order.address.city,
            ]) || order.address.city}`,
            partner.distanceKm != null ? `${partner.distanceKm.toFixed(1)} km away` : null,
          ]
            .filter(Boolean)
            .join(" • "),
          buildDispatchMeta(order, {
            eventKey: "delivery:offer:new",
            offer: {
              radiusKm,
              distanceKm: partner.distanceKm,
              expiresAt,
              batchNumber,
            },
          }),
          {
            deliveryPartnerId: partner.id,
          },
        ),
      ),
    );

    emitDispatchQueueUpdate({
      orderId,
      state: DeliveryOfferStatus.PENDING,
      userIds: partners.map((partner) => partner.userId),
      deliveryPartnerIds: partners.map((partner) => partner.id),
    });

    return {
      orderId,
      offersCreated: partners.length,
      radiusKm,
      rebroadcasted: expiredOffers.length > 0 || Boolean(latestBatch),
    };
  }

  return {
    orderId,
    offersCreated: 0,
    radiusKm: null as number | null,
    rebroadcasted: expiredOffers.length > 0,
  };
};

const mapOfferRowsToOrders = (
  offers: Array<
    Prisma.DeliveryAssignmentOfferGetPayload<{
      include: {
        order: {
          include: typeof deliveryOfferOrderInclude;
        };
      };
    }>
  >,
) =>
  offers.map((offer) => ({
    ...offer.order,
    deliveryOffer: {
      id: offer.id,
      batchNumber: offer.batchNumber,
      radiusKm: offer.radiusKm,
      distanceKm: offer.distanceKm,
      offeredAt: offer.offeredAt,
      expiresAt: offer.expiresAt,
      status: offer.status,
    },
  }));

const declineOffer = async (userId: number, orderId: number) => {
  const partner = await prisma.deliveryPartner.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!partner) {
    throw new AppError(404, "Delivery profile not found", "DELIVERY_PROFILE_NOT_FOUND");
  }

  const offer = await prisma.deliveryAssignmentOffer.findFirst({
    where: {
      orderId,
      deliveryPartnerId: partner.id,
      status: DeliveryOfferStatus.PENDING,
      expiresAt: {
        gt: new Date(),
      },
      order: {
        deletedAt: null,
        deliveryPartnerId: null,
        status: {
          in: [...claimableOrderStatuses],
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!offer) {
    throw new AppError(409, "This delivery request is no longer available", "DELIVERY_REQUEST_UNAVAILABLE");
  }

  await prisma.deliveryAssignmentOffer.update({
    where: { id: offer.id },
    data: {
      status: DeliveryOfferStatus.REJECTED,
      respondedAt: new Date(),
      closedReason: "PARTNER_SKIPPED",
    },
  });

  emitDispatchQueueUpdate({
    orderId,
    state: DeliveryOfferStatus.REJECTED,
    userIds: [partner.userId],
    deliveryPartnerIds: [partner.id],
  });

  await syncOrderDispatch(orderId);
};

const releaseAssignedOrder = async (userId: number, orderId: number, note?: string) => {
  const partner = await prisma.deliveryPartner.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!partner) {
    throw new AppError(404, "Delivery profile not found", "DELIVERY_PROFILE_NOT_FOUND");
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      deliveryPartnerId: partner.id,
    },
    include: {
      restaurant: {
        select: {
          ownerId: true,
          name: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  }

  if (order.status !== OrderStatus.DELIVERY_PARTNER_ASSIGNED) {
    throw new AppError(
      409,
      "This order can only be released before pickup starts",
      "DELIVERY_REQUEST_RELEASE_BLOCKED",
    );
  }

  const releaseNote = note?.trim() || "Delivery partner released the order before pickup.";

  await prisma.$transaction(async (tx) => {
    const updatedOrder = await tx.order.updateMany({
      where: {
        id: orderId,
        deletedAt: null,
        deliveryPartnerId: partner.id,
        status: OrderStatus.DELIVERY_PARTNER_ASSIGNED,
      },
      data: {
        deliveryPartnerId: null,
        status: OrderStatus.LOOKING_FOR_DELIVERY_PARTNER,
        assignedAt: null,
      },
    });

    if (!updatedOrder.count) {
      throw new AppError(
        409,
        "This order is no longer assigned to you",
        "DELIVERY_REQUEST_UNAVAILABLE",
      );
    }

    await tx.orderStatusEvent.create({
      data: {
        orderId,
        actorId: userId,
        status: OrderStatus.LOOKING_FOR_DELIVERY_PARTNER,
        note: releaseNote,
      },
    });

    await tx.deliveryAssignmentOffer.updateMany({
      where: {
        orderId,
        deliveryPartnerId: partner.id,
        status: DeliveryOfferStatus.ACCEPTED,
      },
      data: {
        status: DeliveryOfferStatus.RELEASED,
        respondedAt: new Date(),
        closedReason: "PARTNER_RELEASED_BEFORE_PICKUP",
      },
    });

    await tx.deliveryPartner.update({
      where: { id: partner.id },
      data: {
        availabilityStatus: DeliveryAvailabilityStatus.ONLINE,
      },
    });
  });

  const releasedOrder = await prisma.order.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
    },
    include: deliveryOfferOrderInclude,
  });

  if (releasedOrder) {
    await Promise.all([
      createDispatchNotification(
        releasedOrder.userId,
        "Finding another delivery partner",
        `${releasedOrder.orderNumber} is being reassigned to another nearby rider.`,
        JSON.stringify({
          eventKey: "customer:delivery-partner-released",
          orderId,
          orderNumber: releasedOrder.orderNumber,
          status: OrderStatus.LOOKING_FOR_DELIVERY_PARTNER,
        }),
      ),
      createDispatchNotification(
        releasedOrder.restaurant.ownerId,
        "Delivery partner released order",
        `${releasedOrder.orderNumber} is returning to auto-assignment for a nearby rider.`,
        JSON.stringify({
          eventKey: "owner:delivery-partner-released",
          orderId,
          orderNumber: releasedOrder.orderNumber,
          status: OrderStatus.LOOKING_FOR_DELIVERY_PARTNER,
        }),
        {
          restaurantId: releasedOrder.restaurant.id,
        },
      ),
    ]);

    emitOrderStatusUpdate({
      orderId,
      userId: releasedOrder.userId,
      ownerId: releasedOrder.restaurant.ownerId,
      restaurantId: releasedOrder.restaurant.id,
      status: OrderStatus.LOOKING_FOR_DELIVERY_PARTNER,
      note: releaseNote,
    });
  }

  emitDispatchQueueUpdate({
    orderId,
    state: DeliveryOfferStatus.RELEASED,
    userIds: [partner.userId],
    deliveryPartnerIds: [partner.id],
  });

  await syncOrderDispatch(orderId);

  return prisma.order.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
    },
    include: deliveryOfferOrderInclude,
  });
};

const rebroadcastUnassignedOrders = async () => {
  const now = new Date();
  const reassignCutoff = new Date(
    now.getTime() - dispatchConfig.reassignTimeoutMinutes * 60 * 1000,
  );
  const pendingOrderIds = await prisma.order.findMany({
    where: {
      deletedAt: null,
      deliveryPartnerId: null,
      status: {
        in: [...claimableOrderStatuses],
      },
      deliveryAssignmentOffers: {
        none: {
          status: {
            in: [...openDeliveryOfferStatuses],
          },
          expiresAt: {
            gt: now,
          },
        },
      },
    },
    select: {
      id: true,
    },
  });

  const staleAssignedOrders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      deliveryPartnerId: {
        not: null,
      },
      status: OrderStatus.DELIVERY_PARTNER_ASSIGNED,
      assignedAt: {
        not: null,
        lte: reassignCutoff,
      },
      pickedUpAt: null,
    },
    select: {
      id: true,
      userId: true,
      orderNumber: true,
      deliveryPartnerId: true,
      restaurant: {
        select: {
          id: true,
          ownerId: true,
        },
      },
      deliveryPartner: {
        select: {
          id: true,
          userId: true,
        },
      },
    },
  });

  let releasedAssignments = 0;

  for (const order of staleAssignedOrders) {
    if (!order.deliveryPartnerId || !order.deliveryPartner?.userId) {
      continue;
    }

    const deliveryPartnerId = order.deliveryPartnerId;
    const deliveryPartnerUserId = order.deliveryPartner.userId;

    await prisma.$transaction(async (tx) => {
      const released = await tx.order.updateMany({
        where: {
          id: order.id,
          deletedAt: null,
          deliveryPartnerId,
          status: OrderStatus.DELIVERY_PARTNER_ASSIGNED,
          assignedAt: {
            lte: reassignCutoff,
          },
        },
        data: {
          deliveryPartnerId: null,
          status: OrderStatus.LOOKING_FOR_DELIVERY_PARTNER,
          assignedAt: null,
        },
      });

      if (!released.count) {
        return;
      }

      releasedAssignments += 1;

      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          status: OrderStatus.LOOKING_FOR_DELIVERY_PARTNER,
          note: "Delivery partner confirmation timed out. Restarting nearby rider search.",
        },
      });

      await tx.deliveryAssignmentOffer.updateMany({
        where: {
          orderId: order.id,
          deliveryPartnerId,
          status: DeliveryOfferStatus.ACCEPTED,
        },
        data: {
          status: DeliveryOfferStatus.RELEASED,
          respondedAt: now,
          closedReason: "ASSIGNED_PARTNER_TIMEOUT",
        },
      });

      await tx.deliveryPartner.update({
        where: { id: deliveryPartnerId },
        data: {
          availabilityStatus: DeliveryAvailabilityStatus.ONLINE,
        },
      });
    });

    emitOrderStatusUpdate({
      orderId: order.id,
      userId: order.userId,
      ownerId: order.restaurant.ownerId,
      restaurantId: order.restaurant.id,
      status: OrderStatus.LOOKING_FOR_DELIVERY_PARTNER,
      note: "Delivery partner confirmation timed out. Restarting nearby rider search.",
    });
    emitDispatchQueueUpdate({
      orderId: order.id,
      state: DeliveryOfferStatus.RELEASED,
      userIds: [deliveryPartnerUserId],
      deliveryPartnerIds: [deliveryPartnerId],
    });
    await syncOrderDispatch(order.id);
  }

  for (const order of pendingOrderIds) {
    await syncOrderDispatch(order.id);
  }

  return {
    rebroadcastedOrders: pendingOrderIds.length,
    releasedAssignments,
  };
};

export const orderDispatchService = {
  claimableOrderStatuses,
  activeDeliveryStatuses,
  deliveryOfferOrderInclude,
  dispatchConfig,
  syncOrder: syncOrderDispatch,
  async listOpenOffersForUser(user: { id: number; role: Role }) {
    if (user.role === Role.ADMIN) {
      return prisma.order.findMany({
        where: {
          deletedAt: null,
          deliveryPartnerId: null,
          status: {
            in: [...claimableOrderStatuses],
          },
        },
        include: deliveryOfferOrderInclude,
        orderBy: { orderedAt: "desc" },
      });
    }

    const partner = await prisma.deliveryPartner.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        availabilityStatus: true,
      },
    });

    if (!partner) {
      throw new AppError(404, "Delivery profile not found", "DELIVERY_PROFILE_NOT_FOUND");
    }

    if (partner.availabilityStatus !== DeliveryAvailabilityStatus.ONLINE) {
      return [];
    }

    const offers = await prisma.deliveryAssignmentOffer.findMany({
      where: {
        deliveryPartnerId: partner.id,
        status: DeliveryOfferStatus.PENDING,
        expiresAt: {
          gt: new Date(),
        },
        order: {
          deletedAt: null,
          deliveryPartnerId: null,
          status: {
            in: [...claimableOrderStatuses],
          },
        },
      },
      include: {
        order: {
          include: deliveryOfferOrderInclude,
        },
      },
      orderBy: [{ distanceKm: "asc" }, { offeredAt: "desc" }],
    });

    return mapOfferRowsToOrders(offers);
  },
  async declineOffer(userId: number, orderId: number) {
    await declineOffer(userId, orderId);
  },
  async releaseAssignedOrder(userId: number, orderId: number, note?: string) {
    return releaseAssignedOrder(userId, orderId, note);
  },
  async closeOrderOffers(orderId: number, status: DeliveryOfferStatus, closedReason: string) {
    return closePendingOffersForOrder(orderId, { status, closedReason });
  },
  async rebroadcastUnassignedOrders() {
    return rebroadcastUnassignedOrders();
  },
};
