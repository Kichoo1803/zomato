import { OrderStatus, PaymentStatus, Role } from "../../constants/enums.js";
import { prisma } from "../../lib/prisma.js";
import { decimalToNumber } from "../../utils/pricing.js";
import { RegistrationApplicationStatus } from "../registration-applications/registration-applications.constants.js";

const activeOrderStatuses = [
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

const startOfDay = (value: Date) => {
  const nextDate = new Date(value);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const endOfDay = (value: Date) => {
  const nextDate = new Date(value);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
};

const getDateRange = (startDate?: string, endDate?: string) => {
  const start = startDate ? startOfDay(new Date(`${startDate}T00:00:00.000Z`)) : null;
  const end = endDate ? endOfDay(new Date(`${endDate}T00:00:00.000Z`)) : null;

  return {
    start,
    end,
  };
};

const toDateFilter = (start?: Date | null, end?: Date | null) => {
  if (!start && !end) {
    return undefined;
  }

  return {
    ...(start ? { gte: start } : {}),
    ...(end ? { lte: end } : {}),
  };
};

const formatDayLabel = (value: Date) =>
  new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(value);

const formatMonthLabel = (value: Date) =>
  new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(value);

const getWeekBucketStart = (value: Date) => {
  const nextDate = startOfDay(value);
  const day = nextDate.getDay();
  const diff = (day + 6) % 7;
  nextDate.setDate(nextDate.getDate() - diff);
  return nextDate;
};

const buildDailyTrend = (dates: Date[]) => {
  const buckets = new Map<string, { date: string; label: string; value: number }>();

  for (let offset = 13; offset >= 0; offset -= 1) {
    const nextDate = startOfDay(new Date());
    nextDate.setDate(nextDate.getDate() - offset);
    const key = nextDate.toISOString().slice(0, 10);
    buckets.set(key, {
      date: key,
      label: formatDayLabel(nextDate),
      value: 0,
    });
  }

  dates.forEach((date) => {
    const key = startOfDay(date).toISOString().slice(0, 10);
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.value += 1;
    }
  });

  return [...buckets.values()];
};

const buildWeeklyTrend = (dates: Date[]) => {
  const buckets = new Map<string, { date: string; label: string; value: number }>();

  for (let offset = 7; offset >= 0; offset -= 1) {
    const nextDate = getWeekBucketStart(new Date());
    nextDate.setDate(nextDate.getDate() - offset * 7);
    const key = nextDate.toISOString().slice(0, 10);
    buckets.set(key, {
      date: key,
      label: `Week of ${formatDayLabel(nextDate)}`,
      value: 0,
    });
  }

  dates.forEach((date) => {
    const bucketStart = getWeekBucketStart(date);
    const key = bucketStart.toISOString().slice(0, 10);
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.value += 1;
    }
  });

  return [...buckets.values()];
};

const buildMonthlyTrend = (dates: Date[]) => {
  const buckets = new Map<string, { date: string; label: string; value: number }>();

  for (let offset = 5; offset >= 0; offset -= 1) {
    const nextDate = new Date();
    nextDate.setDate(1);
    nextDate.setMonth(nextDate.getMonth() - offset);
    const key = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, {
      date: key,
      label: formatMonthLabel(nextDate),
      value: 0,
    });
  }

  dates.forEach((date) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.value += 1;
    }
  });

  return [...buckets.values()];
};

export const adminAnalyticsService = {
  async getDashboard(filters?: {
    regionId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const { start, end } = getDateRange(filters?.startDate, filters?.endDate);
    const orderDateFilter = toDateFilter(start, end);
    const applicationDateFilter = toDateFilter(start, end);
    const userRegionFilter =
      filters?.regionId != null
        ? {
            regionId: filters.regionId,
          }
        : {};
    const restaurantRegionFilter =
      filters?.regionId != null
        ? {
            regionId: filters.regionId,
          }
        : {};
    const paymentRegionFilter =
      filters?.regionId != null
        ? {
            order: {
              restaurant: {
                regionId: filters.regionId,
              },
            },
          }
        : {};
    const orderRegionFilter =
      filters?.regionId != null
        ? {
            restaurant: {
              regionId: filters.regionId,
            },
          }
        : {};

    const [
      usersCount,
      restaurantsCount,
      restaurantOwnersCount,
      deliveryPartnersCount,
      ordersCount,
      deliveredOrders,
      activeOrders,
      revenueAgg,
      ordersByStatus,
      usersByRole,
      applicationsByStatusRows,
      applicationsByRoleRows,
      topRestaurants,
      recentOrders,
      recentUsers,
      regions,
      regionRestaurants,
      regionUsers,
      regionOrders,
      orderTrendRows,
    ] = await Promise.all([
      prisma.user.count({
        where: userRegionFilter,
      }),
      prisma.restaurant.count({
        where: restaurantRegionFilter,
      }),
      prisma.user.count({
        where: {
          role: Role.RESTAURANT_OWNER,
          ...userRegionFilter,
        },
      }),
      prisma.user.count({
        where: {
          role: Role.DELIVERY_PARTNER,
          ...userRegionFilter,
        },
      }),
      prisma.order.count({
        where: {
          deletedAt: null,
          ...orderRegionFilter,
          ...(orderDateFilter ? { orderedAt: orderDateFilter } : {}),
        },
      }),
      prisma.order.count({
        where: {
          deletedAt: null,
          status: OrderStatus.DELIVERED,
          ...orderRegionFilter,
          ...(orderDateFilter ? { orderedAt: orderDateFilter } : {}),
        },
      }),
      prisma.order.count({
        where: {
          deletedAt: null,
          status: {
            in: activeOrderStatuses,
          },
          ...orderRegionFilter,
          ...(orderDateFilter ? { orderedAt: orderDateFilter } : {}),
        },
      }),
      prisma.payment.aggregate({
        where: {
          status: PaymentStatus.PAID,
          ...paymentRegionFilter,
          ...(orderDateFilter
            ? {
                OR: [{ paidAt: orderDateFilter }, { AND: [{ paidAt: null }, { createdAt: orderDateFilter }] }],
            }
            : {}),
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: {
          deletedAt: null,
          ...orderRegionFilter,
          ...(orderDateFilter ? { orderedAt: orderDateFilter } : {}),
        },
        _count: {
          _all: true,
        },
      }),
      prisma.user.groupBy({
        by: ["role"],
        where: userRegionFilter,
        _count: {
          _all: true,
        },
      }),
      prisma.registrationApplication.groupBy({
        by: ["status"],
        where: {
          ...(filters?.regionId != null ? { regionId: filters.regionId } : {}),
          ...(applicationDateFilter ? { createdAt: applicationDateFilter } : {}),
        },
        _count: {
          _all: true,
        },
      }),
      prisma.registrationApplication.groupBy({
        by: ["roleType"],
        where: {
          ...(filters?.regionId != null ? { regionId: filters.regionId } : {}),
          ...(applicationDateFilter ? { createdAt: applicationDateFilter } : {}),
        },
        _count: {
          _all: true,
        },
      }),
      prisma.restaurant.findMany({
        where: restaurantRegionFilter,
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
          ...orderRegionFilter,
          ...(orderDateFilter ? { orderedAt: orderDateFilter } : {}),
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
        where: userRegionFilter,
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
      prisma.region.findMany({
        where:
          filters?.regionId != null
            ? {
                id: filters.regionId,
              }
            : {},
        select: {
          id: true,
          name: true,
          stateName: true,
          districtName: true,
        },
        orderBy: [{ stateName: "asc" }, { districtName: "asc" }],
      }),
      prisma.restaurant.findMany({
        where: {
          regionId:
            filters?.regionId != null
              ? filters.regionId
              : {
                  not: null,
                },
        },
        select: {
          id: true,
          regionId: true,
        },
      }),
      prisma.user.findMany({
        where: {
          regionId:
            filters?.regionId != null
              ? filters.regionId
              : {
                  not: null,
                },
        },
        select: {
          id: true,
          regionId: true,
          role: true,
        },
      }),
      prisma.order.findMany({
        where: {
          deletedAt: null,
          ...orderRegionFilter,
          ...(orderDateFilter ? { orderedAt: orderDateFilter } : {}),
        },
        select: {
          id: true,
          orderedAt: true,
          restaurant: {
            select: {
              regionId: true,
            },
          },
        },
      }),
      prisma.order.findMany({
        where: {
          deletedAt: null,
          ...orderRegionFilter,
          ...(orderDateFilter ? { orderedAt: orderDateFilter } : {}),
        },
        select: {
          orderedAt: true,
        },
      }),
    ]);

    const regionMetricsMap = new Map<
      number,
      {
        regionId: number;
        name: string;
        stateName: string;
        districtName: string;
        restaurantsCount: number;
        deliveryPartnersCount: number;
        usersCount: number;
        ordersCount: number;
      }
    >();

    regions.forEach((region) => {
      regionMetricsMap.set(region.id, {
        regionId: region.id,
        name: region.name,
        stateName: region.stateName,
        districtName: region.districtName,
        restaurantsCount: 0,
        deliveryPartnersCount: 0,
        usersCount: 0,
        ordersCount: 0,
      });
    });

    regionRestaurants.forEach((restaurant) => {
      if (restaurant.regionId == null) {
        return;
      }

      const metric = regionMetricsMap.get(restaurant.regionId);

      if (metric) {
        metric.restaurantsCount += 1;
      }
    });

    regionUsers.forEach((user) => {
      if (user.regionId == null) {
        return;
      }

      const metric = regionMetricsMap.get(user.regionId);

      if (metric) {
        metric.usersCount += 1;

        if (user.role === Role.DELIVERY_PARTNER) {
          metric.deliveryPartnersCount += 1;
        }
      }
    });

    regionOrders.forEach((order) => {
      const regionId = order.restaurant.regionId;

      if (regionId == null) {
        return;
      }

      const metric = regionMetricsMap.get(regionId);

      if (metric) {
        metric.ordersCount += 1;
      }
    });

    return {
      filters: {
        regionId: filters?.regionId ?? null,
        startDate: filters?.startDate ?? null,
        endDate: filters?.endDate ?? null,
      },
      stats: {
        usersCount,
        restaurantsCount,
        restaurantOwnersCount,
        deliveryPartnersCount,
        ordersCount,
        deliveredOrders,
        activeOrders,
        pendingApplicationsCount:
          applicationsByStatusRows.find((row) => row.status === RegistrationApplicationStatus.PENDING)?._count._all ??
          0,
        approvedApplicationsCount:
          applicationsByStatusRows.find((row) => row.status === RegistrationApplicationStatus.APPROVED)?._count
            ._all ?? 0,
        rejectedApplicationsCount:
          applicationsByStatusRows.find((row) => row.status === RegistrationApplicationStatus.REJECTED)?._count
            ._all ?? 0,
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
      applicationsByStatus: applicationsByStatusRows.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      applicationsByRole: applicationsByRoleRows.map((row) => ({
        roleType: row.roleType,
        count: row._count._all,
      })),
      topRestaurants,
      recentOrders: recentOrders.map((order) => ({
        ...order,
        totalAmount: decimalToNumber(order.totalAmount),
      })),
      recentUsers,
      regionMetrics: [...regionMetricsMap.values()].sort((left, right) => {
        if (right.ordersCount !== left.ordersCount) {
          return right.ordersCount - left.ordersCount;
        }

        return left.name.localeCompare(right.name, "en-IN");
      }),
      dailyOrderTrends: buildDailyTrend(orderTrendRows.map((row) => row.orderedAt)),
      weeklyOrderTrends: buildWeeklyTrend(orderTrendRows.map((row) => row.orderedAt)),
      monthlyOrderTrends: buildMonthlyTrend(orderTrendRows.map((row) => row.orderedAt)),
    };
  },
};
