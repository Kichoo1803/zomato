import {
  calculateDistanceKm,
  isValidLatitude,
  isValidLongitude,
  toCoordinateNumber,
} from "./geo.js";

type CoordinateValue = number | string | null | undefined;

export type LatLngPoint = {
  latitude: number;
  longitude: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeLatLngPair = (
  latitude?: CoordinateValue,
  longitude?: CoordinateValue,
): LatLngPoint | null => {
  const normalizedLatitude = toCoordinateNumber(latitude);
  const normalizedLongitude = toCoordinateNumber(longitude);

  if (
    !isValidLatitude(normalizedLatitude) ||
    !isValidLongitude(normalizedLongitude)
  ) {
    return null;
  }

  return {
    latitude: normalizedLatitude,
    longitude: normalizedLongitude,
  };
};

const parseLatLngString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  const parts = normalizedValue.split(",").map((entry) => entry.trim());
  if (parts.length !== 2) {
    return null;
  }

  return normalizeLatLngPair(parts[0], parts[1]);
};

const parseLngLatArray = (value: unknown) => {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  return normalizeLatLngPair(value[1] as CoordinateValue, value[0] as CoordinateValue);
};

const parseCoordinateObject = (
  value: unknown,
  keyPairs: Array<[string, string]>,
) => {
  if (!isRecord(value)) {
    return null;
  }

  for (const [latitudeKey, longitudeKey] of keyPairs) {
    const normalizedCoordinates = normalizeLatLngPair(
      value[latitudeKey] as CoordinateValue,
      value[longitudeKey] as CoordinateValue,
    );

    if (normalizedCoordinates) {
      return normalizedCoordinates;
    }
  }

  return null;
};

const getNestedCoordinateValue = (value: unknown, key: string) =>
  isRecord(value) ? value[key] : undefined;

const parseCoordinateCandidate = (
  value: unknown,
  keyPairs: Array<[string, string]>,
) =>
  parseCoordinateObject(value, keyPairs) ??
  parseLngLatArray(value) ??
  parseLatLngString(value);

export const normalizeCoordinates = (
  input?: {
    latitude?: CoordinateValue;
    longitude?: CoordinateValue;
  } | null,
) => normalizeLatLngPair(input?.latitude, input?.longitude);

export const getLatLngFromRestaurant = (restaurant: unknown): LatLngPoint | null =>
  parseCoordinateCandidate(restaurant, [
    ["latitude", "longitude"],
    ["lat", "lng"],
    ["lat", "lon"],
  ]) ??
  parseCoordinateCandidate(getNestedCoordinateValue(restaurant, "location"), [
    ["latitude", "longitude"],
    ["lat", "lng"],
    ["lat", "lon"],
  ]) ??
  parseCoordinateCandidate(getNestedCoordinateValue(restaurant, "coordinates"), [
    ["latitude", "longitude"],
    ["lat", "lng"],
    ["lat", "lon"],
  ]) ??
  parseCoordinateCandidate(getNestedCoordinateValue(restaurant, "geo"), [
    ["latitude", "longitude"],
    ["lat", "lng"],
    ["lat", "lon"],
  ]) ??
  parseLatLngString(getNestedCoordinateValue(restaurant, "coordinate")) ??
  parseLatLngString(getNestedCoordinateValue(restaurant, "coordinatesText"));

export const getLatLngFromUserLocation = (location: unknown): LatLngPoint | null =>
  parseCoordinateCandidate(location, [
    ["latitude", "longitude"],
    ["lat", "lng"],
    ["lat", "lon"],
  ]) ??
  parseCoordinateCandidate(getNestedCoordinateValue(location, "location"), [
    ["latitude", "longitude"],
    ["lat", "lng"],
    ["lat", "lon"],
  ]) ??
  parseCoordinateCandidate(getNestedCoordinateValue(location, "coordinates"), [
    ["latitude", "longitude"],
    ["lat", "lng"],
    ["lat", "lon"],
  ]) ??
  parseCoordinateCandidate(getNestedCoordinateValue(location, "defaultAddress"), [
    ["latitude", "longitude"],
    ["lat", "lng"],
    ["lat", "lon"],
  ]) ??
  parseCoordinateCandidate(getNestedCoordinateValue(location, "selectedAddress"), [
    ["latitude", "longitude"],
    ["lat", "lng"],
    ["lat", "lon"],
  ]) ??
  parseLatLngString(getNestedCoordinateValue(location, "coordinate")) ??
  parseLatLngString(getNestedCoordinateValue(location, "coordinatesText"));

export const getLatLngFromDeliveryPartner = (
  partner: unknown,
): LatLngPoint | null =>
  parseCoordinateCandidate(partner, [
    ["currentLatitude", "currentLongitude"],
    ["latitude", "longitude"],
    ["lat", "lng"],
    ["currentLat", "currentLng"],
  ]) ??
  parseCoordinateCandidate(getNestedCoordinateValue(partner, "liveLocation"), [
    ["latitude", "longitude"],
    ["lat", "lng"],
    ["currentLatitude", "currentLongitude"],
  ]) ??
  parseCoordinateCandidate(getNestedCoordinateValue(partner, "location"), [
    ["latitude", "longitude"],
    ["lat", "lng"],
    ["currentLatitude", "currentLongitude"],
  ]) ??
  parseCoordinateCandidate(getNestedCoordinateValue(partner, "coordinates"), [
    ["latitude", "longitude"],
    ["lat", "lng"],
    ["currentLatitude", "currentLongitude"],
  ]) ??
  parseLatLngString(getNestedCoordinateValue(partner, "coordinate")) ??
  parseLatLngString(getNestedCoordinateValue(partner, "coordinatesText"));

export const buildBoundingBoxFromCoordinates = (
  origin: LatLngPoint,
  radiusKm: number,
  toleranceKm = 0,
) => {
  const expandedRadiusKm = Math.max(0, radiusKm) + Math.max(0, toleranceKm);
  const latitudeDelta = expandedRadiusKm / 111.32;
  const longitudeDivisor = Math.max(
    Math.cos((origin.latitude * Math.PI) / 180) * 111.32,
    0.01,
  );
  const longitudeDelta = expandedRadiusKm / longitudeDivisor;

  return {
    minLatitude: origin.latitude - latitudeDelta,
    maxLatitude: origin.latitude + latitudeDelta,
    minLongitude: Math.max(-180, origin.longitude - longitudeDelta),
    maxLongitude: Math.min(180, origin.longitude + longitudeDelta),
  };
};

export const getRoundedDistanceKm = (
  origin: LatLngPoint | null,
  destination: LatLngPoint | null,
) => {
  if (!origin || !destination) {
    return null;
  }

  const distanceKm = calculateDistanceKm(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  );

  return Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(2)) : null;
};
