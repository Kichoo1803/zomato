import { OrderStatus } from "../constants/enums.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

const ORDER_RETENTION_DAYS = 30;
const ARCHIVABLE_ORDER_STATUSES = [OrderStatus.DELIVERED, OrderStatus.CANCELLED];

const getCleanupCutoff = () =>
  new Date(Date.now() - ORDER_RETENTION_DAYS * 24 * 60 * 60 * 1000);

export const cleanupArchivedOrders = async () => {
  const cutoff = getCleanupCutoff();
  const archivedAt = new Date();
  const candidateOrders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      createdAt: {
        lt: cutoff,
      },
      status: {
        in: ARCHIVABLE_ORDER_STATUSES,
      },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      orderedAt: true,
      userId: true,
      restaurantId: true,
      deliveryPartnerId: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!candidateOrders.length) {
    logger.info("Order cleanup completed with no eligible orders", {
      cutoff: cutoff.toISOString(),
      retentionDays: ORDER_RETENTION_DAYS,
      statuses: ARCHIVABLE_ORDER_STATUSES,
    });

    return {
      archivedCount: 0,
      cutoff,
      archivedAt,
    };
  }

  const candidateIds = candidateOrders.map((order) => order.id);
  const result = await prisma.order.updateMany({
    where: {
      id: {
        in: candidateIds,
      },
      deletedAt: null,
    },
    data: {
      deletedAt: archivedAt,
    },
  });

  logger.info("Archived old orders successfully", {
    archivedCount: result.count,
    cutoff: cutoff.toISOString(),
    archivedAt: archivedAt.toISOString(),
    statuses: ARCHIVABLE_ORDER_STATUSES,
    orders: candidateOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      orderedAt: order.orderedAt.toISOString(),
      userId: order.userId,
      restaurantId: order.restaurantId,
      deliveryPartnerId: order.deliveryPartnerId,
    })),
  });

  return {
    archivedCount: result.count,
    cutoff,
    archivedAt,
  };
};
