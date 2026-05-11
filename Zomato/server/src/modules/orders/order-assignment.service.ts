import {
  DeliveryAvailabilityStatus,
  OrderStatus,
  Role,
} from "../../constants/enums.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { calculateDeliveryIntelligence } from "../../utils/order-intelligence.js";
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

type DeliveryAvailabilityRestaurantContext = RestaurantAssignmentContext & {
  avgDeliveryTime?: number | null;
  preparationTime?: number | null;
};

type DeliveryAvailabilityAddressContext = {
  id?: number;
  latitude?: number | null;
  longitude?: number | null;
};

export type DeliveryAvailabilityReason =
  | "RESTAURANT_NOT_FOUND"
  | "RESTAURANT_COORDINATES_MISSING"
  | "NO_DELIVERY_PARTNER_AVAILABLE"
  | null;

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
  reason: DeliveryAvailabilityReason;
  eligiblePartners: EligibleDeliveryPartner[];
};

export type PublicOrderPlacementAvailability = {
  available: boolean;
  canPlaceOrder: boolean;
  coverageType: "PRIMARY" | "FALLBACK" | "NONE";
  matchedRadiusKm: number | null;
  partnerCount: number;
  primaryRadiusKm: number;
  fallbackRadiusKm: number;
  message: string;
  reason: DeliveryAvailabilityReason;
  nearestPartnerId: number | null;
  nearestPartnerName: string | null;
  distanceKm: number | null;
  etaMinutes: number | null;
  nearestPartner: {
    id: number;
    name: string;
    distanceKm: number;
  } | null;
};

export const PRIMARY_ASSIGNMENT_RADIUS_KM = 5;
export const FALLBACK_ASSIGNMENT_RADIUS_KM = 7;
export const ORDER_ASSIGNMENT_RADII_KM = [
  PRIMARY_ASSIGNMENT_RADIUS_KM,
  FALLBACK_ASSIGNMENT_RADIUS_KM,
] as const;
export const DELIVERY_PARTNER_AVAILABLE_MESSAGE = "Delivery partner available";
export const PUBLIC_NO_DELIVERY_PARTNER_AVAILABLE_MESSAGE =
  "No delivery partner available near this restaurant";
export const NO_DELIVERY_PARTNER_AVAILABLE_MESSAGE =
  "No delivery partner available near this restaurant right now. Please try again later.";

const ACTIVE_DELIVERY_STATUSES = [
  OrderStatus.DELIVERY_PARTNER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.ON_THE_WAY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELAYED,
] as const;

const availableDeliveryPartnerStatuses = new Set<string>([
  DeliveryAvailabilityStatus.ONLINE,
  "AVAILABLE",
  "ACTIVE",
  "ON_DUTY",
  "READY",
]);

const normalizeDeliveryPartnerAvailabilityStatus = (value?: string | null) =>
  value?.trim().replace(/\s+/g, "_").toUpperCase() ?? "";

export const isDeliveryPartnerAvailableForOrdersStatus = (value?: string | null) =>
  availableDeliveryPartnerStatuses.has(
    normalizeDeliveryPartnerAvailabilityStatus(value),
  );

const buildFreshLocationWhere = (staleLocationCutoff: Date) => ({
  OR: [
    {
      lastLocationUpdatedAt: {
        gte: staleLocationCutoff,
      },
    },
    {
      lastLocationUpdatedAt: null,
    },
  ],
});

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

const logPreviewAvailabilityResult = (payload: {
  restaurant: RestaurantAssignmentContext;
  radiusKm: number;
  checkedPartnerCount: number;
  eligiblePartnerCount: number;
  nearestPartnerDistanceKm: number | null;
  available: boolean;
  reason?: DeliveryAvailabilityReason;
}) => {
  if (!env.isDevelopment) {
    return;
  }

  logger.info("Payment delivery availability evaluated", {
    restaurantId: payload.restaurant.id ?? null,
    restaurantName: payload.restaurant.name ?? null,
    restaurantLatitude: payload.restaurant.latitude ?? null,
    restaurantLongitude: payload.restaurant.longitude ?? null,
    radiusKm: payload.radiusKm,
    checkedPartnerCount: payload.checkedPartnerCount,
    eligiblePartnerCount: payload.eligiblePartnerCount,
    nearestPartnerDistanceKm: payload.nearestPartnerDistanceKm,
    available: payload.available,
    reason: payload.reason ?? null,
  });
};

const buildUnavailablePlacementAvailability = (
  reason: Exclude<DeliveryAvailabilityReason, null>,
  message: string,
): OrderPlacementAvailability => ({
  canPlaceOrder: false,
  coverageType: "NONE",
  matchedRadiusKm: null,
  partnerCount: 0,
  primaryRadiusKm: PRIMARY_ASSIGNMENT_RADIUS_KM,
  fallbackRadiusKm: FALLBACK_ASSIGNMENT_RADIUS_KM,
  message,
  reason,
  eligiblePartners: [],
});

const loadRestaurantAvailabilityContext = async (
  restaurantId: number,
): Promise<DeliveryAvailabilityRestaurantContext | null> =>
  prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      name: true,
      area: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true,
      avgDeliveryTime: true,
      preparationTime: true,
    },
  });

const loadAddressAvailabilityContext = async (input: {
  addressId?: number;
  userId?: number | null;
}): Promise<DeliveryAvailabilityAddressContext | null> => {
  if (!input.addressId || !input.userId) {
    return null;
  }

  return prisma.address.findFirst({
    where: {
      id: input.addressId,
      userId: input.userId,
      isServiceable: true,
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
    },
  });
};

const calculatePlacementEtaMinutes = async (input: {
  availability: OrderPlacementAvailability;
  restaurant: DeliveryAvailabilityRestaurantContext;
  address?: DeliveryAvailabilityAddressContext | null;
}) => {
  if (!input.availability.canPlaceOrder || !input.address) {
    return null;
  }

  const intelligence = await calculateDeliveryIntelligence({
    status: OrderStatus.PLACED,
    restaurant: input.restaurant,
    address: input.address,
  });

  return intelligence.estimatedDeliveryMinutes ?? null;
};

export const getEligibleDeliveryPartnersForRestaurant = async (
  restaurant: RestaurantAssignmentContext,
  radiusKm: number,
  options?: {
    excludePartnerIds?: number[];
    maxPartners?: number;
  },
): Promise<EligibleDeliveryPartner[]> => {
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
      isVerified: true,
      currentLatitude: {
        not: null,
        gte: boundingBox.minLatitude,
        lte: boundingBox.maxLatitude,
      },
      currentLongitude: {
        not: null,
        gte: boundingBox.minLongitude,
        lte: boundingBox.maxLongitude,
      },
      ...buildFreshLocationWhere(staleLocationCutoff),
      ...(options?.excludePartnerIds?.length
        ? {
            id: {
              notIn: options.excludePartnerIds,
            },
          }
        : {}),
      user: {
        isActive: true,
        role: Role.DELIVERY_PARTNER,
      },
    },
    select: {
      id: true,
      userId: true,
      availabilityStatus: true,
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

  const availabilityMatchedCandidates = candidates.filter((partner) =>
    isDeliveryPartnerAvailableForOrdersStatus(partner.availabilityStatus),
  );

  const activeOrderCountMap = await getActiveOrderCountMap(
    availabilityMatchedCandidates.map((partner) => partner.id),
  );

  const eligiblePartners = availabilityMatchedCandidates.map(
    (partner): EligibleDeliveryPartner | null => {
      const partnerCoordinates = {
        latitude: partner.currentLatitude,
        longitude: partner.currentLongitude,
      };

      if (!hasCoordinates(partnerCoordinates)) {
        return null;
      }

      const distanceKm = calculateDistanceKm(
        restaurantCoordinates.latitude,
        restaurantCoordinates.longitude,
        partnerCoordinates.latitude,
        partnerCoordinates.longitude,
      );

      if (!Number.isFinite(distanceKm)) {
        return null;
      }

      if (env.isDevelopment) {
        logger.info("Delivery partner distance evaluated for restaurant coverage", {
          restaurantId: restaurant.id,
          restaurantLatitude: restaurantCoordinates.latitude,
          restaurantLongitude: restaurantCoordinates.longitude,
          partnerId: partner.id,
          partnerAvailabilityStatus: partner.availabilityStatus,
          partnerLatitude: partnerCoordinates.latitude,
          partnerLongitude: partnerCoordinates.longitude,
          calculatedDistanceKm: Number(distanceKm.toFixed(2)),
        });
      }

      return {
        id: partner.id,
        userId: partner.userId,
        currentLatitude: partnerCoordinates.latitude,
        currentLongitude: partnerCoordinates.longitude,
        lastLocationUpdatedAt: partner.lastLocationUpdatedAt,
        activeOrderCount: activeOrderCountMap.get(partner.id) ?? 0,
        distanceKm: Number(distanceKm.toFixed(2)),
        user: partner.user,
      };
    },
  );

  return eligiblePartners
    .filter((partner): partner is EligibleDeliveryPartner => partner !== null)
    .filter((partner) => {
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
  const restaurantCoordinates = {
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
  };

  if (!hasCoordinates(restaurantCoordinates)) {
    logPreviewAvailabilityResult({
      restaurant,
      radiusKm: FALLBACK_ASSIGNMENT_RADIUS_KM,
      checkedPartnerCount: 0,
      eligiblePartnerCount: 0,
      nearestPartnerDistanceKm: null,
      available: false,
      reason: "RESTAURANT_COORDINATES_MISSING",
    });

    return buildUnavailablePlacementAvailability(
      "RESTAURANT_COORDINATES_MISSING",
      "Restaurant coordinates are missing. Delivery partner coverage cannot be checked yet.",
    );
  }

  for (const radiusKm of ORDER_ASSIGNMENT_RADII_KM) {
    const eligiblePartners = await getEligibleDeliveryPartnersForRestaurant(
      restaurant,
      radiusKm,
    );

    logPreviewAvailabilityResult({
      restaurant,
      radiusKm,
      checkedPartnerCount: eligiblePartners.length,
      eligiblePartnerCount: eligiblePartners.length,
      nearestPartnerDistanceKm: eligiblePartners[0]?.distanceKm ?? null,
      available: eligiblePartners.length > 0,
      reason: eligiblePartners.length ? null : "NO_DELIVERY_PARTNER_AVAILABLE",
    });

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
      reason: null,
      eligiblePartners,
    } satisfies OrderPlacementAvailability;
  }

  return buildUnavailablePlacementAvailability(
    "NO_DELIVERY_PARTNER_AVAILABLE",
    PUBLIC_NO_DELIVERY_PARTNER_AVAILABLE_MESSAGE,
  );
};

export const buildPublicOrderPlacementAvailability = async (input: {
  availability: OrderPlacementAvailability;
  restaurant: DeliveryAvailabilityRestaurantContext;
  address?: DeliveryAvailabilityAddressContext | null;
}): Promise<PublicOrderPlacementAvailability> => {
  const { availability, restaurant, address } = input;
  const nearestPartner = availability.eligiblePartners[0]
    ? {
        id: availability.eligiblePartners[0].id,
        name: availability.eligiblePartners[0].user.fullName,
        distanceKm: availability.eligiblePartners[0].distanceKm,
      }
    : null;
  const etaMinutes = await calculatePlacementEtaMinutes({
    availability,
    restaurant,
    address,
  });

  return {
    available: availability.canPlaceOrder,
    canPlaceOrder: availability.canPlaceOrder,
    coverageType: availability.coverageType,
    matchedRadiusKm: availability.matchedRadiusKm,
    partnerCount: availability.partnerCount,
    primaryRadiusKm: availability.primaryRadiusKm,
    fallbackRadiusKm: availability.fallbackRadiusKm,
    message: availability.message,
    reason: availability.reason,
    nearestPartnerId: nearestPartner?.id ?? null,
    nearestPartnerName: nearestPartner?.name ?? null,
    distanceKm: nearestPartner?.distanceKm ?? null,
    etaMinutes,
    nearestPartner,
  };
};

export const getPublicDeliveryAvailabilityForRestaurant = async (input: {
  restaurantId: number;
  addressId?: number;
  userId?: number | null;
}): Promise<PublicOrderPlacementAvailability> => {
  const restaurant = await loadRestaurantAvailabilityContext(input.restaurantId);

  if (!restaurant) {
    return buildPublicOrderPlacementAvailability({
      availability: buildUnavailablePlacementAvailability(
        "RESTAURANT_NOT_FOUND",
        "Restaurant not found. Delivery availability cannot be checked.",
      ),
      restaurant: {
        id: input.restaurantId,
      },
    });
  }

  const [availability, address] = await Promise.all([
    previewOrderPlacementAvailability(restaurant),
    loadAddressAvailabilityContext({
      addressId: input.addressId,
      userId: input.userId,
    }),
  ]);

  return buildPublicOrderPlacementAvailability({
    availability,
    restaurant,
    address,
  });
};
