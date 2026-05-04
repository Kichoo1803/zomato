import {
  DeliveryAvailabilityStatus,
  OrderStatus,
} from "../../constants/enums.js";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { calculateDistanceKm, hasCoordinates } from "../../utils/geo.js";

type RestaurantAssignmentContext = {
  id?: number;
  name?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type EligibleDeliveryPartner = {
  id: number;
  userId: number;
  currentLatitude: number;
  currentLongitude: number;
  lastLocationUpdatedAt: Date | null;
  distanceKm: number;
  activeOrderCount: number;
  user: {
    id: number;
    fullName: string;
    isActive: boolean;
    opsState: string | null;
    opsDistrict: string | null;
  };
};

export type OrderPlacementAvailability = {
  canPlaceOrder: boolean;
  coverageType: "PRIMARY" | "FALLBACK" | "NONE";
  matchedRadiusKm: number | null;
  partnerCount: number;
  primaryRadiusKm: number;
  fallbackRadiusKm: number;
  message: string;
  eligiblePartners: EligibleDeliveryPartner[];
};

export const PRIMARY_ASSIGNMENT_RADIUS_KM = 5;
export const FALLBACK_ASSIGNMENT_RADIUS_KM = 7;
export const ORDER_ASSIGNMENT_RADII_KM = [
  PRIMARY_ASSIGNMENT_RADIUS_KM,
  FALLBACK_ASSIGNMENT_RADIUS_KM,
] as const;
export const NO_DELIVERY_PARTNER_AVAILABLE_MESSAGE =
  "No delivery partner available near this restaurant right now. Please try again later.";

const ACTIVE_DELIVERY_STATUSES = [
  OrderStatus.DELIVERY_PARTNER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.ON_THE_WAY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELAYED,
] as const;

const eligibleAvailabilityStatuses = new Set<string>([
  DeliveryAvailabilityStatus.ONLINE,
  "AVAILABLE",
]);

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
  restaurant: RestaurantAssignmentContext,
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
        in: [...ACTIVE_DELIVERY_STATUSES],
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

export const getEligibleDeliveryPartnersForRestaurant = async (
  restaurant: RestaurantAssignmentContext,
  radiusKm: number,
  options?: {
    excludePartnerIds?: number[];
    maxPartners?: number;
  },
) => {
  const restaurantCoordinates = {
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
  };

  if (!hasCoordinates(restaurantCoordinates)) {
    return [] satisfies EligibleDeliveryPartner[];
  }

  const staleLocationCutoff = new Date(
    Date.now() - env.DELIVERY_ASSIGNMENT_STALE_LOCATION_MINUTES * 60 * 1000,
  );
  const maxPartners =
    options?.maxPartners ?? env.DELIVERY_ASSIGNMENT_MAX_BROADCAST_PARTNERS;
  const boundingBox = buildBoundingBox(
    restaurantCoordinates.latitude,
    restaurantCoordinates.longitude,
    radiusKm,
  );

  const candidates = await prisma.deliveryPartner.findMany({
    where: {
      availabilityStatus: {
        in: [...eligibleAvailabilityStatuses],
      },
      isVerified: true,
      currentLatitude: {
        gte: boundingBox.minLatitude,
        lte: boundingBox.maxLatitude,
      },
      currentLongitude: {
        gte: boundingBox.minLongitude,
        lte: boundingBox.maxLongitude,
      },
      lastLocationUpdatedAt: {
        gte: staleLocationCutoff,
      },
      ...(options?.excludePartnerIds?.length
        ? {
            id: {
              notIn: options.excludePartnerIds,
            },
          }
        : {}),
      user: {
        isActive: true,
        ...(restaurant.state
          ? {
              OR: [{ opsState: null }, { opsState: restaurant.state }],
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
      updatedAt: true,
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
    take: maxPartners * 4,
  });

  const activeOrderCountMap = await getActiveOrderCountMap(
    candidates.map((partner) => partner.id),
  );

  return candidates
    .map((partner) => {
      const partnerCoordinates = {
        latitude: partner.currentLatitude,
        longitude: partner.currentLongitude,
      };

      if (!hasCoordinates(partnerCoordinates)) {
        return null;
      }

      return {
        id: partner.id,
        userId: partner.userId,
        currentLatitude: partnerCoordinates.latitude,
        currentLongitude: partnerCoordinates.longitude,
        lastLocationUpdatedAt: partner.lastLocationUpdatedAt,
        activeOrderCount: activeOrderCountMap.get(partner.id) ?? 0,
        distanceKm: Number(
          calculateDistanceKm(
            restaurantCoordinates.latitude,
            restaurantCoordinates.longitude,
            partnerCoordinates.latitude,
            partnerCoordinates.longitude,
          ).toFixed(2),
        ),
        user: partner.user,
      } satisfies EligibleDeliveryPartner;
    })
    .filter((partner): partner is EligibleDeliveryPartner => Boolean(partner))
    .filter((partner) => {
      if (!matchesServiceZone(partner, restaurant)) {
        return false;
      }

      if (partner.activeOrderCount > 0) {
        return false;
      }

      return partner.distanceKm <= radiusKm;
    })
    .sort((left, right) => {
      if (left.distanceKm !== right.distanceKm) {
        return left.distanceKm - right.distanceKm;
      }

      return left.activeOrderCount - right.activeOrderCount;
    })
    .slice(0, maxPartners);
};

export const previewOrderPlacementAvailability = async (
  restaurant: RestaurantAssignmentContext,
) => {
  for (const radiusKm of ORDER_ASSIGNMENT_RADII_KM) {
    const eligiblePartners = await getEligibleDeliveryPartnersForRestaurant(
      restaurant,
      radiusKm,
    );

    if (!eligiblePartners.length) {
      continue;
    }

    return {
      canPlaceOrder: true,
      coverageType:
        radiusKm === PRIMARY_ASSIGNMENT_RADIUS_KM ? "PRIMARY" : "FALLBACK",
      matchedRadiusKm: radiusKm,
      partnerCount: eligiblePartners.length,
      primaryRadiusKm: PRIMARY_ASSIGNMENT_RADIUS_KM,
      fallbackRadiusKm: FALLBACK_ASSIGNMENT_RADIUS_KM,
      message:
        radiusKm === PRIMARY_ASSIGNMENT_RADIUS_KM
          ? `${eligiblePartners.length} nearby delivery partner${eligiblePartners.length === 1 ? "" : "s"} currently cover this restaurant within ${PRIMARY_ASSIGNMENT_RADIUS_KM} km.`
          : `${eligiblePartners.length} nearby area delivery partner${eligiblePartners.length === 1 ? "" : "s"} currently cover this restaurant within ${FALLBACK_ASSIGNMENT_RADIUS_KM} km.`,
      eligiblePartners,
    } satisfies OrderPlacementAvailability;
  }

  return {
    canPlaceOrder: false,
    coverageType: "NONE",
    matchedRadiusKm: null,
    partnerCount: 0,
    primaryRadiusKm: PRIMARY_ASSIGNMENT_RADIUS_KM,
    fallbackRadiusKm: FALLBACK_ASSIGNMENT_RADIUS_KM,
    message: NO_DELIVERY_PARTNER_AVAILABLE_MESSAGE,
    eligiblePartners: [],
  } satisfies OrderPlacementAvailability;
};
