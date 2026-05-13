import { NotificationType, OrderStatus, Role } from "../constants/enums.js";
import {
  DELIVERY_PARTNER_PICKUP_RADIUS_KM,
  ORDER_ASSIGNMENT_RADII_KM,
  PRIMARY_DELIVERY_PARTNER_PICKUP_RADIUS_KM,
} from "../constants/location.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { notificationsService } from "../modules/notifications/notifications.service.js";
import { toCoordinateNumber } from "../utils/geo.js";
import {
  buildBoundingBoxFromCoordinates,
  getLatLngFromDeliveryPartner,
  getLatLngFromRestaurant,
  getRoundedDistanceKm,
  normalizeCoordinates as normalizeLatLngCoordinates,
} from "../utils/location.js";

type CoordinateValue = number | string | null | undefined;

type CoordinateInput = {
  latitude?: CoordinateValue;
  longitude?: CoordinateValue;
};

type DeliveryPartnerUserContext = {
  id: number;
  fullName: string;
  isActive: boolean;
  opsState?: string | null;
  opsDistrict?: string | null;
  role?: string | null;
};

type DeliveryPartnerCandidate = {
  id: number;
  userId: number;
  availabilityStatus?: string | null;
  isVerified: boolean;
  currentLatitude?: CoordinateValue;
  currentLongitude?: CoordinateValue;
  lastLocationUpdatedAt?: Date | string | null;
  updatedAt?: Date | null;
  user: DeliveryPartnerUserContext;
};

export type RestaurantAvailabilityContext = {
  id?: number;
  ownerId?: number | null;
  name?: string | null;
  addressLine?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  latitude?: CoordinateValue;
  longitude?: CoordinateValue;
  avgDeliveryTime?: number | null;
  preparationTime?: number | null;
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

export type NearbyRestaurantForPartner = {
  id: number;
  name: string;
  area: string | null;
  addressLine: string | null;
  city: string;
  latitude: number | null;
  longitude: number | null;
  openingTime: string | null;
  closingTime: string | null;
  distanceKm: number;
};

type DeliveryPartnerSkipReason =
  | "INACTIVE_USER"
  | "NOT_APPROVED"
  | "OFFLINE"
  | "MISSING_COORDINATES"
  | "STALE_LOCATION"
  | "AT_CAPACITY"
  | "DISTANCE_UNAVAILABLE"
  | "OUTSIDE_RADIUS";

const DISTANCE_TOLERANCE_KM = 0.05;

const ACTIVE_DELIVERY_STATUSES = [
  OrderStatus.DELIVERY_PARTNER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.ON_THE_WAY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELAYED,
] as const;

export { ORDER_ASSIGNMENT_RADII_KM };

const availableDeliveryPartnerStatuses = new Set<string>([
  "ONLINE",
  "AVAILABLE",
  "ACTIVE",
  "ON_DUTY",
  "READY",
]);

export const PRIMARY_ASSIGNMENT_RADIUS_KM =
  PRIMARY_DELIVERY_PARTNER_PICKUP_RADIUS_KM;

export const FALLBACK_ASSIGNMENT_RADIUS_KM =
  DELIVERY_PARTNER_PICKUP_RADIUS_KM;

export const PARTNER_NEARBY_RESTAURANT_RADIUS_KM =
  DELIVERY_PARTNER_PICKUP_RADIUS_KM;

export const DELIVERY_PARTNER_AVAILABLE_MESSAGE =
  "Delivery partner available nearby";
export const PUBLIC_NO_DELIVERY_PARTNER_AVAILABLE_MESSAGE =
  "No delivery partner available near this restaurant";
export const NO_DELIVERY_PARTNER_AVAILABLE_MESSAGE =
  "No delivery partner available near this restaurant right now. Please try again later.";

const normalizeDeliveryPartnerAvailabilityStatus = (value?: string | null) =>
  value?.trim().replace(/\s+/g, "_").toUpperCase() ?? "";

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

const buildAddressSummary = (parts: Array<string | null | undefined>) =>
  parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");

const buildItemsSummary = (
  items: Array<{
    itemName: string;
    quantity: number;
  }>,
) =>
  items
    .slice(0, 3)
    .map((item) => `${item.quantity}x ${item.itemName}`)
    .join(", ");

const isPartnerLocationFresh = (value?: Date | string | null) => {
  if (!value) {
    return true;
  }

  const updatedAt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(updatedAt.getTime())) {
    return false;
  }

  const staleCutoffMs =
    Date.now() - env.DELIVERY_ASSIGNMENT_STALE_LOCATION_MINUTES * 60 * 1000;
  return updatedAt.getTime() >= staleCutoffMs;
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

const resolveRestaurantContext = async (
  restaurant: number | RestaurantAvailabilityContext,
) => {
  if (typeof restaurant === "number") {
    return getRestaurantAvailabilityContext(restaurant);
  }

  return restaurant;
};

const logDeliveryCoverageDecision = (payload: {
  restaurant: RestaurantAvailabilityContext;
  radiusKm: number;
  partner?: DeliveryPartnerCandidate;
  partnerCoordinates?: { latitude: number; longitude: number } | null;
  distanceKm?: number | null;
  activeOrderCount?: number;
  reasonSkipped?: DeliveryPartnerSkipReason | null;
}) => {
  if (!env.isDevelopment) {
    return;
  }

  const restaurantCoordinates = getLatLngFromRestaurant(payload.restaurant);

  logger.info("Delivery partner restaurant coverage evaluated", {
    restaurantId: payload.restaurant.id ?? null,
    restaurantName: payload.restaurant.name ?? null,
    restaurantLatitude: restaurantCoordinates?.latitude ?? null,
    restaurantLongitude: restaurantCoordinates?.longitude ?? null,
    radiusKm: payload.radiusKm,
    partnerId: payload.partner?.id ?? null,
    partnerUserId: payload.partner?.userId ?? null,
    partnerName: payload.partner?.user.fullName ?? null,
    partnerAvailabilityStatus: payload.partner?.availabilityStatus ?? null,
    partnerLatitude: payload.partnerCoordinates?.latitude ?? null,
    partnerLongitude: payload.partnerCoordinates?.longitude ?? null,
    calculatedDistanceKm:
      payload.distanceKm != null ? Number(payload.distanceKm.toFixed(2)) : null,
    activeOrderCount: payload.activeOrderCount ?? null,
    finalAvailability: payload.reasonSkipped ? "unavailable" : "available",
    reasonSkipped: payload.reasonSkipped ?? null,
  });
};

export const toNumberCoordinate = toCoordinateNumber;

export const isValidCoordinate = (
  latitude?: CoordinateValue,
  longitude?: CoordinateValue,
) => Boolean(normalizeLatLngCoordinates({ latitude, longitude }));

export const normalizeCoordinates = (
  input?: CoordinateInput | null,
) => normalizeLatLngCoordinates(input);

export const getCurrentDeliveryPartnerCoordinates = (partner: {
  currentLatitude?: CoordinateValue;
  currentLongitude?: CoordinateValue;
}) =>
  getLatLngFromDeliveryPartner(partner);

export const isDeliveryPartnerAvailableForOrdersStatus = (value?: string | null) =>
  availableDeliveryPartnerStatuses.has(
    normalizeDeliveryPartnerAvailabilityStatus(value),
  );

export const calculateRestaurantPickupDistanceKm = (
  restaurant: CoordinateInput,
  partner: {
    currentLatitude?: CoordinateValue;
    currentLongitude?: CoordinateValue;
  },
) => {
  const restaurantCoordinates = getLatLngFromRestaurant(restaurant);
  const partnerCoordinates = getCurrentDeliveryPartnerCoordinates(partner);

  return getRoundedDistanceKm(restaurantCoordinates, partnerCoordinates);
};

export const getRestaurantAvailabilityContext = async (
  restaurantId: number,
): Promise<RestaurantAvailabilityContext | null> =>
  prisma.restaurant.findUnique({
    where: { id: restaurantId },
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
      avgDeliveryTime: true,
      preparationTime: true,
    },
  });

export const findAvailableDeliveryPartnersNearRestaurant = async (
  restaurantInput: number | RestaurantAvailabilityContext,
  radiusKm: number = FALLBACK_ASSIGNMENT_RADIUS_KM,
  options?: {
    excludePartnerIds?: number[];
    maxPartners?: number | null;
  },
): Promise<EligibleDeliveryPartner[]> => {
  const restaurant = await resolveRestaurantContext(restaurantInput);
  const restaurantCoordinates = getLatLngFromRestaurant(restaurant);

  if (!restaurant || !restaurantCoordinates) {
    logDeliveryCoverageDecision({
      restaurant: restaurant ?? {
        id: typeof restaurantInput === "number" ? restaurantInput : restaurantInput.id,
      },
      radiusKm,
      reasonSkipped: "DISTANCE_UNAVAILABLE",
    });
    return [];
  }

  const boundingBox = buildBoundingBoxFromCoordinates(
    restaurantCoordinates,
    radiusKm,
    DISTANCE_TOLERANCE_KM,
  );

  const candidates = await prisma.deliveryPartner.findMany({
    where: {
      ...(options?.excludePartnerIds?.length
        ? {
            id: {
              notIn: options.excludePartnerIds,
            },
          }
        : {}),
      user: {
        role: Role.DELIVERY_PARTNER,
      },
      OR: [
        {
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
        },
        {
          currentLatitude: null,
        },
        {
          currentLongitude: null,
        },
      ],
    },
    select: {
      id: true,
      userId: true,
      availabilityStatus: true,
      isVerified: true,
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
          role: true,
        },
      },
    },
    orderBy: [{ lastLocationUpdatedAt: "desc" }, { updatedAt: "desc" }],
  });

  const activeOrderCountMap = await getActiveOrderCountMap(
    candidates.map((candidate) => candidate.id),
  );

  const eligiblePartners = candidates.reduce<EligibleDeliveryPartner[]>(
    (matches, candidate) => {
      const partnerCoordinates = getCurrentDeliveryPartnerCoordinates(candidate);
      const activeOrderCount = activeOrderCountMap.get(candidate.id) ?? 0;

      let reasonSkipped: DeliveryPartnerSkipReason | null = null;
      let distanceKm: number | null = null;

      if (!candidate.user.isActive) {
        reasonSkipped = "INACTIVE_USER";
      } else if (!candidate.isVerified) {
        reasonSkipped = "NOT_APPROVED";
      } else if (
        !isDeliveryPartnerAvailableForOrdersStatus(candidate.availabilityStatus)
      ) {
        reasonSkipped = "OFFLINE";
      } else if (!partnerCoordinates) {
        reasonSkipped = "MISSING_COORDINATES";
      } else if (!isPartnerLocationFresh(candidate.lastLocationUpdatedAt)) {
        reasonSkipped = "STALE_LOCATION";
      } else if (activeOrderCount >= env.DELIVERY_ASSIGNMENT_MAX_ACTIVE_ORDERS) {
        reasonSkipped = "AT_CAPACITY";
      } else {
        const rawDistanceKm = getRoundedDistanceKm(
          restaurantCoordinates,
          partnerCoordinates,
        );

        if (rawDistanceKm == null) {
          reasonSkipped = "DISTANCE_UNAVAILABLE";
        } else {
          distanceKm = rawDistanceKm;

          if (rawDistanceKm > radiusKm + DISTANCE_TOLERANCE_KM) {
            reasonSkipped = "OUTSIDE_RADIUS";
          }
        }
      }

      logDeliveryCoverageDecision({
        restaurant,
        radiusKm,
        partner: candidate,
        partnerCoordinates,
        distanceKm,
        activeOrderCount,
        reasonSkipped,
      });

      if (reasonSkipped || !partnerCoordinates || distanceKm == null) {
        return matches;
      }

      matches.push({
        id: candidate.id,
        userId: candidate.userId,
        currentLatitude: partnerCoordinates.latitude,
        currentLongitude: partnerCoordinates.longitude,
        lastLocationUpdatedAt:
          candidate.lastLocationUpdatedAt instanceof Date
            ? candidate.lastLocationUpdatedAt
            : candidate.lastLocationUpdatedAt
              ? new Date(candidate.lastLocationUpdatedAt)
              : null,
        distanceKm: Number(distanceKm.toFixed(2)),
        activeOrderCount,
        user: {
          id: candidate.user.id,
          fullName: candidate.user.fullName,
          isActive: candidate.user.isActive,
          opsState: candidate.user.opsState ?? null,
          opsDistrict: candidate.user.opsDistrict ?? null,
        },
      });

      return matches;
    },
    [],
  );

  const sortedPartners = eligiblePartners.sort((left, right) => {
    if (left.distanceKm !== right.distanceKm) {
      return left.distanceKm - right.distanceKm;
    }

    if (left.activeOrderCount !== right.activeOrderCount) {
      return left.activeOrderCount - right.activeOrderCount;
    }

    return left.id - right.id;
  });

  if (options?.maxPartners == null || options.maxPartners <= 0) {
    return sortedPartners;
  }

  return sortedPartners.slice(0, options.maxPartners);
};

export const getEligibleDeliveryPartnersForRestaurant =
  findAvailableDeliveryPartnersNearRestaurant;

export const previewRestaurantDeliveryAvailability = async (
  restaurant: RestaurantAvailabilityContext,
) => {
  const restaurantCoordinates = getLatLngFromRestaurant(restaurant);

  if (!restaurantCoordinates) {
    if (env.isDevelopment) {
      logger.info("Restaurant delivery coverage skipped because coordinates are missing", {
        restaurantId: restaurant.id ?? null,
        restaurantName: restaurant.name ?? null,
      });
    }

    return buildUnavailablePlacementAvailability(
      "RESTAURANT_COORDINATES_MISSING",
      "Restaurant coordinates are missing. Delivery availability cannot be checked yet.",
    );
  }

  for (const radiusKm of ORDER_ASSIGNMENT_RADII_KM) {
    const eligiblePartners = await findAvailableDeliveryPartnersNearRestaurant(
      restaurant,
      radiusKm,
    );

    if (!eligiblePartners.length) {
      continue;
    }

    const coverageType =
      radiusKm <= PRIMARY_ASSIGNMENT_RADIUS_KM ? "PRIMARY" : "FALLBACK";

    return {
      canPlaceOrder: true,
      coverageType,
      matchedRadiusKm: radiusKm,
      partnerCount: eligiblePartners.length,
      primaryRadiusKm: PRIMARY_ASSIGNMENT_RADIUS_KM,
      fallbackRadiusKm: FALLBACK_ASSIGNMENT_RADIUS_KM,
      message:
        eligiblePartners.length === 1
          ? `${DELIVERY_PARTNER_AVAILABLE_MESSAGE} within ${radiusKm} km.`
          : `${eligiblePartners.length} delivery partners available nearby within ${radiusKm} km.`,
      reason: null,
      eligiblePartners,
    } satisfies OrderPlacementAvailability;
  }

  return buildUnavailablePlacementAvailability(
    "NO_DELIVERY_PARTNER_AVAILABLE",
    PUBLIC_NO_DELIVERY_PARTNER_AVAILABLE_MESSAGE,
  );
};

export const canRestaurantAcceptDelivery = async (
  restaurantId: number,
): Promise<OrderPlacementAvailability> => {
  const restaurant = await getRestaurantAvailabilityContext(restaurantId);

  if (!restaurant) {
    return buildUnavailablePlacementAvailability(
      "RESTAURANT_NOT_FOUND",
      "Restaurant not found. Delivery availability cannot be checked.",
    );
  }

  return previewRestaurantDeliveryAvailability(restaurant);
};

export const getNearbyRestaurantsForDeliveryPartner = async (
  partner: {
    currentLatitude?: CoordinateValue;
    currentLongitude?: CoordinateValue;
  },
  radiusKm: number = PARTNER_NEARBY_RESTAURANT_RADIUS_KM,
): Promise<NearbyRestaurantForPartner[]> => {
  const partnerCoordinates = getCurrentDeliveryPartnerCoordinates(partner);

  if (!partnerCoordinates) {
    return [];
  }

  const boundingBox = buildBoundingBoxFromCoordinates(
    partnerCoordinates,
    radiusKm,
    DISTANCE_TOLERANCE_KM,
  );

  const restaurants = await prisma.restaurant.findMany({
    where: {
      isActive: true,
      latitude: {
        not: null,
        gte: boundingBox.minLatitude,
        lte: boundingBox.maxLatitude,
      },
      longitude: {
        not: null,
        gte: boundingBox.minLongitude,
        lte: boundingBox.maxLongitude,
      },
    },
    select: {
      id: true,
      name: true,
      addressLine: true,
      area: true,
      city: true,
      latitude: true,
      longitude: true,
      openingTime: true,
      closingTime: true,
    },
  });

  return restaurants
    .map((restaurant) => {
      const distanceKm = calculateRestaurantPickupDistanceKm(restaurant, {
        currentLatitude: partnerCoordinates.latitude,
        currentLongitude: partnerCoordinates.longitude,
      });

      if (distanceKm == null || distanceKm > radiusKm + DISTANCE_TOLERANCE_KM) {
        return null;
      }

      return {
        ...restaurant,
        distanceKm,
      };
    })
    .filter(
      (
        restaurant,
      ): restaurant is NearbyRestaurantForPartner => restaurant !== null,
    )
    .sort((left, right) => left.distanceKm - right.distanceKm);
};

export const notifyNearbyDeliveryPartnersForOrder = async (orderId: number) => {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      restaurant: {
        select: {
          id: true,
          name: true,
          ownerId: true,
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
    },
  });

  if (!order) {
    return {
      orderId,
      notifiedPartnerCount: 0,
      partnerIds: [] as number[],
    };
  }

  const eligiblePartners = await findAvailableDeliveryPartnersNearRestaurant(
    {
      id: order.restaurant.id,
      ownerId: order.restaurant.ownerId,
      name: order.restaurant.name,
      addressLine: order.restaurant.addressLine,
      area: order.restaurant.area,
      city: order.restaurant.city,
      state: order.restaurant.state,
      pincode: order.restaurant.pincode,
      latitude: order.restaurant.latitude,
      longitude: order.restaurant.longitude,
    },
    FALLBACK_ASSIGNMENT_RADIUS_KM,
  );

  if (!eligiblePartners.length) {
    return {
      orderId,
      notifiedPartnerCount: 0,
      partnerIds: [] as number[],
    };
  }

  const pickupSummary =
    buildAddressSummary([
      order.restaurant.addressLine,
      order.restaurant.area,
      order.restaurant.city,
      order.restaurant.state,
      order.restaurant.pincode,
    ]) || order.restaurant.name;
  const deliveryAreaSummary = buildAddressSummary([
    order.address.area,
    order.address.city,
    order.address.state,
    order.address.pincode,
  ]);
  const deliveryAddressSummary = buildAddressSummary([
    order.address.houseNo,
    order.address.street,
    order.address.landmark,
    order.address.area,
    order.address.city,
    order.address.state,
    order.address.pincode,
  ]);
  const itemsSummary = buildItemsSummary(order.items);

  await Promise.all(
    eligiblePartners.map((partner) =>
      notificationsService.createForUser({
        userId: partner.userId,
        title: "New pickup available",
        message: [
          `${order.orderNumber} from ${order.restaurant.name}`,
          `Pickup ${pickupSummary}`,
          deliveryAreaSummary ? `Delivery area ${deliveryAreaSummary}` : null,
          partner.distanceKm != null
            ? `Distance from pickup ${partner.distanceKm.toFixed(1)} km`
            : null,
        ]
          .filter(Boolean)
          .join(" | "),
        type: NotificationType.ORDER,
        dedupeWindowMinutes: 10,
        meta: {
          eventKey: "delivery:pickup:new",
          path: "/delivery/notifications",
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: "NEW_PICKUP_AVAILABLE",
          customerName: order.user.fullName,
          restaurantId: order.restaurant.id,
          restaurantName: order.restaurant.name,
          itemsSummary,
          pickupSummary,
          addressSummary: deliveryAddressSummary,
          deliveryArea: deliveryAreaSummary || null,
          routeDistanceKm: partner.distanceKm,
          pickupCoordinates: {
            latitude: toNumberCoordinate(order.restaurant.latitude),
            longitude: toNumberCoordinate(order.restaurant.longitude),
          },
          deliveryCoordinates: isValidCoordinate(
            order.address.latitude,
            order.address.longitude,
          )
            ? {
                latitude: toNumberCoordinate(order.address.latitude),
                longitude: toNumberCoordinate(order.address.longitude),
              }
            : null,
        },
      }),
    ),
  );

  if (env.isDevelopment) {
    logger.info("Nearby delivery partners notified for placed order", {
      orderId: order.id,
      restaurantId: order.restaurant.id,
      restaurantLatitude: toNumberCoordinate(order.restaurant.latitude),
      restaurantLongitude: toNumberCoordinate(order.restaurant.longitude),
      notifiedPartnerIds: eligiblePartners.map((partner) => partner.id),
      notifiedPartnerCount: eligiblePartners.length,
    });
  }

  return {
    orderId: order.id,
    notifiedPartnerCount: eligiblePartners.length,
    partnerIds: eligiblePartners.map((partner) => partner.id),
  };
};

export const buildUnavailableRestaurantDeliveryCoverage =
  buildUnavailablePlacementAvailability;
