import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { LocationPickerMap } from "@/components/maps/location-picker-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Tabs } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { getApiErrorMessage } from "@/lib/auth";
import {
  buildCustomerAddressSummary,
  clearStoredCustomerActiveLocation,
  createCustomerActiveLocationFromAddress,
  getBrowserCoordinates,
  getBrowserGeolocationPermissionState,
  getCustomerLocationErrorMessage,
  hasCustomerAddressCoordinates,
  readStoredCustomerActiveLocation,
  resolvePreferredCustomerActiveLocation,
  writeStoredCustomerActiveLocation,
  type CustomerActiveLocation,
} from "@/lib/customer-location";
import {
  CUSTOMER_ADDRESSES_UPDATED_EVENT,
  geocodeCustomerLocation,
  getCustomerAddresses,
  reverseGeocodeCustomerLocation,
  type CustomerAddress,
} from "@/lib/customer";

export type SelectedDiscoveryLocation = CustomerActiveLocation;

type DiscoveryLocationContextValue = {
  canManageSavedLocation: boolean;
  errorMessage?: string;
  isBootstrappingLocation: boolean;
  isLoadingSavedAddresses: boolean;
  isResolvingCurrentLocation: boolean;
  isSavingManualLocation: boolean;
  isSavingMapLocation: boolean;
  needsLocation: boolean;
  refreshSavedAddresses: () => void;
  saveMapLocation: (coordinates: { latitude: number; longitude: number }) => Promise<boolean>;
  saveManualLocation: (address: string) => Promise<boolean>;
  savedAddresses: CustomerAddress[];
  selectedLocation: SelectedDiscoveryLocation | null;
  useCurrentLocation: (options?: { silently?: boolean }) => Promise<boolean>;
  useSavedAddress: (address: CustomerAddress) => Promise<boolean>;
};

const DiscoveryLocationContext = createContext<DiscoveryLocationContextValue | null>(null);

const manualDiscoveryLocationSchema = z.object({
  address: z
    .string()
    .trim()
    .min(6, "Enter a fuller address so we can find nearby restaurants.")
    .max(240),
});

type ManualDiscoveryLocationFormValues = z.infer<typeof manualDiscoveryLocationSchema>;

const formatLocationText = (...parts: Array<string | null | undefined>) =>
  parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");

const getSavedAddressLabel = (address: CustomerAddress) =>
  address.title?.trim() ||
  (address.addressType
    ? `${address.addressType.slice(0, 1)}${address.addressType.slice(1).toLowerCase()}`
    : "Saved address");

const useDiscoveryLocationState = (): DiscoveryLocationContextValue => {
  const { user } = useAuth();
  const hasAttemptedAutoCurrentLocation = useRef(false);
  const [reloadSavedAddressesToken, setReloadSavedAddressesToken] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState<SelectedDiscoveryLocation | null>(() =>
    readStoredCustomerActiveLocation(),
  );
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [hasResolvedInitialLocation, setHasResolvedInitialLocation] = useState(
    Boolean(readStoredCustomerActiveLocation()),
  );
  const [isLoadingSavedAddresses, setIsLoadingSavedAddresses] = useState(false);
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] = useState(false);
  const [isSavingManualLocation, setIsSavingManualLocation] = useState(false);
  const [isSavingMapLocation, setIsSavingMapLocation] = useState(false);

  const refreshSavedAddresses = () => {
    setReloadSavedAddressesToken((currentValue) => currentValue + 1);
  };

  const clearLocation = () => {
    setSelectedLocation(null);
    clearStoredCustomerActiveLocation();
  };

  const persistSavedAddressLocation = (address: CustomerAddress) => {
    const nextLocation = createCustomerActiveLocationFromAddress(
      address,
      address.isDefault ? "default" : "saved",
    );

    if (!nextLocation) {
      return null;
    }

    setSelectedLocation(nextLocation);
    setErrorMessage(undefined);
    writeStoredCustomerActiveLocation(nextLocation);
    return nextLocation;
  };

  const persistLocation = (location: Omit<SelectedDiscoveryLocation, "updatedAt">) => {
    const nextLocation: SelectedDiscoveryLocation = {
      ...location,
      updatedAt: new Date().toISOString(),
    };

    setSelectedLocation(nextLocation);
    setErrorMessage(undefined);
    writeStoredCustomerActiveLocation(nextLocation);
    return nextLocation;
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleSavedAddressesUpdated = () => refreshSavedAddresses();
    window.addEventListener(CUSTOMER_ADDRESSES_UPDATED_EVENT, handleSavedAddressesUpdated);

    return () => {
      window.removeEventListener(CUSTOMER_ADDRESSES_UPDATED_EVENT, handleSavedAddressesUpdated);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    hasAttemptedAutoCurrentLocation.current = false;

    if (!user?.id || user.role !== "CUSTOMER") {
      setSavedAddresses([]);
      setIsLoadingSavedAddresses(false);
      setHasResolvedInitialLocation(true);
      return () => {
        isMounted = false;
      };
    }

    setIsLoadingSavedAddresses(true);
    if (!selectedLocation) {
      setHasResolvedInitialLocation(false);
    }

    void getCustomerAddresses()
      .then((addresses) => {
        if (!isMounted) {
          return;
        }

        setSavedAddresses(addresses);
      })
      .catch(() => {
        if (isMounted) {
          setSavedAddresses([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingSavedAddresses(false);
          setHasResolvedInitialLocation(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [reloadSavedAddressesToken, user?.id, user?.role]);

  useEffect(() => {
    if (isLoadingSavedAddresses) {
      return;
    }

    const latestStoredLocation = readStoredCustomerActiveLocation();
    const preferredLocation = resolvePreferredCustomerActiveLocation(savedAddresses, latestStoredLocation);

    if (preferredLocation) {
      if (
        selectedLocation?.address !== preferredLocation.address ||
        selectedLocation?.addressId !== preferredLocation.addressId ||
        selectedLocation?.latitude !== preferredLocation.latitude ||
        selectedLocation?.longitude !== preferredLocation.longitude ||
        selectedLocation?.source !== preferredLocation.source
      ) {
        setSelectedLocation(preferredLocation);
      }

      if (
        latestStoredLocation?.address !== preferredLocation.address ||
        latestStoredLocation?.addressId !== preferredLocation.addressId ||
        latestStoredLocation?.latitude !== preferredLocation.latitude ||
        latestStoredLocation?.longitude !== preferredLocation.longitude ||
        latestStoredLocation?.source !== preferredLocation.source
      ) {
        writeStoredCustomerActiveLocation(preferredLocation);
      }

      return;
    }

    if (selectedLocation?.source === "default" || selectedLocation?.source === "saved") {
      clearLocation();
    }
  }, [isLoadingSavedAddresses, savedAddresses, selectedLocation]);

  const useCurrentLocation = async ({ silently = false }: { silently?: boolean } = {}) => {
    setIsResolvingCurrentLocation(true);
    setErrorMessage(undefined);

    try {
      const coordinates = await getBrowserCoordinates();
      const resolvedLocation = await reverseGeocodeCustomerLocation(coordinates).catch(() => null);

      persistLocation({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        address:
          resolvedLocation?.address?.trim() ||
          `Location near ${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`,
        isTemporary: true,
        source: "gps",
      });

      if (!silently) {
        toast.success("Using your current location for nearby restaurants.");
      }

      return true;
    } catch (error) {
      const message = getCustomerLocationErrorMessage(error);
      setErrorMessage(message);

      if (!silently) {
        toast.error(message);
      }

      return false;
    } finally {
      setIsResolvingCurrentLocation(false);
    }
  };

  const saveManualLocation = async (address: string) => {
    setIsSavingManualLocation(true);
    setErrorMessage(undefined);

    try {
      const resolvedLocation = await geocodeCustomerLocation(address);

      persistLocation({
        latitude: resolvedLocation.latitude,
        longitude: resolvedLocation.longitude,
        address: resolvedLocation.address.trim() || address.trim(),
        isTemporary: true,
        source: "manual",
      });
      toast.success("Nearby restaurants updated for the selected address.");
      return true;
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to resolve this address right now.");
      setErrorMessage(message);
      toast.error(message);
      return false;
    } finally {
      setIsSavingManualLocation(false);
    }
  };

  const saveMapLocation = async (coordinates: { latitude: number; longitude: number }) => {
    setIsSavingMapLocation(true);
    setErrorMessage(undefined);

    try {
      const resolvedLocation = await reverseGeocodeCustomerLocation(coordinates).catch(() => null);

      persistLocation({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        address:
          resolvedLocation?.address?.trim() ||
          `Pinned location near ${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`,
        isTemporary: true,
        source: "map",
      });
      toast.success("Nearby restaurants updated for the selected map location.");
      return true;
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to use this map location right now.");
      setErrorMessage(message);
      toast.error(message);
      return false;
    } finally {
      setIsSavingMapLocation(false);
    }
  };

  const useSavedAddress = async (address: CustomerAddress) => {
    if (!hasCustomerAddressCoordinates(address)) {
      const message = "This saved address needs location details before it can be used for nearby restaurant search.";
      setErrorMessage(message);
      toast.error(message);
      return false;
    }

    persistSavedAddressLocation(address);
    toast.success(
      address.isDefault
        ? "Nearby restaurants updated from your default saved address."
        : "Nearby restaurants updated from the selected saved address.",
    );
    return true;
  };

  useEffect(() => {
    if (
      !user?.id ||
      user.role !== "CUSTOMER" ||
      isLoadingSavedAddresses ||
      selectedLocation ||
      !hasResolvedInitialLocation ||
      hasAttemptedAutoCurrentLocation.current
    ) {
      return;
    }

    hasAttemptedAutoCurrentLocation.current = true;
    let isMounted = true;

    void getBrowserGeolocationPermissionState().then((permissionState) => {
      if (!isMounted || permissionState !== "granted") {
        return;
      }

      void useCurrentLocation({ silently: true });
    });

    return () => {
      isMounted = false;
    };
  }, [hasResolvedInitialLocation, isLoadingSavedAddresses, selectedLocation, user?.id, user?.role]);

  return {
    canManageSavedLocation: user?.role === "CUSTOMER" && Boolean(user.id),
    errorMessage,
    isBootstrappingLocation: !selectedLocation && !hasResolvedInitialLocation,
    isLoadingSavedAddresses,
    isResolvingCurrentLocation,
    isSavingManualLocation,
    isSavingMapLocation,
    needsLocation: !selectedLocation && hasResolvedInitialLocation,
    refreshSavedAddresses,
    saveMapLocation,
    saveManualLocation,
    savedAddresses,
    selectedLocation,
    useCurrentLocation,
    useSavedAddress,
  };
};

export const DiscoveryLocationProvider = ({ children }: PropsWithChildren) => {
  const value = useDiscoveryLocationState();

  return <DiscoveryLocationContext.Provider value={value}>{children}</DiscoveryLocationContext.Provider>;
};

export const useDiscoveryLocation = () => {
  const context = useContext(DiscoveryLocationContext);

  if (!context) {
    throw new Error("useDiscoveryLocation must be used within DiscoveryLocationProvider.");
  }

  return context;
};

type DiscoveryLocationNoticeProps = {
  canManageSavedLocation: boolean;
  errorMessage?: string;
  isBootstrappingLocation?: boolean;
  isResolvingCurrentLocation: boolean;
  onEditAddress: () => void;
  onUseCurrentLocation: () => void;
  selectedLocation: SelectedDiscoveryLocation | null;
};

export const DiscoveryLocationNotice = ({
  canManageSavedLocation,
  errorMessage,
  isBootstrappingLocation,
  isResolvingCurrentLocation,
  onEditAddress,
  onUseCurrentLocation,
  selectedLocation,
}: DiscoveryLocationNoticeProps) => {
  const statusLabel = selectedLocation
    ? selectedLocation.source === "gps"
      ? "Current location"
      : selectedLocation.source === "map"
        ? "Map pin"
        : selectedLocation.source === "default"
          ? "Default address"
          : selectedLocation.source === "saved"
            ? "Saved address"
            : "Temporary address"
    : isBootstrappingLocation
      ? "Checking addresses"
      : "Location required";
  const title = selectedLocation
    ? selectedLocation.source === "default"
      ? "Nearby restaurants are loading from your default delivery address."
      : "Restaurants are filtered from your selected delivery location."
    : isBootstrappingLocation
      ? "Checking your saved delivery addresses before asking for a new location."
      : "Choose a delivery location before browsing restaurants.";
  const description = selectedLocation
    ? selectedLocation.address
    : isBootstrappingLocation
      ? "If a default or previously selected address is available, nearby restaurants will load automatically."
      : "Use a saved address, your current location, or enter an address manually. Restaurants stay hidden until a location is selected.";
  const helperText = isBootstrappingLocation
    ? "Saved delivery locations are checked first so you do not have to choose an address every time."
    : "Nearby restaurants appear only after the delivery area is resolved.";

  return (
    <SurfaceCard>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <StatusPill label={statusLabel} tone={selectedLocation ? "info" : "warning"} />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">{title}</p>
            <p className="text-sm leading-7 text-ink-soft">{description}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">{helperText}</p>
          </div>
          {errorMessage ? <p className="text-sm font-medium text-accent-soft">{errorMessage}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={onUseCurrentLocation} disabled={isResolvingCurrentLocation}>
            {isResolvingCurrentLocation ? "Locating..." : "Use current location"}
          </Button>
          <Button type="button" variant="secondary" onClick={onEditAddress}>
            {selectedLocation ? "Change location" : "Select location"}
          </Button>
          {canManageSavedLocation ? (
            <Link
              to="/addresses"
              className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
            >
              Manage addresses
            </Link>
          ) : null}
        </div>
      </div>
    </SurfaceCard>
  );
};

type LocationSelectionModalProps = {
  canManageSavedLocation: boolean;
  initialAddress?: string;
  initialCoordinates?: {
    latitude: number;
    longitude: number;
  } | null;
  isLoadingSavedAddresses: boolean;
  isResolvingCurrentLocation: boolean;
  isSavingManualLocation: boolean;
  isSavingMapLocation: boolean;
  onClose: () => void;
  onSubmitManualAddress: (address: string) => Promise<boolean>;
  onUseCurrentLocation: () => Promise<boolean>;
  onUseMapLocation: (coordinates: { latitude: number; longitude: number }) => Promise<boolean>;
  onUseSavedAddress: (address: CustomerAddress) => Promise<boolean>;
  open: boolean;
  savedAddresses: CustomerAddress[];
  selectedLocationAddressId?: number | null;
  selectedLocationSource?: SelectedDiscoveryLocation["source"];
};

export const LocationSelectionModal = ({
  canManageSavedLocation,
  initialAddress,
  initialCoordinates,
  isLoadingSavedAddresses,
  isResolvingCurrentLocation,
  isSavingManualLocation,
  isSavingMapLocation,
  onClose,
  onSubmitManualAddress,
  onUseCurrentLocation,
  onUseMapLocation,
  onUseSavedAddress,
  open,
  savedAddresses,
  selectedLocationAddressId,
  selectedLocationSource,
}: LocationSelectionModalProps) => {
  const [activeTab, setActiveTab] = useState<"saved" | "current" | "map" | "manual">("current");
  const [mapCoordinates, setMapCoordinates] = useState(() =>
    initialCoordinates ?? { latitude: 20.5937, longitude: 78.9629 },
  );
  const [hasTouchedMap, setHasTouchedMap] = useState(Boolean(initialCoordinates));
  const form = useForm<ManualDiscoveryLocationFormValues>({
    resolver: zodResolver(manualDiscoveryLocationSchema),
    defaultValues: {
      address: initialAddress ?? "",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      address: initialAddress ?? "",
    });
    setActiveTab(
      savedAddresses.length
        ? selectedLocationSource === "gps"
          ? "current"
          : selectedLocationSource === "map"
            ? "map"
            : selectedLocationSource === "manual"
              ? "manual"
              : "saved"
        : initialCoordinates
          ? "map"
          : initialAddress
            ? "manual"
            : "current",
    );
    setMapCoordinates(initialCoordinates ?? { latitude: 20.5937, longitude: 78.9629 });
    setHasTouchedMap(Boolean(initialCoordinates));
  }, [form, initialAddress, initialCoordinates, open, savedAddresses.length, selectedLocationSource]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const shouldClose = await onSubmitManualAddress(values.address.trim());

    if (shouldClose) {
      onClose();
    }
  });

  const handleUseCurrentLocation = async () => {
    const shouldClose = await onUseCurrentLocation();

    if (shouldClose) {
      onClose();
    }
  };

  const handleUseMapLocation = async () => {
    const shouldClose = await onUseMapLocation(mapCoordinates);

    if (shouldClose) {
      onClose();
    }
  };

  const handleUseSavedAddress = async (address: CustomerAddress) => {
    const shouldClose = await onUseSavedAddress(address);

    if (shouldClose) {
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Select delivery location" className="max-w-3xl">
      <div className="space-y-5">
        <Tabs
          items={[
            ...(canManageSavedLocation ? [{ value: "saved", label: "Saved" }] : []),
            { value: "current", label: "Current" },
            { value: "map", label: "Map" },
            { value: "manual", label: "Manual" },
          ]}
          value={activeTab}
          onChange={(value) => setActiveTab(value as "saved" | "current" | "map" | "manual")}
        />

        {activeTab === "saved" ? (
          <div className="space-y-5">
            <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4 text-sm leading-7 text-ink-soft">
              Your default or last selected saved address is used automatically on load when coordinates are
              available. Choose another saved address here only when you want to switch delivery areas.
            </div>

            {isLoadingSavedAddresses ? (
              <div className="rounded-[1.5rem] bg-cream px-5 py-4 text-sm leading-7 text-ink-soft">
                Loading your saved delivery addresses.
              </div>
            ) : savedAddresses.length ? (
              <div className="grid gap-4">
                {savedAddresses.map((address) => {
                  const isSelected = selectedLocationAddressId === address.id;
                  const isUsable = hasCustomerAddressCoordinates(address);

                  return (
                    <div
                      key={address.id}
                      className={`rounded-[1.5rem] border px-4 py-4 ${
                        isSelected ? "border-accent/20 bg-white shadow-soft" : "border-accent/10 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-ink">{getSavedAddressLabel(address)}</p>
                            {address.isDefault ? <StatusPill label="Default" tone="info" /> : null}
                            {isSelected ? <StatusPill label="Selected" tone="success" /> : null}
                            {!isUsable ? <StatusPill label="Location needed" tone="warning" /> : null}
                          </div>
                          <p className="text-sm leading-7 text-ink-soft">
                            {buildCustomerAddressSummary(address) ||
                              formatLocationText(address.area, address.city, address.state) ||
                              "Saved delivery address"}
                          </p>
                        </div>
                        {isUsable ? (
                          <Button
                            type="button"
                            variant={isSelected ? "secondary" : "primary"}
                            className="px-4 py-2 text-xs"
                            onClick={() => void handleUseSavedAddress(address)}
                            disabled={isSelected}
                          >
                            {isSelected ? "Using this address" : "Use this address"}
                          </Button>
                        ) : (
                          <Link
                            to="/addresses"
                            className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-4 py-2 text-xs font-semibold text-ink shadow-soft"
                          >
                            Fix in manage addresses
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-accent/10 bg-white px-4 py-4">
                <div>
                  <p className="font-semibold text-ink">No saved addresses yet</p>
                  <p className="mt-2 text-sm leading-7 text-ink-soft">
                    Add a default delivery address to skip location selection the next time you open restaurant
                    discovery.
                  </p>
                </div>
                {canManageSavedLocation ? (
                  <Link
                    to="/addresses"
                    className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-4 py-2 text-xs font-semibold text-ink shadow-soft"
                  >
                    Manage addresses
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "current" ? (
          <div className="space-y-5">
            <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4 text-sm leading-7 text-ink-soft">
              Use your device GPS to set the active delivery location. If location access fails, you can switch to map
              or manual entry.
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isResolvingCurrentLocation}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleUseCurrentLocation()}
                disabled={isResolvingCurrentLocation}
              >
                {isResolvingCurrentLocation ? "Locating..." : "Use current location"}
              </Button>
            </div>
          </div>
        ) : null}

        {activeTab === "map" ? (
          <div className="space-y-5">
            <LocationPickerMap
              value={mapCoordinates}
              onChange={(coordinates) => {
                setMapCoordinates(coordinates);
                setHasTouchedMap(true);
              }}
            />
            <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4 text-sm leading-7 text-ink-soft">
              Tap the map or drag the pin to the exact delivery point. Restaurants will refresh from this pin location
              after you confirm it.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.25rem] bg-cream px-4 py-3 text-sm text-ink-soft">
                <span className="font-semibold text-ink">Latitude:</span> {mapCoordinates.latitude.toFixed(5)}
              </div>
              <div className="rounded-[1.25rem] bg-cream px-4 py-3 text-sm text-ink-soft">
                <span className="font-semibold text-ink">Longitude:</span> {mapCoordinates.longitude.toFixed(5)}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSavingMapLocation}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleUseMapLocation()}
                disabled={isSavingMapLocation || !hasTouchedMap}
              >
                {isSavingMapLocation ? "Saving..." : "Use map location"}
              </Button>
            </div>
          </div>
        ) : null}

        {activeTab === "manual" ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Delivery address"
              placeholder="Street, area, city, and pincode"
              error={form.formState.errors.address?.message}
              {...form.register("address")}
            />
            <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4 text-sm leading-7 text-ink-soft">
              This address is stored temporarily for nearby restaurant discovery. It will not replace your saved
              checkout addresses.
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSavingManualLocation}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingManualLocation}>
                {isSavingManualLocation
                  ? "Saving..."
                  : initialAddress
                    ? "Save temporary address"
                    : "Use this address"}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </Modal>
  );
};
