import { CatalogItemType, OrderStatus, PaymentStatus } from "../../constants/enums.js";
import { prisma } from "../../lib/prisma.js";
import { decimalToNumber } from "../../utils/pricing.js";

const activeOwnerStatuses = [
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

export const ownerAnalyticsService = {
  async getDashboard(userId: number) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const revenueWindowStart = new Date(startOfToday);
    revenueWindowStart.setDate(revenueWindowStart.getDate() - 6);

    const [
      restaurants,
      todaysOrdersCount,
      pendingOrdersCount,
      completedOrdersCount,
      cancelledOrdersCount,
      reviewsCount,
      paidPayments,
      ordersByStatus,
      recentOrders,
      recentReviews,
      dishOrderLines,
      busyHourOrders,
      availabilityAlerts,
    ] = await Promise.all([
      prisma.restaurant.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          area: true,
          avgRating: true,
          totalReviews: true,
          avgDeliveryTime: true,
          preparationTime: true,
          isActive: true,
          openingTime: true,
          closingTime: true,
        },
      }),
      prisma.order.count({
        where: {
          restaurant: {
            ownerId: userId,
          },
          orderedAt: {
            gte: startOfToday,
          },
        },
      }),
      prisma.order.count({
        where: {
          restaurant: {
            ownerId: userId,
          },
          status: {
            in: activeOwnerStatuses,
          },
        },
      }),
      prisma.order.count({
        where: {
          restaurant: {
            ownerId: userId,
          },
          status: OrderStatus.DELIVERED,
        },
      }),
      prisma.order.count({
        where: {
          restaurant: {
            ownerId: userId,
          },
          status: OrderStatus.CANCELLED,
        },
      }),
      prisma.review.count({
        where: {
          restaurant: {
            ownerId: userId,
          },
        },
      }),
      prisma.payment.findMany({
        where: {
          status: PaymentStatus.PAID,
          order: {
            restaurant: {
              ownerId: userId,
            },
          },
        },
        select: {
          amount: true,
          paidAt: true,
          order: {
            select: {
              orderedAt: true,
            },
          },
        },
      }),
      prisma.order.groupBy({
        where: {
          restaurant: {
            ownerId: userId,
          },
        },
        by: ["status"],
        _count: {
          _all: true,
        },
      }),
      prisma.order.findMany({
        where: {
          restaurant: {
            ownerId: userId,
          },
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
      prisma.review.findMany({
        where: {
          restaurant: {
            ownerId: userId,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          rating: true,
          reviewText: true,
          createdAt: true,
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
              profileImage: true,
            },
          },
        },
      }),
      prisma.orderItem.findMany({
        where: {
          itemType: CatalogItemType.MENU_ITEM,
          menuItemId: {
            not: null,
          },
          order: {
            restaurant: {
              ownerId: userId,
            },
            status: {
              notIn: [OrderStatus.CANCELLED, OrderStatus.PAYMENT_FAILED, OrderStatus.REFUNDED],
            },
          },
        },
        select: {
          menuItemId: true,
          itemName: true,
          quantity: true,
          totalPrice: true,
          menuItem: {
            select: {
              id: true,
              name: true,
              isAvailable: true,
              restaurant: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.order.findMany({
        where: {
          restaurant: {
            ownerId: userId,
          },
          status: {
            notIn: [OrderStatus.CANCELLED, OrderStatus.PAYMENT_FAILED, OrderStatus.REFUNDED],
          },
        },
        select: {
          orderedAt: true,
        },
      }),
      prisma.menuItem.findMany({
        where: {
          restaurant: {
            ownerId: userId,
          },
          isAvailable: false,
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 6,
        select: {
          id: true,
          name: true,
          price: true,
          isRecommended: true,
          updatedAt: true,
          restaurant: {
            select: {
              id: true,
              name: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const topDishMap = new Map<
      number,
      {
        id: number;
        name: string;
        restaurant: {
          id: number;
          name: string;
        };
        totalOrders: number;
        revenue: number;
        isAvailable: boolean;
      }
    >();

    for (const line of dishOrderLines) {
      if (!line.menuItem || line.menuItemId == null) {
        continue;
      }

      const existing = topDishMap.get(line.menuItemId);
      if (existing) {
        existing.totalOrders += line.quantity;
        existing.revenue += decimalToNumber(line.totalPrice);
        continue;
      }

      topDishMap.set(line.menuItemId, {
        id: line.menuItem.id,
        name: line.menuItem.name,
        restaurant: {
          id: line.menuItem.restaurant.id,
          name: line.menuItem.restaurant.name,
        },
        totalOrders: line.quantity,
        revenue: decimalToNumber(line.totalPrice),
        isAvailable: line.menuItem.isAvailable,
      });
    }

    const topDishes = [...topDishMap.values()]
      .sort((left, right) => {
        if (right.totalOrders !== left.totalOrders) {
          return right.totalOrders - left.totalOrders;
        }

        return right.revenue - left.revenue;
      })
      .slice(0, 6);

    const revenue = paidPayments.reduce(
      (sum, payment) => sum + decimalToNumber(payment.amount),
      0,
    );
    const averageOrderValue = paidPayments.length ? revenue / paidPayments.length : 0;

    const revenueTrendMap = new Map<string, number>();
    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(revenueWindowStart);
      day.setDate(revenueWindowStart.getDate() + offset);
      revenueTrendMap.set(day.toISOString().slice(0, 10), 0);
    }

    for (const payment of paidPayments) {
      const paymentDate = payment.paidAt ?? payment.order.orderedAt;
      if (paymentDate < revenueWindowStart) {
        continue;
      }

      const key = paymentDate.toISOString().slice(0, 10);
      if (!revenueTrendMap.has(key)) {
        continue;
      }

      revenueTrendMap.set(key, (revenueTrendMap.get(key) ?? 0) + decimalToNumber(payment.amount));
    }

    const revenueTrend = [...revenueTrendMap.entries()].map(([date, value]) => ({
      date,
      label: new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(new Date(date)),
      value,
    }));

    const busyHourMap = new Map<number, number>();
    for (const order of busyHourOrders) {
      const hour = order.orderedAt.getHours();
      busyHourMap.set(hour, (busyHourMap.get(hour) ?? 0) + 1);
    }

    const busyHours = [...busyHourMap.entries()]
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }

        return left[0] - right[0];
      })
      .slice(0, 6)
      .map(([hour, count]) => ({
        hour,
        label: `${String(hour).padStart(2, "0")}:00`,
        count,
      }));

    const prepTimeSummary = restaurants.length
      ? (() => {
          const sortedRestaurants = [...restaurants].sort(
            (left, right) => left.preparationTime - right.preparationTime,
          );

          return {
            averagePreparationTime:
              sortedRestaurants.reduce((sum, restaurant) => sum + restaurant.preparationTime, 0) /
              sortedRestaurants.length,
            fastestRestaurant: sortedRestaurants[0],
            slowestRestaurant: sortedRestaurants.at(-1) ?? sortedRestaurants[0],
          };
        })()
      : {
          averagePreparationTime: 0,
          fastestRestaurant: null,
          slowestRestaurant: null,
        };

    const cancellationBase = pendingOrdersCount + completedOrdersCount + cancelledOrdersCount;
    const cancellationRate = cancellationBase ? cancelledOrdersCount / cancellationBase : 0;

    return {
      stats: {
        restaurantsCount: restaurants.length,
        todaysOrdersCount,
        pendingOrdersCount,
        completedOrdersCount,
        cancelledOrdersCount,
        revenue,
        reviewsCount,
        averageOrderValue,
      },
      restaurants,
      ordersByStatus: ordersByStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      revenueTrend,
      busyHours,
      prepTimeSummary,
      cancellationSummary: {
        cancelledOrdersCount,
        cancellationRate,
      },
      recentOrders: recentOrders.map((order) => ({
        ...order,
        totalAmount: decimalToNumber(order.totalAmount),
      })),
      recentReviews,
      topDishes,
      availabilityAlerts: availabilityAlerts.map((item) => ({
        ...item,
        price: decimalToNumber(item.price),
      })),
    };
  },
};
