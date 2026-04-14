import { OrderStatus } from "../constants/enums.js";
import { getRouteMetrics, hasCoordinates, type RouteMetrics } from "./geo.js";

type RestaurantContext = {
  latitude?: number | null;
  longitude?: number | null;
  preparationTime?: number | null;
  avgDeliveryTime?: number | null;
};

type AddressContext = {
  latitude?: number | null;
  longitude?: number | null;
};

type DeliveryPartnerContext = {
  currentLatitude?: number | null;
  currentLongitude?: number | null;
};

export type DeliveryIntelligence = {
  routeDistanceKm: number | null;
  travelDurationMinutes: number | null;
  estimatedDeliveryMinutes: number | null;
  trafficDelayMinutes: number;
  weatherDelayMinutes: number;
  delayMinutes: number;
  routeSource: RouteMetrics["source"];
};

const pickupStatuses = new Set<string>([
  OrderStatus.DELIVERY_PARTNER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.ON_THE_WAY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELAYED,
]);

const noPrepStatuses = new Set<string>([
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.LOOKING_FOR_DELIVERY_PARTNER,
  OrderStatus.DELIVERY_PARTNER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.ON_THE_WAY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELAYED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
  OrderStatus.PAYMENT_FAILED,
]);

const closedStatuses = new Set<string>([
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
  OrderStatus.PAYMENT_FAILED,
]);

const getRemainingPreparationMinutes = (
  restaurantPreparationTime: number,
  status: string,
) => {
  if (noPrepStatuses.has(status)) {
    return 0;
  }

  if (status === OrderStatus.PREPARING) {
    return Math.max(4, Math.ceil(restaurantPreparationTime * 0.55));
  }

  if (status === OrderStatus.CONFIRMED || status === OrderStatus.ACCEPTED) {
    return Math.max(6, Math.ceil(restaurantPreparationTime * 0.8));
  }

  return restaurantPreparationTime;
};

const getTrafficDelayMinutes = (distanceKm: number, timestamp: Date) => {
  const hour = timestamp.getHours();
  const rushFactor = (hour >= 12 && hour <= 14) || (hour >= 19 && hour <= 22) ? 4 : 1;

  if (distanceKm >= 10) {
    return rushFactor + 5;
  }

  if (distanceKm >= 5) {
    return rushFactor + 2;
  }

  return rushFactor;
};

const getWeatherDelayMinutes = (timestamp: Date) => {
  const month = timestamp.getMonth() + 1;
  return month >= 6 && month <= 9 ? 3 : 0;
};

const getManualDelayMinutes = (status: string) => (status === OrderStatus.DELAYED ? 8 : 0);

export const calculateDeliveryIntelligence = async ({
  status,
  restaurant,
  address,
  deliveryPartner,
}: {
  status: string;
  restaurant: RestaurantContext;
  address: AddressContext;
  deliveryPartner?: DeliveryPartnerContext | null;
}): Promise<DeliveryIntelligence> => {
  const now = new Date();
  const restaurantPreparationTime =
    typeof restaurant.preparationTime === "number" && restaurant.preparationTime > 0
      ? restaurant.preparationTime
      : 20;

  const shouldUsePartnerOrigin =
    pickupStatuses.has(status) &&
    hasCoordinates({
      latitude: deliveryPartner?.currentLatitude,
      longitude: deliveryPartner?.currentLongitude,
    });

  const origin = shouldUsePartnerOrigin
    ? {
        latitude: deliveryPartner?.currentLatitude ?? null,
        longitude: deliveryPartner?.currentLongitude ?? null,
      }
    : restaurant;

  const route = await getRouteMetrics(origin, address);
  const trafficDelayMinutes =
    route.distanceKm !== null ? getTrafficDelayMinutes(route.distanceKm, now) : 0;
  const weatherDelayMinutes = route.distanceKm !== null ? getWeatherDelayMinutes(now) : 0;
  const delayMinutes = getManualDelayMinutes(status);
  const remainingPreparationMinutes = getRemainingPreparationMinutes(
    restaurantPreparationTime,
    status,
  );
  const travelDurationMinutes =
    route.durationMinutes ??
    (typeof restaurant.avgDeliveryTime === "number" ? restaurant.avgDeliveryTime : null);
  const estimatedDeliveryMinutes =
    closedStatuses.has(status)
      ? 0
      : travelDurationMinutes === null
      ? remainingPreparationMinutes || null
      : remainingPreparationMinutes +
        travelDurationMinutes +
        trafficDelayMinutes +
        weatherDelayMinutes +
        delayMinutes;

  return {
    routeDistanceKm: route.distanceKm,
    travelDurationMinutes,
    estimatedDeliveryMinutes,
    trafficDelayMinutes,
    weatherDelayMinutes,
    delayMinutes,
    routeSource: route.source,
  };
};
