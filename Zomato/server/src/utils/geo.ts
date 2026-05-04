type GeoPoint = {
  latitude?: number | null;
  longitude?: number | null;
};

export type RouteMetrics = {
  distanceKm: number | null;
  durationMinutes: number | null;
  source: "osrm" | "haversine" | "unavailable";
};

const OSRM_ROUTE_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

const isValidCoordinate = (value?: number | null) =>
  typeof value === "number" && Number.isFinite(value);

export const hasCoordinates = (
  point?: GeoPoint | null,
): point is { latitude: number; longitude: number } =>
  Boolean(point && isValidCoordinate(point.latitude) && isValidCoordinate(point.longitude));

export const calculateDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lon2 - lon1);
  const originLat = toRadians(lat1);
  const destinationLat = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) *
      Math.sin(dLng / 2) *
      Math.cos(originLat) *
      Math.cos(destinationLat);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const haversineDistanceKm = (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
) =>
  calculateDistanceKm(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  );

const estimateTravelDurationMinutes = (distanceKm: number) => {
  const averageSpeedKmPerHour = distanceKm > 8 ? 24 : 18;
  return Math.max(6, Math.round((distanceKm / averageSpeedKmPerHour) * 60));
};

const fetchWithTimeout = async (input: string, init?: RequestInit) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

export const getRouteMetrics = async (
  origin?: GeoPoint | null,
  destination?: GeoPoint | null,
): Promise<RouteMetrics> => {
  if (!hasCoordinates(origin) || !hasCoordinates(destination)) {
    return {
      distanceKm: null,
      durationMinutes: null,
      source: "unavailable",
    };
  }

  try {
    const response = await fetchWithTimeout(
      `${OSRM_ROUTE_ENDPOINT}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=false&alternatives=false&steps=false`,
    );

    if (response.ok) {
      const payload = (await response.json()) as {
        routes?: Array<{
          distance?: number;
          duration?: number;
        }>;
      };
      const route = payload.routes?.[0];

      if (route?.distance && route.duration) {
        return {
          distanceKm: Number((route.distance / 1000).toFixed(2)),
          durationMinutes: Math.max(1, Math.round(route.duration / 60)),
          source: "osrm",
        };
      }
    }
  } catch {
    // Fall through to the local approximation so delivery intelligence never blocks order flow.
  }

  const distanceKm = haversineDistanceKm(origin, destination);

  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMinutes: estimateTravelDurationMinutes(distanceKm),
    source: "haversine",
  };
};

export const buildAddressSearchText = (parts: Array<string | null | undefined>) =>
  parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");

export const resolveAddressText = async (addressText: string) => {
  const normalized = addressText.trim();
  if (!normalized) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      limit: "1",
      addressdetails: "1",
      q: normalized,
    });
    const response = await fetchWithTimeout(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "Zomato Luxe/0.1.0 (delivery intelligence)",
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
    }>;
    const result = payload[0];

    if (!result?.lat || !result.lon) {
      return null;
    }

    const latitude = Number(result.lat);
    const longitude = Number(result.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return {
      latitude,
      longitude,
      address: result.display_name?.trim() || normalized,
    };
  } catch {
    return null;
  }
};

export const geocodeAddressText = async (addressText: string) => {
  const resolvedAddress = await resolveAddressText(addressText);

  if (!resolvedAddress) {
    return null;
  }

  return {
    latitude: resolvedAddress.latitude,
    longitude: resolvedAddress.longitude,
  };
};

export const reverseGeocodeCoordinates = async (latitude: number, longitude: number) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(latitude),
      lon: String(longitude),
      addressdetails: "1",
    });
    const response = await fetchWithTimeout(`${NOMINATIM_REVERSE_ENDPOINT}?${params.toString()}`, {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "Zomato Luxe/0.1.0 (location lookup)",
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      display_name?: string;
    };

    const address = payload.display_name?.trim();
    if (!address) {
      return null;
    }

    return {
      latitude,
      longitude,
      address,
    };
  } catch {
    return null;
  }
};
