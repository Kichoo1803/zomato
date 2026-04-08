import { OrderStatus, PaymentStatus, Role } from "../../constants/enums.js";
import { prisma } from "../../lib/prisma.js";
import { decimalToNumber } from "../../utils/pricing.js";

export const adminAnalyticsService = {
  async getDashboard() {
    const [
      usersCount,
      restaurantsCount,
      deliveryPartnersCount,
      ordersCount,
      deliveredOrders,
      activeOrders,
      revenueAgg,
      ordersByStatus,
      usersByRole,
      topRestaurants,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.restaurant.count(),
      prisma.deliveryPartner.count(),
      prisma.order.count(),
      prisma.order.count({ where: { status: OrderStatus.DELIVERED } }),
      prisma.order.count({
        where: {
          status: {
            in: [OrderStatus.PLACED, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.OUT_FOR_DELIVERY],
          },
        },
      }),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID },
        _sum: { amount: true },
      }),
      prisma.order.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.user.groupBy({
        by: ["role"],
        _count: { _all: true },
      }),
      prisma.restaurant.findMany({
        orderBy: [{ totalReviews: "desc" }, { avgRating: "desc" }],
        take: 5,
        select: {
          id: true,
          name: true,
          slug: true,
          avgRating: true,
          totalReviews: true,
          costForTwo: true,
        },
      }),
    ]);

    return {
      stats: {
        usersCount,
        restaurantsCount,
        deliveryPartnersCount,
        ordersCount,
        deliveredOrders,
        activeOrders,
        grossMerchandiseValue: decimalToNumber(revenueAgg._sum.amount),
      },
      ordersByStatus: ordersByStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      usersByRole: usersByRole.map((row) => ({
        role: row.role,
        count: row._count._all,
      })),
      topRestaurants,
    };
  },
};
