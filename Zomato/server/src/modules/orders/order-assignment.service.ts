import { OrderStatus } from "../../constants/enums.js";
import { prisma } from "../../lib/prisma.js";
import {
  buildUnavailableRestaurantDeliveryCoverage,
  canRestaurantAcceptDelivery,
  DELIVERY_PARTNER_AVAILABLE_MESSAGE,
  FALLBACK_ASSIGNMENT_RADIUS_KM,
  getEligibleDeliveryPartnersForRestaurant,
  getRestaurantAvailabilityContext,
  isDeliveryPartnerAvailableForOrdersStatus,
  NO_DELIVERY_PARTNER_AVAILABLE_MESSAGE,
  ORDER_ASSIGNMENT_RADII_KM,
  previewRestaurantDeliveryAvailability,
  PRIMARY_ASSIGNMENT_RADIUS_KM,
  PUBLIC_NO_DELIVERY_PARTNER_AVAILABLE_MESSAGE,
  toNumberCoordinate,
  type DeliveryAvailabilityReason,
  type EligibleDeliveryPartner,
  type OrderPlacementAvailability,
  type RestaurantAvailabilityContext,
} from "../../services/delivery-partner-availability.service.js";
import { calculateDeliveryIntelligence } from "../../utils/order-intelligence.js";

export type DeliveryAvailabilityRestaurantContext = RestaurantAvailabilityContext;

type DeliveryAvailabilityAddressContext = {
  id?: number;
  latitude?: number | null;
  longitude?: number | null;
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
    restaurant: {
      latitude: input.restaurant.latitude != null ? toNumberCoordinate(input.restaurant.latitude) : null,
      longitude: input.restaurant.longitude != null ? toNumberCoordinate(input.restaurant.longitude) : null,
      preparationTime: input.restaurant.preparationTime ?? null,
      avgDeliveryTime: input.restaurant.avgDeliveryTime ?? null,
    },
    address: input.address,
  });

  return intelligence.estimatedDeliveryMinutes ?? null;
};

export const buildPublicOrderPlacementAvailability = async (input: {
  availability: OrderPlacementAvailability;
  restaurant: DeliveryAvailabilityRestaurantContext;
  address?: DeliveryAvailabilityAddressContext | null;
}): Promise<PublicOrderPlacementAvailability> => {
  const nearestPartner = input.availability.eligiblePartners[0]
    ? {
        id: input.availability.eligiblePartners[0].id,
        name: input.availability.eligiblePartners[0].user.fullName,
        distanceKm: input.availability.eligiblePartners[0].distanceKm,
      }
    : null;
  const etaMinutes = await calculatePlacementEtaMinutes({
    availability: input.availability,
    restaurant: input.restaurant,
    address: input.address,
  });

  return {
    available: input.availability.canPlaceOrder,
    canPlaceOrder: input.availability.canPlaceOrder,
    coverageType: input.availability.coverageType,
    matchedRadiusKm: input.availability.matchedRadiusKm,
    partnerCount: input.availability.partnerCount,
    primaryRadiusKm: input.availability.primaryRadiusKm,
    fallbackRadiusKm: input.availability.fallbackRadiusKm,
    message: input.availability.message,
    reason: input.availability.reason,
    nearestPartnerId: nearestPartner?.id ?? null,
    nearestPartnerName: nearestPartner?.name ?? null,
    distanceKm: nearestPartner?.distanceKm ?? null,
    etaMinutes,
    nearestPartner,
  };
};

export const previewOrderPlacementAvailability =
  previewRestaurantDeliveryAvailability;

export const getPublicDeliveryAvailabilityForRestaurant = async (input: {
  restaurantId: number;
  addressId?: number;
  userId?: number | null;
}): Promise<PublicOrderPlacementAvailability> => {
  const restaurant = await getRestaurantAvailabilityContext(input.restaurantId);

  if (!restaurant) {
    return buildPublicOrderPlacementAvailability({
      availability: buildUnavailableRestaurantDeliveryCoverage(
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

export {
  canRestaurantAcceptDelivery,
  DELIVERY_PARTNER_AVAILABLE_MESSAGE,
  FALLBACK_ASSIGNMENT_RADIUS_KM,
  getEligibleDeliveryPartnersForRestaurant,
  isDeliveryPartnerAvailableForOrdersStatus,
  NO_DELIVERY_PARTNER_AVAILABLE_MESSAGE,
  ORDER_ASSIGNMENT_RADII_KM,
  PRIMARY_ASSIGNMENT_RADIUS_KM,
  PUBLIC_NO_DELIVERY_PARTNER_AVAILABLE_MESSAGE,
};

export type {
  DeliveryAvailabilityReason,
  EligibleDeliveryPartner,
  OrderPlacementAvailability,
};
