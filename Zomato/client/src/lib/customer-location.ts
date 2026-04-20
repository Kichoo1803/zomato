import type { CustomerAddress, CustomerLocationLookup } from "@/lib/customer";

export type CustomerActiveLocationSource = "gps" | "map" | "manual" | "default" | "saved";

export type CustomerActiveLocation = CustomerLocationLookup & {
  isTemporary: true;
  source: CustomerActiveLocationSource;
  updatedAt: string;
  addressId?: number | null;
  label?: string | null;
};

const CUSTOMER_ACTIVE_LOCATION_STORAGE_KEY = "zomato-luxe-discovery-location";
const CUSTOMER_ACTIVE_LOCATION_SESSION_STORAGE_KEY = "zomato-luxe-discovery-location-session";
const SESSION_SCOPED_LOCATION_SOURCES = new Set<CustomerActiveLocationSource>(["gps", "map", "manual"]);

const formatLocationText = (...parts: Array<string | null | undefined>) =>
  parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");

export const isValidCoordinate = (value?: number | null, min = -180, max = 180) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

const isValidStoredActiveLocation = (
  value: unknown,
): value is CustomerActiveLocation => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const location = value as Partial<CustomerActiveLocation>;
  return (
    typeof location.address === "string" &&
    location.address.trim().length >= 3 &&
    location.isTemporary === true &&
    ["gps", "map", "manual", "default", "saved"].includes(location.source ?? "") &&
    isValidCoordinate(location.latitude, -90, 90) &&
    isValidCoordinate(location.longitude, -180, 180)
  );
};

export const hasCustomerAddressCoordinates = (
  address?: CustomerAddress | null,
): address is CustomerAddress & { latitude: number; longitude: number } =>
  Boolean(address && isValidCoordinate(address.latitude, -90, 90) && isValidCoordinate(address.longitude, -180, 180));

export const buildCustomerAddressSummary = (address: CustomerAddress) =>
  formatLocationText(address.title, address.houseNo, address.street, address.area, address.city, address.state, address.pincode) ||
  formatLocationText(address.houseNo, address.street, address.area, address.city, address.state, address.pincode) ||
  formatLocationText(address.area, address.city, address.state);

export const createCustomerActiveLocationFromAddress = (
  address: CustomerAddress,
  source: CustomerActiveLocationSource = address.isDefault ? "default" : "saved",
): CustomerActiveLocation | null => {
  if (!hasCustomerAddressCoordinates(address)) {
    return null;
  }

  return {
    latitude: address.latitude,
    longitude: address.longitude,
    address: buildCustomerAddressSummary(address) || address.city,
    isTemporary: true,
    source,
    updatedAt: new Date().toISOString(),
    addressId: address.id,
    label: address.title?.trim() || null,
  };
};

const readLocationFromStorage = (storage: Storage | undefined, key: string) => {
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(key);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    return isValidStoredActiveLocation(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
};

const getSortableTimestamp = (value?: string | null) => {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getMostRecentlyUpdatedSearchableAddress = (addresses: CustomerAddress[]) =>
  [...addresses]
    .filter((address): address is CustomerAddress & { latitude: number; longitude: number } =>
      hasCustomerAddressCoordinates(address),
    )
    .sort((left, right) => {
      const updatedDifference = getSortableTimestamp(right.updatedAt) - getSortableTimestamp(left.updatedAt);
      if (updatedDifference !== 0) {
        return updatedDifference;
      }

      const createdDifference = getSortableTimestamp(right.createdAt) - getSortableTimestamp(left.createdAt);
      if (createdDifference !== 0) {
        return createdDifference;
      }

      return right.id - left.id;
    })[0] ?? null;

export const areCustomerActiveLocationsEqual = (
  left?: CustomerActiveLocation | null,
  right?: CustomerActiveLocation | null,
) =>
  left?.address === right?.address &&
  left?.addressId === right?.addressId &&
  left?.label === right?.label &&
  left?.latitude === right?.latitude &&
  left?.longitude === right?.longitude &&
  left?.source === right?.source;

export const resolvePreferredCustomerActiveLocation = (
  savedAddresses: CustomerAddress[],
  storedLocation?: CustomerActiveLocation | null,
) => {
  if (storedLocation && SESSION_SCOPED_LOCATION_SOURCES.has(storedLocation.source)) {
    return storedLocation;
  }

  const defaultAddress =
    savedAddresses.find((address) => address.isDefault && hasCustomerAddressCoordinates(address)) ?? null;

  if (defaultAddress) {
    return createCustomerActiveLocationFromAddress(defaultAddress, "default");
  }

  if (
    storedLocation?.addressId &&
    (storedLocation.source === "default" || storedLocation.source === "saved")
  ) {
    const matchingAddress = savedAddresses.find((address) => address.id === storedLocation.addressId);
    if (matchingAddress && hasCustomerAddressCoordinates(matchingAddress)) {
      return createCustomerActiveLocationFromAddress(
        matchingAddress,
        matchingAddress.isDefault ? "default" : "saved",
      );
    }
  }

  const lastUsedAddress = getMostRecentlyUpdatedSearchableAddress(savedAddresses);
  if (!lastUsedAddress) {
    return null;
  }

  return createCustomerActiveLocationFromAddress(
    lastUsedAddress,
    lastUsedAddress.isDefault ? "default" : "saved",
  );
};

export const readStoredCustomerActiveLocation = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const sessionLocation = readLocationFromStorage(window.sessionStorage, CUSTOMER_ACTIVE_LOCATION_SESSION_STORAGE_KEY);
  if (sessionLocation) {
    return sessionLocation;
  }

  const persistedLocation = readLocationFromStorage(window.localStorage, CUSTOMER_ACTIVE_LOCATION_STORAGE_KEY);
  if (
    persistedLocation &&
    SESSION_SCOPED_LOCATION_SOURCES.has(persistedLocation.source)
  ) {
    window.localStorage.removeItem(CUSTOMER_ACTIVE_LOCATION_STORAGE_KEY);
    return null;
  }

  return persistedLocation;
};

export const writeStoredCustomerActiveLocation = (location: CustomerActiveLocation) => {
  if (typeof window === "undefined") {
    return;
  }

  if (SESSION_SCOPED_LOCATION_SOURCES.has(location.source)) {
    window.sessionStorage.setItem(CUSTOMER_ACTIVE_LOCATION_SESSION_STORAGE_KEY, JSON.stringify(location));
    return;
  }

  window.sessionStorage.removeItem(CUSTOMER_ACTIVE_LOCATION_SESSION_STORAGE_KEY);
  window.localStorage.setItem(CUSTOMER_ACTIVE_LOCATION_STORAGE_KEY, JSON.stringify(location));
};

export const clearStoredCustomerActiveLocation = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(CUSTOMER_ACTIVE_LOCATION_SESSION_STORAGE_KEY);
  window.localStorage.removeItem(CUSTOMER_ACTIVE_LOCATION_STORAGE_KEY);
};

export const getBrowserGeolocationPermissionState = async () => {
  if (typeof navigator === "undefined" || !("permissions" in navigator) || !navigator.permissions?.query) {
    return null;
  }

  try {
    const permission = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return permission.state;
  } catch {
    return null;
  }
};

export const getBrowserCoordinates = () =>
  new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This browser can't share your location right now."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 8_000,
      },
    );
  });

export const getCustomerLocationErrorMessage = (error: unknown) => {
  if (typeof GeolocationPositionError !== "undefined" && error instanceof GeolocationPositionError) {
    if (error.code === GeolocationPositionError.PERMISSION_DENIED) {
      return "Location permission is turned off. Enable it or enter an address manually to browse nearby restaurants.";
    }

    if (error.code === GeolocationPositionError.POSITION_UNAVAILABLE) {
      return "Your device couldn't determine a precise location right now. Try again in a moment.";
    }

    if (error.code === GeolocationPositionError.TIMEOUT) {
      return "Location lookup took too long. Retry or enter an address manually.";
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Enable location access or enter an address manually to browse nearby restaurants.";
};
