import { Prisma } from "@prisma/client";
import {
  DeliveryAssignmentStatus,
  DeliveryAvailabilityStatus,
  DeliveryOfferStatus,
  NotificationType,
  OrderStatus,
  PaymentStatus,
  Role,
} from "../../constants/enums.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import {
  emitDispatchQueueUpdate,
  emitNotification,
  emitOrderStatusUpdate,
} from "../../socket/index.js";
import { AppError } from "../../utils/app-error.js";
import { ensureDeliveryPartnerProfileByUserId } from "../delivery-partners/delivery-partner-profile.js";
import {
  ORDER_ASSIGNMENT_RADII_KM,
  FALLBACK_ASSIGNMENT_RADIUS_KM,
  PRIMARY_ASSIGNMENT_RADIUS_KM,
  isDeliveryPartnerAvailableForOrdersStatus,
} from "../../services/delivery-partner-availability.service.js";
import {
  calculateRestaurantPickupDistanceKm,
  findAvailableDeliveryPartnersNearRestaurant,
} from "../../services/delivery-partner-availability.service.js";

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
  paymentStatus: true,
  paymentMethod: true,
  totalAmount: true,
  tipAmount: true,
  deliveryAssignmentStatus: true,
  deliveryAssignmentUpdatedAt: true,
  assignmentRadiusKm: true,
  routeDistanceKm: true,
  estimatedDeliveryMinutes: true,
  cancelReason: true,
  cancelledBy: true,
  refundStatus: true,
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
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
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

const dispatchConfig = {
  radiiKm: [...ORDER_ASSIGNMENT_RADII_KM],
  offerTtlSeconds: env.DELIVERY_ASSIGNMENT_OFFER_TTL_SECONDS,
  staleLocationMinutes: env.DELIVERY_ASSIGNMENT_STALE_LOCATION_MINUTES,
  maxActiveOrders: env.DELIVERY_ASSIGNMENT_MAX_ACTIVE_ORDERS,
  maxBroadcastPartners: 1,
  reassignTimeoutMinutes: env.DELIVERY_ASSIGNMENT_REASSIGN_TIMEOUT_MINUTES,
};

const logDispatchAssignmentDecision = (payload: {
  orderId: number;
  restaurantId: number | null;
  partnerId: number | null;
  distanceKm?: number | null;
  requestStatus: string;
  finalAssignedPartnerId?: number | null;
  note?: string | null;
}) => {
  if (!env.isDevelopment) {
    return;
  }

  logger.info("Delivery assignment decision", {
    orderId: payload.orderId,
    restaurantId: payload.restaurantId,
    partnerId: payload.partnerId,
    distanceKm:
      payload.distanceKm != null ? Number(payload.distanceKm.toFixed(2)) : null,
    requestStatus: payload.requestStatus,
    finalAssignedPartnerId: payload.finalAssignedPartnerId ?? null,
    note: payload.note ?? null,
  });
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
    path?: string;
    deliveryAssignmentStatus?: string;
    deliveryRequestStatus?: string;
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
    path: payload.path ?? `/delivery/deliveries?orderId=${order.id}`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: payload.status ?? order.status,
    deliveryAssignmentStatus:
      payload.deliveryAssignmentStatus ?? order.deliveryAssignmentStatus,
    deliveryRequestStatus: payload.deliveryRequestStatus ?? null,
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

const updateOrderDeliveryAssignmentState = async (
  tx: Prisma.TransactionClient | typeof prisma,
  input: {
    orderId: number;
    status: DeliveryAssignmentStatus;
    timestamp: Date;
  },
) =>
  tx.order.update({
    where: { id: input.orderId },
    data: {
      deliveryAssignmentStatus: input.status,
      deliveryAssignmentUpdatedAt: input.timestamp,
    },
  });

const getNextRadiusSequence = (lastRadiusKm?: number | null) => {
  if (lastRadiusKm == null) {
    return dispatchConfig.radiiKm;
  }

  const nextIndex = dispatchConfig.radiiKm.findIndex((value) => value > lastRadiusKm + 0.001);
  return nextIndex === -1
    ? [dispatchConfig.radiiKm[dispatchConfig.radiiKm.length - 1]]
    : dispatchConfig.radiiKm.slice(nextIndex);
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

const getPreviouslyContactedPartnerIds = async (orderId: number) => {
  const offerRows = await prisma.deliveryAssignmentOffer.findMany({
    where: {
      orderId,
    },
    select: {
      deliveryPartnerId: true,
    },
  });

  return [...new Set(offerRows.map((offer) => offer.deliveryPartnerId))];
};

const cancelUnassignedOrderForDispatchFailure = async (
  orderId: number,
  payload: {
    cancelReasonCode: string;
    cancelReason: string;
    refundedCustomerMessage: string;
    unpaidCustomerMessage: string;
    closedReason: string;
  },
) => {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      deliveryPartnerId: null,
      status: {
        in: [...claimableOrderStatuses],
      },
    },
    select: {
      id: true,
      userId: true,
      orderNumber: true,
      paymentStatus: true,
      restaurant: {
        select: {
          id: true,
          ownerId: true,
          name: true,
        },
      },
      payments: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!order) {
    return {
      orderId,
      cancelled: false,
      refunded: false,
    };
  }

  const requiresRefund =
    order.paymentStatus === PaymentStatus.PAID ||
    order.payments.some((payment) => payment.status === PaymentStatus.PAID);
  const customerMessage = requiresRefund
    ? payload.refundedCustomerMessage
    : payload.unpaidCustomerMessage;
  const now = new Date();

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const cancelledOrder = await tx.order.findFirst({
      where: {
        id: orderId,
        deletedAt: null,
        deliveryPartnerId: null,
        status: {
          in: [...claimableOrderStatuses],
        },
      },
      select: {
        id: true,
      },
    });

    if (!cancelledOrder) {
      return null;
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: now,
        cancelReason: payload.cancelReasonCode,
        cancelledBy: "SYSTEM",
        refundStatus: requiresRefund ? "REFUNDED" : "NOT_REQUIRED",
        ...(requiresRefund ? { paymentStatus: PaymentStatus.REFUNDED } : {}),
      },
    });

    if (requiresRefund) {
      await tx.payment.updateMany({
        where: {
          orderId,
          status: PaymentStatus.PAID,
        },
        data: {
          status: PaymentStatus.REFUNDED,
        },
      });
    }

    await tx.orderStatusEvent.create({
      data: {
        orderId,
        status: OrderStatus.CANCELLED,
        note: customerMessage,
      },
    });

    return cancelledOrder;
  });

  if (!updatedOrder) {
    return {
      orderId,
      cancelled: false,
      refunded: requiresRefund,
    };
  }

  await closePendingOffersForOrder(orderId, {
    status: DeliveryOfferStatus.CANCELLED,
    closedReason: payload.closedReason,
  });

  await Promise.all([
    createDispatchNotification(
      order.userId,
      "Order cancelled",
      customerMessage,
      JSON.stringify({
        eventKey: "customer:dispatch-order-cancelled",
        orderId,
        orderNumber: order.orderNumber,
        status: OrderStatus.CANCELLED,
        cancelReason: payload.cancelReason,
        refundStatus: requiresRefund ? "REFUNDED" : "NOT_REQUIRED",
      }),
    ),
    createDispatchNotification(
      order.restaurant.ownerId,
      "Order cancelled",
      requiresRefund
        ? `${order.orderNumber} was cancelled because no eligible delivery partner remained. Payment refunded automatically.`
        : `${order.orderNumber} was cancelled because no eligible delivery partner remained. No payment capture needed a refund.`,
      JSON.stringify({
        eventKey: "owner:dispatch-order-cancelled",
        orderId,
        orderNumber: order.orderNumber,
        status: OrderStatus.CANCELLED,
        cancelReason: payload.cancelReason,
        refundStatus: requiresRefund ? "REFUNDED" : "NOT_REQUIRED",
      }),
      {
        restaurantId: order.restaurant.id,
      },
    ),
  ]);

  emitOrderStatusUpdate({
    orderId,
    userId: order.userId,
    ownerId: order.restaurant.ownerId,
    restaurantId: order.restaurant.id,
    status: OrderStatus.CANCELLED,
    note: customerMessage,
  });

  return {
    orderId,
    cancelled: true,
    refunded: requiresRefund,
  };
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

    if (order.deliveryPartnerId) {
      await updateOrderDeliveryAssignmentState(prisma, {
        orderId,
        status: DeliveryAssignmentStatus.PARTNER_ACCEPTED,
        timestamp: new Date(),
      });
    }

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

    expiredOffers.forEach((offer) => {
      logDispatchAssignmentDecision({
        orderId,
        restaurantId: order.restaurant.id,
        partnerId: offer.deliveryPartner.id,
        requestStatus: DeliveryOfferStatus.EXPIRED,
        finalAssignedPartnerId: null,
        note: "Delivery request expired before the partner responded.",
      });
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
    await updateOrderDeliveryAssignmentState(prisma, {
      orderId,
      status: DeliveryAssignmentStatus.PARTNER_REQUESTED,
      timestamp: now,
    });

    return {
      orderId,
      offersCreated: 0,
      radiusKm: null as number | null,
      rebroadcasted: expiredOffers.length > 0,
    };
  }

  const latestBatch = await getLatestOfferBatch(orderId);
  const nextRadii = getNextRadiusSequence(latestBatch?.radiusKm);
  const previouslyContactedPartnerIds = await getPreviouslyContactedPartnerIds(orderId);

  for (const radiusKm of nextRadii) {
    const partners = await findAvailableDeliveryPartnersNearRestaurant(
      order.restaurant,
      radiusKm,
      {
        excludePartnerIds: previouslyContactedPartnerIds,
        maxPartners: dispatchConfig.maxBroadcastPartners,
      },
    );

    if (!partners.length) {
      continue;
    }

    const batchNumber = (latestBatch?.batchNumber ?? 0) + 1;
    const expiresAt = new Date(now.getTime() + dispatchConfig.offerTtlSeconds * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.deliveryAssignmentOffer.create({
        data: {
          orderId,
          deliveryPartnerId: partners[0].id,
          batchNumber,
          status: DeliveryOfferStatus.PENDING,
          radiusKm,
          distanceKm: partners[0].distanceKm,
          expiresAt,
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          assignmentRadiusKm: radiusKm,
          deliveryAssignmentStatus: DeliveryAssignmentStatus.PARTNER_REQUESTED,
          deliveryAssignmentUpdatedAt: now,
        },
      });
    });

    await Promise.all(
      partners.map((partner) =>
        createDispatchNotification(
          partner.userId,
          radiusKm > PRIMARY_ASSIGNMENT_RADIUS_KM
            ? "Nearby area order"
            : "Nearby delivery request",
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
            radiusKm > PRIMARY_ASSIGNMENT_RADIUS_KM ? "Nearby area order" : null,
            order.restaurant.area?.trim()
              ? `Restaurant area ${order.restaurant.area.trim()}`
              : null,
            partner.distanceKm != null
              ? `Distance from restaurant ${partner.distanceKm.toFixed(1)} km`
              : null,
          ]
            .filter(Boolean)
            .join(" • "),
          buildDispatchMeta(order, {
            eventKey: "delivery:offer:new",
            deliveryAssignmentStatus: DeliveryAssignmentStatus.PARTNER_REQUESTED,
            deliveryRequestStatus: DeliveryOfferStatus.PENDING,
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

    partners.forEach((partner) => {
      logDispatchAssignmentDecision({
        orderId,
        restaurantId: order.restaurant.id,
        partnerId: partner.id,
        distanceKm: partner.distanceKm,
        requestStatus: DeliveryOfferStatus.PENDING,
        finalAssignedPartnerId: null,
        note: `Delivery request sent within ${radiusKm} km dispatch radius.`,
      });
    });

    return {
      orderId,
      offersCreated: partners.length,
      radiusKm,
      rebroadcasted: expiredOffers.length > 0 || Boolean(latestBatch),
    };
  }

  await updateOrderDeliveryAssignmentState(prisma, {
    orderId,
    status: DeliveryAssignmentStatus.NO_PARTNER_AVAILABLE,
    timestamp: now,
  });

  await Promise.all([
    createDispatchNotification(
      order.userId,
      "No delivery partner accepted yet",
      latestBatch?.radiusKm != null ||
        previouslyContactedPartnerIds.length ||
        expiredOffers.length
        ? "We checked nearby riders, but no one has accepted the delivery request yet."
        : "We could not find an eligible nearby delivery partner right now.",
      JSON.stringify({
        eventKey: "customer:delivery-assignment-unavailable",
        path: `/orders/${orderId}`,
        orderId,
        orderNumber: order.orderNumber,
        status: order.status,
        deliveryAssignmentStatus: DeliveryAssignmentStatus.NO_PARTNER_AVAILABLE,
      }),
    ),
    createDispatchNotification(
      order.restaurant.ownerId,
      "No delivery partner available",
      latestBatch?.radiusKm != null ||
        previouslyContactedPartnerIds.length ||
        expiredOffers.length
        ? `${order.orderNumber} is still unassigned because nearby riders rejected or missed the request.`
        : `${order.orderNumber} is still unassigned because no nearby eligible rider is available right now.`,
      JSON.stringify({
        eventKey: "owner:delivery-assignment-unavailable",
        path: `/owner/orders?orderId=${orderId}`,
        orderId,
        orderNumber: order.orderNumber,
        status: order.status,
        deliveryAssignmentStatus: DeliveryAssignmentStatus.NO_PARTNER_AVAILABLE,
      }),
      {
        restaurantId: order.restaurant.id,
      },
    ),
  ]);

  emitOrderStatusUpdate({
    orderId,
    userId: order.userId,
    ownerId: order.restaurant.ownerId,
    restaurantId: order.restaurant.id,
    status: order.status,
    note:
      latestBatch?.radiusKm != null ||
      previouslyContactedPartnerIds.length ||
      expiredOffers.length
        ? "No delivery partner accepted the latest nearby request."
        : "No eligible nearby delivery partner is available right now.",
  });

  logDispatchAssignmentDecision({
    orderId,
    restaurantId: order.restaurant.id,
    partnerId: null,
    requestStatus: DeliveryAssignmentStatus.NO_PARTNER_AVAILABLE,
    finalAssignedPartnerId: null,
    note:
      latestBatch?.radiusKm != null ||
      previouslyContactedPartnerIds.length ||
      expiredOffers.length
        ? "All nearby delivery requests were rejected or expired."
        : "No eligible nearby partner matched the restaurant coordinates.",
  });

  return {
    orderId,
    offersCreated: 0,
    radiusKm: null as number | null,
    rebroadcasted: expiredOffers.length > 0,
    cancelled: false,
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

const declineOffer = async (userId: number, orderId: number, rejectionReason?: string) => {
  const { profile: partner } = await ensureDeliveryPartnerProfileByUserId(userId);

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
      closedReason: rejectionReason?.trim() || "PARTNER_SKIPPED",
    },
  });

  emitDispatchQueueUpdate({
    orderId,
    state: DeliveryOfferStatus.REJECTED,
    userIds: [partner.userId],
    deliveryPartnerIds: [partner.id],
  });

  logDispatchAssignmentDecision({
    orderId,
    restaurantId: null,
    partnerId: partner.id,
    requestStatus: DeliveryOfferStatus.REJECTED,
    finalAssignedPartnerId: null,
    note: rejectionReason?.trim() || "Delivery partner rejected the request.",
  });

  await syncOrderDispatch(orderId);
};

const releaseAssignedOrder = async (userId: number, orderId: number, note?: string) => {
  const { profile: partner } = await ensureDeliveryPartnerProfileByUserId(userId);

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

  if (
    order.pickedUpAt ||
    ([OrderStatus.PICKED_UP, OrderStatus.ON_THE_WAY, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELAYED] as OrderStatus[]).includes(
      order.status as OrderStatus,
    )
  ) {
    throw new AppError(
      409,
      "This order can only be released before pickup starts",
      "DELIVERY_REQUEST_RELEASE_BLOCKED",
    );
  }

  const releaseNote = note?.trim() || "Delivery partner released the order before pickup.";
  const nextOrderStatus =
    order.status === OrderStatus.DELIVERY_PARTNER_ASSIGNED
      ? OrderStatus.LOOKING_FOR_DELIVERY_PARTNER
      : order.status;

  await prisma.$transaction(async (tx) => {
    const updatedOrder = await tx.order.updateMany({
      where: {
        id: orderId,
        deletedAt: null,
        deliveryPartnerId: partner.id,
        pickedUpAt: null,
      },
      data: {
        deliveryPartnerId: null,
        status: nextOrderStatus,
        assignedAt: null,
        deliveryAssignmentStatus: DeliveryAssignmentStatus.FINDING_PARTNER,
        deliveryAssignmentUpdatedAt: new Date(),
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
        status: nextOrderStatus,
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
          status: nextOrderStatus,
          deliveryAssignmentStatus: DeliveryAssignmentStatus.FINDING_PARTNER,
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
          status: nextOrderStatus,
          deliveryAssignmentStatus: DeliveryAssignmentStatus.FINDING_PARTNER,
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
      status: nextOrderStatus,
      note: releaseNote,
    });
  }

  emitDispatchQueueUpdate({
    orderId,
    state: DeliveryOfferStatus.RELEASED,
    userIds: [partner.userId],
    deliveryPartnerIds: [partner.id],
  });

  logDispatchAssignmentDecision({
    orderId,
    restaurantId: releasedOrder?.restaurant.id ?? null,
    partnerId: partner.id,
    requestStatus: DeliveryOfferStatus.RELEASED,
    finalAssignedPartnerId: null,
    note: releaseNote,
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
          deliveryAssignmentStatus: DeliveryAssignmentStatus.FINDING_PARTNER,
          deliveryAssignmentUpdatedAt: now,
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
    logDispatchAssignmentDecision({
      orderId: order.id,
      restaurantId: order.restaurant.id,
      partnerId: deliveryPartnerId,
      requestStatus: DeliveryOfferStatus.RELEASED,
      finalAssignedPartnerId: null,
      note: "Assigned delivery partner timed out before pickup confirmation.",
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

    const { profile: partner } = await ensureDeliveryPartnerProfileByUserId(user.id);

    if (!isDeliveryPartnerAvailableForOrdersStatus(partner.availabilityStatus)) {
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

    return mapOfferRowsToOrders(offers)
      .reduce<
        Array<
          ReturnType<typeof mapOfferRowsToOrders>[number] & {
            restaurantDistanceKm: number;
            deliveryCoverageType: "PRIMARY" | "FALLBACK";
            deliveryOffer: NonNullable<
              ReturnType<typeof mapOfferRowsToOrders>[number]["deliveryOffer"]
            >;
          }
        >
      >((visibleOrders, order) => {
        const restaurantDistanceKm = calculateRestaurantPickupDistanceKm(
          order.restaurant,
          partner,
        );

        if (
          restaurantDistanceKm == null ||
          restaurantDistanceKm > FALLBACK_ASSIGNMENT_RADIUS_KM ||
          !order.deliveryOffer
        ) {
          return visibleOrders;
        }

        visibleOrders.push({
          ...order,
          restaurantDistanceKm,
          deliveryCoverageType:
            restaurantDistanceKm > PRIMARY_ASSIGNMENT_RADIUS_KM ? "FALLBACK" : "PRIMARY",
          deliveryOffer: {
            ...order.deliveryOffer,
            distanceKm: restaurantDistanceKm,
          },
        });

        return visibleOrders;
      }, [])
      .sort((left, right) => {
        if (left.restaurantDistanceKm !== right.restaurantDistanceKm) {
          return left.restaurantDistanceKm - right.restaurantDistanceKm;
        }

        return (
          new Date(right.deliveryOffer?.offeredAt ?? 0).getTime() -
          new Date(left.deliveryOffer?.offeredAt ?? 0).getTime()
        );
      });
  },
  async declineOffer(userId: number, orderId: number, rejectionReason?: string) {
    await declineOffer(userId, orderId, rejectionReason);
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
