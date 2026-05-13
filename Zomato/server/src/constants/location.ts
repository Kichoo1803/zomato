import { env } from "../config/env.js";

const parseConfiguredRadiiKm = (value?: string | null) => {
  const radiiKm = (value ?? "")
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry > 0)
    .sort((left, right) => left - right);

  return [...new Set(radiiKm)];
};

export const CUSTOMER_RESTAURANT_RADIUS_KM = Math.min(
  env.RESTAURANT_DISCOVERY_DEFAULT_RADIUS_KM,
  env.RESTAURANT_DISCOVERY_MAX_RADIUS_KM,
);

export const MAX_CUSTOMER_RESTAURANT_RADIUS_KM = Math.max(
  env.RESTAURANT_DISCOVERY_DEFAULT_RADIUS_KM,
  env.RESTAURANT_DISCOVERY_MAX_RADIUS_KM,
);

const configuredPickupRadiiKm = parseConfiguredRadiiKm(
  process.env.DELIVERY_ASSIGNMENT_RADII_KM ?? env.DELIVERY_ASSIGNMENT_RADII_KM,
);

export const ORDER_ASSIGNMENT_RADII_KM =
  configuredPickupRadiiKm.length > 0 ? configuredPickupRadiiKm : [3];

export const PRIMARY_DELIVERY_PARTNER_PICKUP_RADIUS_KM =
  ORDER_ASSIGNMENT_RADII_KM[0] ?? 3;

export const DELIVERY_PARTNER_PICKUP_RADIUS_KM =
  ORDER_ASSIGNMENT_RADII_KM[ORDER_ASSIGNMENT_RADII_KM.length - 1] ?? 3;
