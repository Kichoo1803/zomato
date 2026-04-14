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
      recentOrders,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.restaurant.count(),
      prisma.deliveryPartner.count(),
      prisma.order.count(),
      prisma.order.count({ where: { status: OrderStatus.DELIVERED } }),
      prisma.order.count({
        where: {
          status: {
            in: [
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
            ],
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
      prisma.order.findMany({
        where: {
          deletedAt: null,
        },
        orderBy: { orderedAt: "desc" },
        take: 6,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          orderedAt: true,
          restaurant: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          createdAt: true,
          isActive: true,
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
      recentOrders: recentOrders.map((order) => ({
        ...order,
        totalAmount: decimalToNumber(order.totalAmount),
      })),
      recentUsers,
    };
  },
};
