import {
  DeliveryOfferStatus,
  NotificationType,
  OfferScope,
  OrderStatus,
  PaymentStatus,
  Role,
} from "../constants/enums.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { notificationsService } from "../modules/notifications/notifications.service.js";

const CUSTOMER_ACTIVE_STATUSES = [
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.LOOKING_FOR_DELIVERY_PARTNER,
  OrderStatus.DELIVERY_PARTNER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.ON_THE_WAY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELAYED,
];

const OWNER_PENDING_STATUSES = [
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
  OrderStatus.ACCEPTED,
];

const DELIVERY_PICKUP_PENDING_STATUSES = [
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.DELIVERY_PARTNER_ASSIGNED,
];

const DELIVERY_STALE_UPDATE_STATUSES = [
  OrderStatus.PICKED_UP,
  OrderStatus.ON_THE_WAY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELAYED,
];

const addGroupedCount = <T extends { count: number }>(
  collection: Map<number, T>,
  key: number,
  createValue: () => T,
) => {
  const currentValue = collection.get(key);

  if (currentValue) {
    currentValue.count += 1;
    return currentValue;
  }

  const nextValue = createValue();
  collection.set(key, nextValue);
  return nextValue;
};

export const dispatchNotificationReminders = async () => {
  const now = new Date();
  const customerActiveCutoff = new Date(now.getTime() - 35 * 60 * 1000);
  const reviewReminderCutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const reviewReminderWindowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ownerPendingCutoff = new Date(now.getTime() - 15 * 60 * 1000);
  const ownerDelayedCutoff = new Date(now.getTime() - 20 * 60 * 1000);
  const deliveryPickupCutoff = new Date(now.getTime() - 15 * 60 * 1000);
  const deliveryStaleCutoff = new Date(now.getTime() - 20 * 60 * 1000);
  const offerExpiryCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const adminMonitoringCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const opsDispatchCutoff = new Date(now.getTime() - 15 * 60 * 1000);

  const [
    activeCustomerOrders,
    deliveredOrdersWithoutReview,
    ownerPendingOrders,
    ownerDelayedOrders,
    deliveryPickupOrders,
    deliveryStaleOrders,
    expiringOwnerOffers,
    failedPaymentsCount,
    longDelayedOrdersCount,
    dispatchBacklogCount,
    adminUsers,
    operationsUsers,
  ] = await Promise.all([
    prisma.order.findMany({
      where: {
        deletedAt: null,
        status: { in: CUSTOMER_ACTIVE_STATUSES },
        orderedAt: { lte: customerActiveCutoff },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        userId: true,
        restaurant: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.order.findMany({
      where: {
        deletedAt: null,
        status: OrderStatus.DELIVERED,
        deliveredAt: {
          gte: reviewReminderWindowStart,
          lte: reviewReminderCutoff,
        },
        review: {
          is: null,
        },
      },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        restaurant: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        deliveredAt: "desc",
      },
    }),
    prisma.order.findMany({
      where: {
        deletedAt: null,
        status: { in: OWNER_PENDING_STATUSES },
        orderedAt: { lte: ownerPendingCutoff },
      },
      select: {
        orderNumber: true,
        restaurant: {
          select: {
            ownerId: true,
          },
        },
      },
    }),
    prisma.order.findMany({
      where: {
        deletedAt: null,
        status: OrderStatus.DELAYED,
        delayedAt: {
          not: null,
          lte: ownerDelayedCutoff,
        },
      },
      select: {
        orderNumber: true,
        restaurant: {
          select: {
            ownerId: true,
          },
        },
      },
    }),
    prisma.order.findMany({
      where: {
        deletedAt: null,
        deliveryPartnerId: { not: null },
        status: { in: DELIVERY_PICKUP_PENDING_STATUSES },
        updatedAt: { lte: deliveryPickupCutoff },
      },
      select: {
        orderNumber: true,
        deliveryPartner: {
          select: {
            userId: true,
          },
        },
      },
    }),
    prisma.order.findMany({
      where: {
        deletedAt: null,
        deliveryPartnerId: { not: null },
        status: { in: DELIVERY_STALE_UPDATE_STATUSES },
        updatedAt: { lte: deliveryStaleCutoff },
      },
      select: {
        orderNumber: true,
        deliveryPartner: {
          select: {
            userId: true,
          },
        },
      },
    }),
    prisma.offer.findMany({
      where: {
        scope: OfferScope.RESTAURANT,
        isActive: true,
        endDate: {
          gte: now,
          lte: offerExpiryCutoff,
        },
      },
      select: {
        id: true,
        title: true,
        endDate: true,
        restaurantLinks: {
          select: {
            restaurant: {
              select: {
                ownerId: true,
              },
            },
          },
        },
      },
    }),
    prisma.payment.count({
      where: {
        status: PaymentStatus.FAILED,
        createdAt: {
          gte: adminMonitoringCutoff,
        },
      },
    }),
    prisma.order.count({
      where: {
        deletedAt: null,
        status: OrderStatus.DELAYED,
        delayedAt: {
          not: null,
          lte: ownerDelayedCutoff,
        },
      },
    }),
    prisma.order.count({
      where: {
        deletedAt: null,
        deliveryPartnerId: null,
        status: {
          in: [OrderStatus.READY_FOR_PICKUP, OrderStatus.LOOKING_FOR_DELIVERY_PARTNER],
        },
        updatedAt: {
          lte: opsDispatchCutoff,
        },
        deliveryAssignmentOffers: {
          none: {
            status: DeliveryOfferStatus.PENDING,
            expiresAt: {
              gt: now,
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        role: Role.ADMIN,
        isActive: true,
      },
      select: {
        id: true,
      },
    }),
    prisma.user.findMany({
      where: {
        role: {
          in: [Role.OPERATIONS_MANAGER, Role.REGIONAL_MANAGER],
        },
        isActive: true,
      },
      select: {
        id: true,
      },
    }),
  ]);

  await Promise.all(
    activeCustomerOrders.map((order) =>
      notificationsService.createForUser({
        userId: order.userId,
        title: "Your order is still in progress",
        message: `${order.orderNumber} from ${order.restaurant.name} is still active. We will keep you posted on the next update.`,
        type: NotificationType.ORDER,
        meta: {
          eventKey: "reminder:customer-order-in-progress",
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          restaurantName: order.restaurant.name,
          path: `/track-order/${order.id}`,
        },
        dedupeWindowMinutes: 180,
      }),
    ),
  );

  await Promise.all(
    deliveredOrdersWithoutReview.slice(0, 25).map((order) =>
      notificationsService.createForUser({
        userId: order.userId,
        title: "Rate your last order",
        message: `${order.orderNumber} from ${order.restaurant.name} was delivered. Share a quick rating when you have a moment.`,
        type: NotificationType.SYSTEM,
        meta: {
          eventKey: "reminder:customer-review-pending",
          orderId: order.id,
          orderNumber: order.orderNumber,
          restaurantName: order.restaurant.name,
          path: `/orders/${order.id}`,
        },
        dedupeWindowMinutes: 24 * 60,
      }),
    ),
  );

  const pendingOrdersByOwner = new Map<number, { count: number; sampleOrderNumber: string }>();
  ownerPendingOrders.forEach((order) => {
    addGroupedCount(pendingOrdersByOwner, order.restaurant.ownerId, () => ({
      count: 1,
      sampleOrderNumber: order.orderNumber,
    }));
  });

  await Promise.all(
    [...pendingOrdersByOwner.entries()].map(([ownerId, summary]) =>
      notificationsService.createForUser({
        userId: ownerId,
        title: "You have pending orders to confirm",
        message: `${summary.count} pending order${summary.count > 1 ? "s" : ""} still need attention. Oldest queue item: ${summary.sampleOrderNumber}.`,
        type: NotificationType.ORDER,
        meta: {
          eventKey: "reminder:owner-pending-orders",
          count: summary.count,
          path: "/owner/orders",
        },
        dedupeWindowMinutes: 60,
      }),
    ),
  );

  const delayedOrdersByOwner = new Map<number, { count: number; sampleOrderNumber: string }>();
  ownerDelayedOrders.forEach((order) => {
    addGroupedCount(delayedOrdersByOwner, order.restaurant.ownerId, () => ({
      count: 1,
      sampleOrderNumber: order.orderNumber,
    }));
  });

  await Promise.all(
    [...delayedOrdersByOwner.entries()].map(([ownerId, summary]) =>
      notificationsService.createForUser({
        userId: ownerId,
        title: "Update delayed order status",
        message: `${summary.count} delayed order${summary.count > 1 ? "s" : ""} still need follow-up. Check ${summary.sampleOrderNumber} and refresh the queue status.`,
        type: NotificationType.ORDER,
        meta: {
          eventKey: "reminder:owner-delayed-orders",
          count: summary.count,
          path: "/owner/orders",
        },
        dedupeWindowMinutes: 60,
      }),
    ),
  );

  const expiringOffersByOwner = new Map<number, { count: number; sampleTitle: string }>();
  expiringOwnerOffers.forEach((offer) => {
    offer.restaurantLinks.forEach((link) => {
      addGroupedCount(expiringOffersByOwner, link.restaurant.ownerId, () => ({
        count: 1,
        sampleTitle: offer.title,
      }));
    });
  });

  await Promise.all(
    [...expiringOffersByOwner.entries()].map(([ownerId, summary]) =>
      notificationsService.createForUser({
        userId: ownerId,
        title: "Offer expires soon",
        message:
          summary.count > 1
            ? `${summary.sampleTitle} and ${summary.count - 1} more offers are closing within the next day.`
            : `${summary.sampleTitle} is closing within the next day.`,
        type: NotificationType.OFFER,
        meta: {
          eventKey: "reminder:owner-offer-expiring",
          count: summary.count,
          path: "/owner/offers",
        },
        dedupeWindowMinutes: 12 * 60,
      }),
    ),
  );

  const pickupPendingByPartner = new Map<number, { count: number; sampleOrderNumber: string }>();
  deliveryPickupOrders.forEach((order) => {
    const partnerUserId = order.deliveryPartner?.userId;

    if (!partnerUserId) {
      return;
    }

    addGroupedCount(pickupPendingByPartner, partnerUserId, () => ({
      count: 1,
      sampleOrderNumber: order.orderNumber,
    }));
  });

  await Promise.all(
    [...pickupPendingByPartner.entries()].map(([partnerUserId, summary]) =>
      notificationsService.createForUser({
        userId: partnerUserId,
        title: "Pickup pending",
        message: `${summary.count} pickup${summary.count > 1 ? "s are" : " is"} still waiting. Start with ${summary.sampleOrderNumber}.`,
        type: NotificationType.ORDER,
        meta: {
          eventKey: "reminder:delivery-pickup-pending",
          count: summary.count,
          path: "/delivery/active",
        },
        dedupeWindowMinutes: 45,
      }),
    ),
  );

  const staleDeliveryUpdatesByPartner = new Map<number, { count: number; sampleOrderNumber: string }>();
  deliveryStaleOrders.forEach((order) => {
    const partnerUserId = order.deliveryPartner?.userId;

    if (!partnerUserId) {
      return;
    }

    addGroupedCount(staleDeliveryUpdatesByPartner, partnerUserId, () => ({
      count: 1,
      sampleOrderNumber: order.orderNumber,
    }));
  });

  await Promise.all(
    [...staleDeliveryUpdatesByPartner.entries()].map(([partnerUserId, summary]) =>
      notificationsService.createForUser({
        userId: partnerUserId,
        title: "Delivery not updated recently",
        message: `${summary.count} active delivery${summary.count > 1 ? " updates are" : " update is"} waiting. Please refresh the latest status starting with ${summary.sampleOrderNumber}.`,
        type: NotificationType.ORDER,
        meta: {
          eventKey: "reminder:delivery-status-pending",
          count: summary.count,
          path: "/delivery/active",
        },
        dedupeWindowMinutes: 45,
      }),
    ),
  );

  if (failedPaymentsCount || longDelayedOrdersCount) {
    await Promise.all(
      adminUsers.map((adminUser) =>
        notificationsService.createForUser({
          userId: adminUser.id,
          title: "Orders need attention",
          message: `${longDelayedOrdersCount} delayed order${longDelayedOrdersCount === 1 ? "" : "s"} and ${failedPaymentsCount} failed payment${failedPaymentsCount === 1 ? "" : "s"} need review.`,
          type: NotificationType.SYSTEM,
          meta: {
            eventKey: "reminder:admin-order-attention",
            delayedOrdersCount: longDelayedOrdersCount,
            failedPaymentsCount,
            path: failedPaymentsCount ? "/admin/payments" : "/admin/orders",
          },
          dedupeWindowMinutes: 60,
        }),
      ),
    );
  }

  if (dispatchBacklogCount) {
    await Promise.all(
      operationsUsers.map((operationsUser) =>
        notificationsService.createForUser({
          userId: operationsUser.id,
          title: "Dispatch coverage reminder",
          message: `${dispatchBacklogCount} order${dispatchBacklogCount === 1 ? "" : "s"} are still waiting for delivery-partner coverage.`,
          type: NotificationType.SYSTEM,
          meta: {
            eventKey: "reminder:ops-dispatch-backlog",
            dispatchBacklogCount,
            path: "/ops/assignments",
          },
          dedupeWindowMinutes: 45,
        }),
      ),
    );
  }

  logger.info("Notification reminder job completed", {
    activeCustomerOrders: activeCustomerOrders.length,
    deliveredOrdersWithoutReview: deliveredOrdersWithoutReview.length,
    pendingOwners: pendingOrdersByOwner.size,
    delayedOwners: delayedOrdersByOwner.size,
    expiringOwnerOffers: expiringOffersByOwner.size,
    pickupPendingPartners: pickupPendingByPartner.size,
    staleDeliveryPartners: staleDeliveryUpdatesByPartner.size,
    adminUsers: adminUsers.length,
    operationsUsers: operationsUsers.length,
    failedPaymentsCount,
    longDelayedOrdersCount,
    dispatchBacklogCount,
  });
};
