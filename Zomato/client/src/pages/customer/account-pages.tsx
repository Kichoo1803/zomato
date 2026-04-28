import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, Edit3, LocateFixed, MapPin, MapPinned, Sparkles, Trash2, Wallet } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDangerModal } from "@/components/admin/admin-ui";
import { LocationPickerMap } from "@/components/maps/location-picker-map";
import { NotificationFeed } from "@/components/notifications/notification-feed";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { IndianPhoneInput } from "@/components/ui/indian-phone-input";
import { Modal } from "@/components/ui/modal";
import { PageShell, SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationInbox } from "@/hooks/use-notification-inbox";
import { getApiErrorMessage, logoutFromServer } from "@/lib/auth";
import {
  areCustomerActiveLocationsEqual,
  clearStoredCustomerActiveLocation,
  createCustomerActiveLocationFromAddress,
  getBrowserCoordinates,
  getCustomerLocationErrorMessage,
  hasCustomerAddressCoordinates,
  readStoredCustomerActiveLocation,
  resolvePreferredCustomerActiveLocation,
  writeStoredCustomerActiveLocation,
  type CustomerActiveLocationSource,
  type CustomerActiveLocation,
} from "@/lib/customer-location";
import {
  createCustomerAddress,
  deleteCustomerPaymentMethod,
  deleteCustomerAddress,
  createCustomerPaymentMethod,
  getCustomerAddresses,
  getCustomerPaymentMethods,
  geocodeCustomerLocation,
  reverseGeocodeCustomerLocation,
  setDefaultCustomerSavedPaymentMethod,
  type CustomerAddress,
  type CustomerAddressPayload,
  type CustomerPaymentMethod,
  type CustomerPaymentMethodPayload,
  updateCustomerAddress,
  updateCustomerPaymentMethod,
  updateCustomerProfile,
} from "@/lib/customer";
import { useAuthStore } from "@/store/auth.store";
import type { AuthUser, MembershipStatus, MembershipTier } from "@/types/auth";
import { walletTransactions } from "@/lib/demo-data";
import {
  formatIndianPhoneDisplay,
  getIndianPhoneInputValue,
  optionalIndianPhoneSchema,
  requiredIndianPhoneSchema,
} from "@/lib/phone";
import { cn } from "@/utils/cn";

const linkButtonClassName =
  "inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft";

const getMembershipTierLabel = (tier?: MembershipTier | null) => {
  switch (tier) {
    case "PLATINUM":
      return "Luxe Circle Platinum";
    case "GOLD":
      return "Luxe Circle Gold";
    case "CLASSIC":
    default:
      return "Luxe Circle Classic";
  }
};

const getMembershipStatusLabel = (status?: MembershipStatus | null) => {
  switch (status) {
    case "EXPIRED":
      return "Expired";
    case "INACTIVE":
      return "Inactive";
    case "ACTIVE":
    default:
      return "Active";
  }
};

const getMembershipStatusTone = (status?: MembershipStatus | null) => {
  switch (status) {
    case "EXPIRED":
    case "INACTIVE":
      return "warning" as const;
    case "ACTIVE":
    default:
      return "success" as const;
  }
};

const getMembershipDescription = (tier?: MembershipTier | null) => {
  switch (tier) {
    case "PLATINUM":
      return "Your account now carries the highest-tier delivery, offer, and dining perks available in the current customer experience.";
    case "GOLD":
      return "Priority delivery windows, curated member-only offers, and elevated reservation access stay attached to the customer account area.";
    case "CLASSIC":
    default:
      return "You are on the entry membership tier right now, with the option to upgrade whenever you want richer dining perks.";
  }
};

const formatMembershipDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
      }).format(new Date(value))
    : "Not scheduled";

const ADDRESS_TYPE_OPTIONS = [
  { value: "HOME", label: "Home" },
  { value: "WORK", label: "Work" },
  { value: "OTHER", label: "Other" },
] as const;

const addressFormSchema = z.object({
  addressType: z.enum(["HOME", "WORK", "OTHER"]),
  title: z.string().trim().max(80).optional().or(z.literal("")),
  recipientName: z.string().trim().min(2, "Recipient name is required.").max(120),
  contactPhone: requiredIndianPhoneSchema("Enter a valid 10-digit contact phone number."),
  houseNo: z.string().trim().max(80).optional().or(z.literal("")),
  street: z.string().trim().min(2, "Street or area is required.").max(150),
  landmark: z.string().trim().max(150).optional().or(z.literal("")),
  area: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required.").max(120),
  state: z.string().trim().min(2, "State is required.").max(120),
  pincode: z.string().trim().min(4, "Pincode is required.").max(20),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().default(false),
  useForSearch: z.boolean().default(true),
});

const profileFormSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(120),
  email: z.string().trim().email("Enter a valid email."),
  phone: optionalIndianPhoneSchema().or(z.literal("")),
  profileImage: z.string().trim().url("Enter a valid image URL.").or(z.literal("")),
});

const paymentMethodFormSchema = z
  .object({
    type: z.enum(["CARD", "UPI"]),
    label: z.string().trim().max(40).optional().or(z.literal("")),
    holderName: z.string().trim().max(80).optional().or(z.literal("")),
    maskedEnding: z.string().trim().regex(/^\d{4}$/, "Enter the last 4 digits only.").or(z.literal("")),
    cardBrand: z.string().trim().max(30).optional().or(z.literal("")),
    expiryMonth: z.string().trim().regex(/^(0[1-9]|1[0-2])$/, "Use a valid month like 08.").or(z.literal("")),
    expiryYear: z.string().trim().regex(/^\d{2,4}$/, "Use a valid expiry year.").or(z.literal("")),
    upiId: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/, "Enter a valid UPI ID.")
      .or(z.literal("")),
    isPrimary: z.boolean().default(true),
  })
  .superRefine((values, context) => {
    if (values.type === "CARD") {
      if (!values.label?.trim()) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Card label is required.", path: ["label"] });
      }

      if (!values.holderName?.trim()) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Card holder name is required.", path: ["holderName"] });
      }

      if (!values.maskedEnding.trim()) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter the last 4 digits only.", path: ["maskedEnding"] });
      }

      if (!values.expiryMonth.trim()) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Use a valid month like 08.", path: ["expiryMonth"] });
      }

      if (!values.expiryYear.trim()) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Use a valid expiry year.", path: ["expiryYear"] });
      }
    }

    if (values.type === "UPI" && !values.upiId.trim()) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid UPI ID.", path: ["upiId"] });
    }
  });

type AddressFormValues = z.infer<typeof addressFormSchema>;
type ProfileFormValues = z.infer<typeof profileFormSchema>;
type PaymentMethodFormValues = z.infer<typeof paymentMethodFormSchema>;
type SavedPaymentMethodTab = "CARD" | "UPI";

const PAYMENT_METHOD_TYPE_OPTIONS = [
  { value: "CARD", label: "Card" },
  { value: "UPI", label: "UPI" },
] as const;

const toAddressLabel = (addressType: string) =>
  ADDRESS_TYPE_OPTIONS.find((option) => option.value === addressType)?.label ?? "Address";

const normalizeOptional = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : "";
};

const mapProfileToFormValues = (user: AuthUser | null): ProfileFormValues => ({
  fullName: normalizeOptional(user?.fullName),
  email: normalizeOptional(user?.email),
  phone: getIndianPhoneInputValue(user?.phone),
  profileImage: normalizeOptional(user?.profileImage),
});

const mapPaymentMethodToFormValues = (
  paymentMethod: CustomerPaymentMethod | null,
  defaultHolderName?: string | null,
  forcedType: SavedPaymentMethodTab = paymentMethod?.type ?? "CARD",
): PaymentMethodFormValues => ({
  type: paymentMethod?.type ?? forcedType,
  label: normalizeOptional(paymentMethod?.label),
  holderName:
    (paymentMethod?.type ?? forcedType) === "CARD"
      ? normalizeOptional(paymentMethod?.cardholderName ?? paymentMethod?.holderName) || normalizeOptional(defaultHolderName)
      : normalizeOptional(defaultHolderName),
  maskedEnding: normalizeOptional(paymentMethod?.cardLast4 ?? paymentMethod?.maskedEnding),
  cardBrand: normalizeOptional(paymentMethod?.cardBrand),
  expiryMonth: normalizeOptional(paymentMethod?.expiryMonth),
  expiryYear: normalizeOptional(paymentMethod?.expiryYear),
  upiId: normalizeOptional(paymentMethod?.upiId),
  isPrimary: paymentMethod?.isDefault ?? paymentMethod?.isPrimary ?? true,
});

const mapAddressToFormValues = (
  address: CustomerAddress | null,
  defaults?: {
    recipientName?: string | null;
    contactPhone?: string | null;
    useForSearch?: boolean;
  },
): AddressFormValues => ({
  addressType: (address?.addressType as AddressFormValues["addressType"] | undefined) ?? "HOME",
  title: normalizeOptional(address?.title),
  recipientName: normalizeOptional(address?.recipientName) || normalizeOptional(defaults?.recipientName),
  contactPhone: getIndianPhoneInputValue(address?.contactPhone) || getIndianPhoneInputValue(defaults?.contactPhone),
  houseNo: normalizeOptional(address?.houseNo),
  street: normalizeOptional(address?.street),
  landmark: normalizeOptional(address?.landmark),
  area: normalizeOptional(address?.area),
  city: normalizeOptional(address?.city),
  state: normalizeOptional(address?.state),
  pincode: normalizeOptional(address?.pincode),
  latitude: address?.latitude ?? undefined,
  longitude: address?.longitude ?? undefined,
  isDefault: address?.isDefault ?? false,
  useForSearch: defaults?.useForSearch ?? false,
});

const toAddressPayload = (values: AddressFormValues): CustomerAddressPayload => {
  const trimOptional = (value?: string) => {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  };

  return {
    addressType: values.addressType,
    title: trimOptional(values.title),
    recipientName: values.recipientName.trim(),
    contactPhone: values.contactPhone.trim(),
    houseNo: trimOptional(values.houseNo),
    street: values.street.trim(),
    landmark: trimOptional(values.landmark),
    area: trimOptional(values.area),
    city: values.city.trim(),
    state: values.state.trim(),
    pincode: values.pincode.trim(),
    latitude: values.latitude,
    longitude: values.longitude,
    isDefault: values.isDefault,
  };
};

const buildAddressSearchText = (values: AddressFormValues) =>
  [
    values.houseNo,
    values.street,
    values.landmark,
    values.area,
    values.city,
    values.state,
    values.pincode,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(", ");

const getAddressHeading = (address: CustomerAddress) =>
  address.title?.trim() || toAddressLabel(address.addressType);

const getAddressSubtitle = (address: CustomerAddress) => {
  if (address.isDefault) {
    return "Default delivery address";
  }

  const identity = [address.recipientName, formatIndianPhoneDisplay(address.contactPhone)].filter(Boolean).join(" • ");
  return identity || "Saved delivery address";
};

const getAddressLines = (address: CustomerAddress) => ({
  line1: [address.houseNo, address.street].filter(Boolean).join(", ") || address.street || address.city,
  line2: [address.landmark, address.area, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(", "),
});

const getAddressLocationStatus = (address: CustomerAddress) =>
  hasCustomerAddressCoordinates(address)
    ? {
        label: "Ready for search",
        tone: "success" as const,
        message: "This address has usable coordinates and can drive nearby restaurant discovery.",
      }
    : {
        label: "Location needed",
        tone: "warning" as const,
        message: "Add location details to use this address for food search and nearby restaurant delivery.",
      };

const getAddressCoordinateSummary = (address: CustomerAddress) =>
  hasCustomerAddressCoordinates(address)
    ? `${address.latitude.toFixed(5)}, ${address.longitude.toFixed(5)}`
    : "Coordinates not set";

const hasResolvedFormCoordinates = (values: { latitude?: number; longitude?: number }) =>
  typeof values.latitude === "number" &&
  Number.isFinite(values.latitude) &&
  typeof values.longitude === "number" &&
  Number.isFinite(values.longitude);

const DEFAULT_MAP_COORDINATES = { latitude: 20.5937, longitude: 78.9629 };

const AddressFormModal = ({
  open,
  address,
  defaultRecipientName,
  defaultPhone,
  defaultUseForSearch,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  address: CustomerAddress | null;
  defaultRecipientName?: string | null;
  defaultPhone?: string | null;
  defaultUseForSearch?: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: AddressFormValues) => Promise<void>;
}) => {
  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: mapAddressToFormValues(address, {
      recipientName: defaultRecipientName,
      contactPhone: defaultPhone,
      useForSearch: defaultUseForSearch,
    }),
  });
  const [activeLocationTab, setActiveLocationTab] = useState<"current" | "map" | "manual">("manual");
  const [mapCoordinates, setMapCoordinates] = useState(() =>
    hasCustomerAddressCoordinates(address)
      ? { latitude: address.latitude, longitude: address.longitude }
      : DEFAULT_MAP_COORDINATES,
  );
  const [hasTouchedMap, setHasTouchedMap] = useState(Boolean(address && hasCustomerAddressCoordinates(address)));
  const [resolvedLocationLabel, setResolvedLocationLabel] = useState(() =>
    address ? `${buildAddressSearchText(mapAddressToFormValues(address)) || address.city} (${getAddressCoordinateSummary(address)})` : "",
  );
  const [locationError, setLocationError] = useState<string>();
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] = useState(false);
  const [isResolvingTypedAddress, setIsResolvingTypedAddress] = useState(false);
  const [isSavingMapLocation, setIsSavingMapLocation] = useState(false);

  useEffect(() => {
    form.register("latitude");
    form.register("longitude");
  }, [form]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const defaultValues = mapAddressToFormValues(address, {
      recipientName: defaultRecipientName,
      contactPhone: defaultPhone,
      useForSearch: defaultUseForSearch,
    });

    form.reset(defaultValues);
    const nextCoordinates =
      hasResolvedFormCoordinates(defaultValues) && typeof defaultValues.latitude === "number" && typeof defaultValues.longitude === "number"
        ? { latitude: defaultValues.latitude, longitude: defaultValues.longitude }
        : DEFAULT_MAP_COORDINATES;
    setMapCoordinates(nextCoordinates);
    setHasTouchedMap(hasResolvedFormCoordinates(defaultValues));
    setActiveLocationTab(hasResolvedFormCoordinates(defaultValues) ? "map" : "manual");
    setResolvedLocationLabel(
      address
        ? `${buildAddressSearchText(defaultValues) || address.city} (${getAddressCoordinateSummary(address)})`
        : "",
    );
    setLocationError(undefined);
  }, [address, defaultPhone, defaultRecipientName, defaultUseForSearch, form, open]);

  const latitude = form.watch("latitude");
  const longitude = form.watch("longitude");
  const useForSearch = form.watch("useForSearch");
  const hasCoordinates = hasResolvedFormCoordinates({ latitude, longitude });

  const attachResolvedLocation = (
    coordinates: { latitude: number; longitude: number },
    label: string,
  ) => {
    form.setValue("latitude", coordinates.latitude, { shouldDirty: true, shouldTouch: true });
    form.setValue("longitude", coordinates.longitude, { shouldDirty: true, shouldTouch: true });
    setMapCoordinates(coordinates);
    setHasTouchedMap(true);
    setResolvedLocationLabel(`${label} (${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)})`);
    setLocationError(undefined);
  };

  const resolveTypedAddress = async ({ silently = false }: { silently?: boolean } = {}) => {
    const values = form.getValues();
    const searchText = buildAddressSearchText(values);

    if (searchText.trim().length < 6) {
      const message = "Add fuller address details before resolving location coordinates.";
      setLocationError(message);
      if (!silently) {
        toast.error(message);
      }
      return null;
    }

    setIsResolvingTypedAddress(true);

    try {
      const resolvedLocation = await geocodeCustomerLocation(searchText);
      attachResolvedLocation(
        {
          latitude: resolvedLocation.latitude,
          longitude: resolvedLocation.longitude,
        },
        resolvedLocation.address.trim() || searchText,
      );

      if (!silently) {
        toast.success("Address details matched to a delivery location.");
      }

      return resolvedLocation;
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to match this address yet. Try the map pin instead.");
      setLocationError(message);
      if (!silently) {
        toast.error(message);
      }
      return null;
    } finally {
      setIsResolvingTypedAddress(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setIsResolvingCurrentLocation(true);
    setLocationError(undefined);

    try {
      const coordinates = await getBrowserCoordinates();
      const resolvedLocation = await reverseGeocodeCustomerLocation(coordinates).catch(() => null);
      attachResolvedLocation(
        coordinates,
        resolvedLocation?.address?.trim() ||
          `Current location near ${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`,
      );
      toast.success("Current location attached to this address.");
    } catch (error) {
      const message = getCustomerLocationErrorMessage(error);
      setLocationError(message);
      toast.error(message);
    } finally {
      setIsResolvingCurrentLocation(false);
    }
  };

  const handleUseMapLocation = async () => {
    setIsSavingMapLocation(true);
    setLocationError(undefined);

    try {
      const resolvedLocation = await reverseGeocodeCustomerLocation(mapCoordinates).catch(() => null);
      attachResolvedLocation(
        mapCoordinates,
        resolvedLocation?.address?.trim() ||
          `Pinned location near ${mapCoordinates.latitude.toFixed(4)}, ${mapCoordinates.longitude.toFixed(4)}`,
      );
      toast.success("Map location attached to this address.");
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to use this map location right now.");
      setLocationError(message);
      toast.error(message);
    } finally {
      setIsSavingMapLocation(false);
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    let nextValues = values;

    if (!hasResolvedFormCoordinates(values)) {
      const resolvedLocation = await resolveTypedAddress({ silently: true });

      if (resolvedLocation) {
        nextValues = {
          ...form.getValues(),
          latitude: resolvedLocation.latitude,
          longitude: resolvedLocation.longitude,
        };
      }
    }

    await onSubmit(nextValues);
  });

  return (
    <Modal open={open} onClose={onClose} title={address ? "Edit address" : "Add new address"} className="max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4 rounded-[1.75rem] border border-accent/10 bg-cream-soft/60 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Location details</p>
              <p className="mt-2 text-sm leading-7 text-ink-soft">
                Nearby restaurant search only works when this address has valid latitude and longitude coordinates.
              </p>
            </div>
            <StatusPill label={hasCoordinates ? "Ready for search" : "Location needed"} tone={hasCoordinates ? "success" : "warning"} />
          </div>

          <Tabs
            items={[
              { value: "current", label: "Current" },
              { value: "map", label: "Map" },
              { value: "manual", label: "Address" },
            ]}
            value={activeLocationTab}
            onChange={(value) => setActiveLocationTab(value as "current" | "map" | "manual")}
          />

          {activeLocationTab === "current" ? (
            <div className="space-y-4 rounded-[1.5rem] border border-accent/10 bg-white px-4 py-4">
              <p className="text-sm leading-7 text-ink-soft">
                Use your device GPS to capture the handoff coordinates, then finish any building, landmark, or recipient details below before saving.
              </p>
              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="secondary" onClick={onClose} disabled={isResolvingCurrentLocation || isSubmitting}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => void handleUseCurrentLocation()} disabled={isResolvingCurrentLocation || isSubmitting}>
                  <LocateFixed className="mr-2 h-4 w-4" />
                  {isResolvingCurrentLocation ? "Locating..." : "Use current location"}
                </Button>
              </div>
            </div>
          ) : null}

          {activeLocationTab === "map" ? (
            <div className="space-y-4 rounded-[1.5rem] border border-accent/10 bg-white px-4 py-4">
              <LocationPickerMap
                value={mapCoordinates}
                onChange={(coordinates) => {
                  setMapCoordinates(coordinates);
                  setHasTouchedMap(true);
                }}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.25rem] bg-cream px-4 py-3 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">Latitude:</span> {mapCoordinates.latitude.toFixed(5)}
                </div>
                <div className="rounded-[1.25rem] bg-cream px-4 py-3 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">Longitude:</span> {mapCoordinates.longitude.toFixed(5)}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" onClick={() => void handleUseMapLocation()} disabled={isSavingMapLocation || isSubmitting || !hasTouchedMap}>
                  <MapPinned className="mr-2 h-4 w-4" />
                  {isSavingMapLocation ? "Saving..." : "Use map pin"}
                </Button>
              </div>
            </div>
          ) : null}

          {activeLocationTab === "manual" ? (
            <div className="space-y-4 rounded-[1.5rem] border border-accent/10 bg-white px-4 py-4">
              <p className="text-sm leading-7 text-ink-soft">
                Fill the address form below, then resolve coordinates from the typed address. If matching fails, switch to the map tab.
              </p>
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void resolveTypedAddress()}
                  disabled={isResolvingTypedAddress || isSubmitting}
                >
                  {isResolvingTypedAddress ? "Matching..." : "Resolve from typed address"}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[1.25rem] bg-white px-4 py-4 text-sm leading-7 text-ink-soft">
              <p className="font-semibold text-ink">Resolved location</p>
              <p className="mt-2">
                {resolvedLocationLabel || "No coordinates attached yet. Use current location, map pin, or resolve the typed address."}
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-white px-4 py-4 text-sm leading-7 text-ink-soft">
              <p className="font-semibold text-ink">Coordinate status</p>
              <p className="mt-2">
                {hasCoordinates && typeof latitude === "number" && typeof longitude === "number"
                  ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                  : "Coordinates will be attached here once the location is resolved."}
              </p>
            </div>
          </div>

          {locationError ? <p className="text-sm font-medium text-accent-soft">{locationError}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Address type" error={form.formState.errors.addressType?.message} {...form.register("addressType")}>
            {ADDRESS_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Input
            label="Address title"
            placeholder="Home, Office, Studio"
            error={form.formState.errors.title?.message}
            {...form.register("title")}
          />
          <Input
            label="Recipient name"
            placeholder="Aditi Verma"
            error={form.formState.errors.recipientName?.message}
            {...form.register("recipientName")}
          />
          <IndianPhoneInput
            label="Contact phone"
            error={form.formState.errors.contactPhone?.message}
            {...form.register("contactPhone")}
          />
          <Input
            label="House / building"
            placeholder="Prestige Shantiniketan, Tower 4"
            error={form.formState.errors.houseNo?.message}
            {...form.register("houseNo")}
          />
          <Input
            label="Street / area"
            placeholder="Whitefield Main Road"
            error={form.formState.errors.street?.message}
            {...form.register("street")}
          />
          <Input
            label="Landmark"
            placeholder="Near Forum Mall"
            error={form.formState.errors.landmark?.message}
            {...form.register("landmark")}
          />
          <Input
            label="Locality"
            placeholder="Whitefield"
            error={form.formState.errors.area?.message}
            {...form.register("area")}
          />
          <Input
            label="City"
            placeholder="Bengaluru"
            error={form.formState.errors.city?.message}
            {...form.register("city")}
          />
          <Input
            label="State"
            placeholder="Karnataka"
            error={form.formState.errors.state?.message}
            {...form.register("state")}
          />
          <Input
            label="Pincode"
            placeholder="560048"
            error={form.formState.errors.pincode?.message}
            {...form.register("pincode")}
          />
        </div>

        <label className="flex items-center justify-between rounded-[1.5rem] border border-accent/10 bg-cream-soft/60 px-4 py-3">
          <span className="text-sm font-semibold text-ink">Set as default address</span>
          <input type="checkbox" className="h-4 w-4 accent-[rgb(139,30,36)]" {...form.register("isDefault")} />
        </label>

        <label className="flex items-center justify-between rounded-[1.5rem] border border-accent/10 bg-cream-soft/60 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">Use this address for nearby restaurant search</p>
            <p className="mt-1 text-xs text-ink-soft">
              {hasCoordinates
                ? "This address will become the active delivery location for restaurant discovery."
                : "We will try to resolve coordinates on save, but food search stays blocked until the location is matched."}
            </p>
          </div>
          <input type="checkbox" className="h-4 w-4 accent-[rgb(139,30,36)]" {...form.register("useForSearch")} />
        </label>

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? address
                ? "Saving..."
                : "Adding..."
              : address
                ? "Save changes"
                : useForSearch
                  ? "Save and use address"
                  : "Add address"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const ProfileFormModal = ({
  open,
  user,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  user: AuthUser | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ProfileFormValues) => Promise<void>;
}) => {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: mapProfileToFormValues(user),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(mapProfileToFormValues(user));
  }, [form, open, user]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <Modal open={open} onClose={onClose} title="Edit profile" className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" error={form.formState.errors.fullName?.message} {...form.register("fullName")} />
          <Input label="Email" readOnly {...form.register("email")} />
          <IndianPhoneInput label="Phone" error={form.formState.errors.phone?.message} {...form.register("phone")} />
          <Input
            label="Profile image URL"
            placeholder="https://images.example.com/profile.jpg"
            error={form.formState.errors.profileImage?.message}
            {...form.register("profileImage")}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const getPaymentMethodTitle = (paymentMethod: CustomerPaymentMethod) => {
  if (paymentMethod.type === "CARD") {
    return `${paymentMethod.label ?? "Card"} - **** **** **** ${paymentMethod.cardLast4 ?? paymentMethod.maskedEnding ?? "0000"}`;
  }

  return paymentMethod.label?.trim()
    ? `${paymentMethod.label} - ${paymentMethod.upiId ?? ""}`
    : `UPI - ${paymentMethod.upiId ?? "No ID"}`;
};

const getPaymentMethodSubtitle = (paymentMethod: CustomerPaymentMethod) => {
  if (paymentMethod.type === "CARD") {
    const details = [
      paymentMethod.cardBrand?.trim(),
      paymentMethod.cardholderName?.trim() ?? paymentMethod.holderName?.trim(),
      paymentMethod.expiryMonth && paymentMethod.expiryYear
        ? `Expires ${paymentMethod.expiryMonth}/${paymentMethod.expiryYear}`
        : null,
    ].filter(Boolean);

    return details.join(" • ") || "Masked card summary";
  }

  return (paymentMethod.isDefault ?? paymentMethod.isPrimary) ? "Default UPI ID" : "Ready for quick checkout";
};

const PaymentMethodFormModal = ({
  open,
  paymentMethod,
  forcedType,
  defaultHolderName,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  paymentMethod: CustomerPaymentMethod | null;
  forcedType?: SavedPaymentMethodTab | null;
  defaultHolderName?: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: PaymentMethodFormValues) => Promise<void>;
}) => {
  const form = useForm<PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodFormSchema),
    defaultValues: mapPaymentMethodToFormValues(paymentMethod, defaultHolderName, forcedType ?? paymentMethod?.type ?? "CARD"),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(mapPaymentMethodToFormValues(paymentMethod, defaultHolderName, forcedType ?? paymentMethod?.type ?? "CARD"));
  }, [defaultHolderName, forcedType, form, open, paymentMethod]);

  const selectedType = paymentMethod?.type ?? forcedType ?? form.watch("type");
  const isTypeLocked = Boolean(paymentMethod) || Boolean(forcedType);
  const modalTitle = paymentMethod
    ? selectedType === "CARD"
      ? "Edit saved card"
      : "Edit saved UPI ID"
    : selectedType === "CARD"
      ? "Add new card"
      : "Add new UPI ID";

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      ...values,
      label: values.label?.trim() ?? "",
      holderName: values.holderName?.trim() ?? "",
      maskedEnding: values.maskedEnding?.trim() ?? "",
      cardBrand: values.cardBrand?.trim() ?? "",
      expiryMonth: values.expiryMonth?.trim() ?? "",
      expiryYear: values.expiryYear?.trim() ?? "",
      upiId: values.upiId?.trim() ?? "",
    });
  });

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {!isTypeLocked ? (
          <Select label="Payment type" error={form.formState.errors.type?.message} {...form.register("type")}>
            {PAYMENT_METHOD_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : null}

        {selectedType === "CARD" ? (
          <>
            <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4 text-sm leading-7 text-ink-soft">
              Only a masked card summary is saved here. Full card numbers and CVV are never stored.
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Card label" placeholder="Visa Personal" error={form.formState.errors.label?.message} {...form.register("label")} />
              <Input label="Card brand" placeholder="Visa" error={form.formState.errors.cardBrand?.message} {...form.register("cardBrand")} />
              <Input
                label="Card holder name"
                placeholder="Aditi Verma"
                error={form.formState.errors.holderName?.message}
                {...form.register("holderName")}
              />
              <Input
                label="Card ending"
                placeholder="4421"
                inputMode="numeric"
                maxLength={4}
                error={form.formState.errors.maskedEnding?.message}
                {...form.register("maskedEnding")}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Expiry month"
                  placeholder="08"
                  inputMode="numeric"
                  maxLength={2}
                  error={form.formState.errors.expiryMonth?.message}
                  {...form.register("expiryMonth")}
                />
                <Input
                  label="Expiry year"
                  placeholder="2029"
                  inputMode="numeric"
                  maxLength={4}
                  error={form.formState.errors.expiryYear?.message}
                  {...form.register("expiryYear")}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="UPI ID" placeholder="name@okicici" error={form.formState.errors.upiId?.message} {...form.register("upiId")} />
            <Input label="App label" placeholder="GPay" error={form.formState.errors.label?.message} {...form.register("label")} />
          </div>
        )}

        <label className="flex items-center justify-between rounded-[1.5rem] border border-accent/10 bg-cream-soft/60 px-4 py-3">
          <span className="text-sm font-semibold text-ink">Set as default {selectedType === "CARD" ? "card" : "UPI ID"}</span>
          <input type="checkbox" className="h-4 w-4 accent-[rgb(139,30,36)]" {...form.register("isPrimary")} />
        </label>

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : paymentMethod ? "Save changes" : selectedType === "CARD" ? "Add card" : "Add UPI ID"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const isDefaultPaymentMethod = (paymentMethod: CustomerPaymentMethod) => paymentMethod.isDefault ?? paymentMethod.isPrimary;

const toPaymentMethodPayload = (values: PaymentMethodFormValues): CustomerPaymentMethodPayload => {
  if (values.type === "CARD") {
    const holderName = values.holderName?.trim() ?? "";
    const last4 = values.maskedEnding.trim();
    const cardBrand = values.cardBrand?.trim() ?? "";

    return {
      type: "CARD",
      label: values.label?.trim() ?? "",
      holderName: holderName || undefined,
      cardholderName: holderName || undefined,
      maskedEnding: last4,
      cardLast4: last4,
      cardBrand: cardBrand || undefined,
      expiryMonth: values.expiryMonth.trim(),
      expiryYear: values.expiryYear.trim(),
      isPrimary: values.isPrimary,
      isDefault: values.isPrimary,
    };
  }

  return {
    type: "UPI",
    label: values.label?.trim() || undefined,
    upiId: values.upiId.trim(),
    isPrimary: values.isPrimary,
    isDefault: values.isPrimary,
  };
};

const SavedPaymentDetailsSection = ({
  title,
  description,
  defaultHolderName,
}: {
  title: string;
  description: string;
  defaultHolderName?: string | null;
}) => {
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<CustomerPaymentMethod[]>([]);
  const [activeTab, setActiveTab] = useState<SavedPaymentMethodTab>("CARD");
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<CustomerPaymentMethod | null>(null);
  const [modalType, setModalType] = useState<SavedPaymentMethodTab>("CARD");
  const [isSubmittingPaymentMethod, setIsSubmittingPaymentMethod] = useState(false);
  const [defaultingPaymentMethodId, setDefaultingPaymentMethodId] = useState<number | null>(null);
  const [deleteTargetPaymentMethod, setDeleteTargetPaymentMethod] = useState<CustomerPaymentMethod | null>(null);
  const [isDeletingPaymentMethod, setIsDeletingPaymentMethod] = useState(false);

  const loadPaymentMethods = async ({ quietly = false }: { quietly?: boolean } = {}) => {
    if (!quietly) {
      setIsLoadingPaymentMethods(true);
    }

    try {
      setSavedPaymentMethods(await getCustomerPaymentMethods());
    } catch (error) {
      setSavedPaymentMethods([]);
      toast.error(getApiErrorMessage(error, "Unable to load your saved payment methods right now."));
    } finally {
      if (!quietly) {
        setIsLoadingPaymentMethods(false);
      }
    }
  };

  useEffect(() => {
    void loadPaymentMethods();
  }, []);

  const savedCards = savedPaymentMethods.filter((paymentMethod) => paymentMethod.type === "CARD");
  const savedUpiMethods = savedPaymentMethods.filter((paymentMethod) => paymentMethod.type === "UPI");
  const visibleMethods = activeTab === "CARD" ? savedCards : savedUpiMethods;

  const handleCreatePaymentMethod = (type: SavedPaymentMethodTab) => {
    setActiveTab(type);
    setModalType(type);
    setSelectedPaymentMethod(null);
    setIsPaymentMethodModalOpen(true);
  };

  const handleEditPaymentMethod = (paymentMethod: CustomerPaymentMethod) => {
    setActiveTab(paymentMethod.type);
    setModalType(paymentMethod.type);
    setSelectedPaymentMethod(paymentMethod);
    setIsPaymentMethodModalOpen(true);
  };

  const handleClosePaymentMethodModal = () => {
    if (isSubmittingPaymentMethod) {
      return;
    }

    setIsPaymentMethodModalOpen(false);
    setSelectedPaymentMethod(null);
  };

  const handleSubmitPaymentMethod = async (values: PaymentMethodFormValues) => {
    setIsSubmittingPaymentMethod(true);

    try {
      const payload = toPaymentMethodPayload(values);

      if (selectedPaymentMethod) {
        await updateCustomerPaymentMethod(selectedPaymentMethod.id, payload);
      } else {
        await createCustomerPaymentMethod(payload);
      }

      await loadPaymentMethods({ quietly: true });
      setIsPaymentMethodModalOpen(false);
      setSelectedPaymentMethod(null);
      toast.success(
        selectedPaymentMethod
          ? values.type === "CARD"
            ? "Saved card updated."
            : "Saved UPI ID updated."
          : values.type === "CARD"
            ? "Saved card added."
            : "Saved UPI ID added.",
      );
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          selectedPaymentMethod
            ? values.type === "CARD"
              ? "Unable to update this saved card right now."
              : "Unable to update this saved UPI ID right now."
            : values.type === "CARD"
              ? "Unable to add this saved card right now."
              : "Unable to add this UPI ID right now.",
        ),
      );
    } finally {
      setIsSubmittingPaymentMethod(false);
    }
  };

  const handleSetDefaultPaymentMethod = async (paymentMethod: CustomerPaymentMethod) => {
    if (isDefaultPaymentMethod(paymentMethod)) {
      return;
    }

    setDefaultingPaymentMethodId(paymentMethod.id);

    try {
      await setDefaultCustomerSavedPaymentMethod(paymentMethod.id);
      await loadPaymentMethods({ quietly: true });
      toast.success(paymentMethod.type === "CARD" ? "Default card updated." : "Default UPI ID updated.");
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          paymentMethod.type === "CARD"
            ? "Unable to update the default card right now."
            : "Unable to update the default UPI ID right now.",
        ),
      );
    } finally {
      setDefaultingPaymentMethodId(null);
    }
  };

  const handleDeletePaymentMethod = async () => {
    if (!deleteTargetPaymentMethod) {
      return;
    }

    setIsDeletingPaymentMethod(true);

    try {
      await deleteCustomerPaymentMethod(deleteTargetPaymentMethod.id);
      await loadPaymentMethods({ quietly: true });
      setDeleteTargetPaymentMethod(null);
      toast.success(deleteTargetPaymentMethod.type === "CARD" ? "Saved card removed." : "Saved UPI ID removed.");
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          deleteTargetPaymentMethod.type === "CARD"
            ? "Unable to remove this saved card right now."
            : "Unable to remove this saved UPI ID right now.",
        ),
      );
    } finally {
      setIsDeletingPaymentMethod(false);
    }
  };

  return (
    <>
      <SurfaceCard className="space-y-5">
        <SectionHeading
          title={title}
          description={description}
          action={
            <Button type="button" variant="secondary" className="px-4 py-2 text-xs" onClick={() => handleCreatePaymentMethod(activeTab)}>
              {activeTab === "CARD" ? "Add new card" : "Add new UPI"}
            </Button>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            items={[
              { value: "CARD", label: "Cards" },
              { value: "UPI", label: "UPI" },
            ]}
            value={activeTab}
            onChange={(value) => setActiveTab(value as SavedPaymentMethodTab)}
          />
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">
            {visibleMethods.length} saved {activeTab === "CARD" ? (visibleMethods.length === 1 ? "card" : "cards") : "UPI IDs"}
          </p>
        </div>

        {isLoadingPaymentMethods ? (
          <div className="rounded-[1.5rem] bg-cream px-5 py-4 text-sm text-ink-soft">Loading your saved payment details.</div>
        ) : visibleMethods.length ? (
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {visibleMethods.map((paymentMethod) => {
              const isDefault = isDefaultPaymentMethod(paymentMethod);

              return (
                <div key={paymentMethod.id} className="rounded-[1.5rem] border border-accent/10 bg-cream px-5 py-4 shadow-soft">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-2xl shadow-soft",
                          paymentMethod.type === "CARD" ? "bg-white text-accent" : "bg-accent/10 text-accent",
                        )}
                      >
                        {paymentMethod.type === "CARD" ? <CreditCard className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink">{getPaymentMethodTitle(paymentMethod)}</p>
                          {isDefault ? <StatusPill label="Default" tone="info" /> : null}
                        </div>
                        <p className="mt-1 text-sm text-ink-soft">{getPaymentMethodSubtitle(paymentMethod)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!isDefault ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-3 py-2 text-xs"
                          onClick={() => void handleSetDefaultPaymentMethod(paymentMethod)}
                          disabled={defaultingPaymentMethodId === paymentMethod.id}
                        >
                          {defaultingPaymentMethodId === paymentMethod.id ? "Saving..." : "Set default"}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-3 py-2 text-xs"
                        onClick={() => handleEditPaymentMethod(paymentMethod)}
                        disabled={isSubmittingPaymentMethod}
                      >
                        <Edit3 className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-3 py-2 text-xs"
                        onClick={() => setDeleteTargetPaymentMethod(paymentMethod)}
                        disabled={isDeletingPaymentMethod}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <EmptyState
              title={activeTab === "CARD" ? "No saved cards yet" : "No saved UPI IDs yet"}
              description={
                activeTab === "CARD"
                  ? "Save a masked card once and reuse it in checkout. Full card numbers and CVV are never stored."
                  : "Save a UPI ID like name@bank so checkout can reuse it instantly."
              }
            />
            <div className="flex justify-center">
              <Button type="button" onClick={() => handleCreatePaymentMethod(activeTab)}>
                {activeTab === "CARD" ? "Add new card" : "Add new UPI"}
              </Button>
            </div>
          </div>
        )}
      </SurfaceCard>

      <PaymentMethodFormModal
        open={isPaymentMethodModalOpen}
        paymentMethod={selectedPaymentMethod}
        forcedType={modalType}
        defaultHolderName={defaultHolderName}
        isSubmitting={isSubmittingPaymentMethod}
        onClose={handleClosePaymentMethodModal}
        onSubmit={handleSubmitPaymentMethod}
      />

      <ConfirmDangerModal
        open={Boolean(deleteTargetPaymentMethod)}
        title={deleteTargetPaymentMethod?.type === "CARD" ? "Delete saved card" : "Delete saved UPI ID"}
        description={
          deleteTargetPaymentMethod?.type === "CARD"
            ? "This masked card summary will be removed from your saved payment methods."
            : "This saved UPI ID will be removed from your payment methods."
        }
        confirmLabel={deleteTargetPaymentMethod?.type === "CARD" ? "Delete card" : "Delete UPI ID"}
        isSubmitting={isDeletingPaymentMethod}
        onClose={() => {
          if (!isDeletingPaymentMethod) {
            setDeleteTargetPaymentMethod(null);
          }
        }}
        onConfirm={() => void handleDeletePaymentMethod()}
      />
    </>
  );
};

export const NotificationsPage = () => {
  const { isAuthenticated, user } = useAuth();
  const useLiveFlow = isAuthenticated && user?.role === "CUSTOMER";
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);
  const {
    items,
    isLoading,
    hasUnread,
    unreadCount,
    isMarkingAllRead,
    isDeletingAll,
    processingNotificationId,
    markAsRead,
    markAllRead,
    deleteAll,
  } = useNotificationInbox({
    enabled: useLiveFlow,
    userId: user?.id,
    onError: (message) => toast.error(message),
  });

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      toast.success("All notifications marked as read.");
    } catch {
      // Errors are already surfaced by the inbox hook.
    }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAll();
      setIsDeleteAllConfirmOpen(false);
      toast.success("All notifications deleted.");
    } catch {
      // Errors are already surfaced by the inbox hook.
    }
  };

  if (useLiveFlow) {
    return (
      <>
        <PageShell
          eyebrow="Notifications"
          title="Updates that matter, without the clutter."
          description="Recent order, wallet, and restaurant alerts are organized into the same warm premium surfaces used elsewhere in the customer app."
          actions={
            items.length ? (
              <>
                {hasUnread ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleMarkAllRead()}
                    disabled={isMarkingAllRead || isDeletingAll}
                  >
                    {isMarkingAllRead ? "Saving..." : "Mark all read"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsDeleteAllConfirmOpen(true)}
                  disabled={isDeletingAll || isMarkingAllRead}
                >
                  Delete all
                </Button>
              </>
            ) : undefined
          }
        >
          <div className="space-y-5">
            <SectionHeading
              title="Notification center"
              description={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"} in your live inbox.`}
            />
            <NotificationFeed
              items={items}
              role="CUSTOMER"
              isLoading={isLoading}
              processingNotificationId={processingNotificationId}
              emptyTitle="No notifications yet"
              emptyDescription="Live order and delivery updates will appear here as soon as your next order starts moving."
              onMarkAsRead={markAsRead}
            />
          </div>
        </PageShell>

        <ConfirmDangerModal
          open={isDeleteAllConfirmOpen}
          title="Delete all notifications"
          description="Are you sure you want to delete all notifications? This only clears notifications for your current account."
          confirmLabel="Delete all notifications"
          isSubmitting={isDeletingAll}
          onClose={() => setIsDeleteAllConfirmOpen(false)}
          onConfirm={() => void handleDeleteAll()}
        />
      </>
    );
  }

  return (
    <PageShell
      eyebrow="Notifications"
      title="Updates that matter, without the clutter."
      description="Recent order, wallet, and restaurant alerts are organized into the same warm premium surfaces used elsewhere in the customer app."
    >
      <EmptyState
        title="Sign in to view live notifications"
        description="Order, delivery, and restaurant updates appear here for authenticated customer sessions."
      />
    </PageShell>
  );
};

export const ProfilePage = () => {
  const navigate = useNavigate();
  const { setSession, user, clearSession } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleProfileSubmit = async (values: ProfileFormValues) => {
    setIsSavingProfile(true);

    try {
      const nextUser = await updateCustomerProfile({
        fullName: values.fullName.trim(),
        phone: values.phone.trim() || undefined,
        profileImage: values.profileImage.trim() || undefined,
      });
      const accessToken = useAuthStore.getState().accessToken;

      if (accessToken) {
        setSession({ user: nextUser, accessToken });
      }

      setIsEditModalOpen(false);
      toast.success("Profile updated successfully.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update your profile."));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logoutFromServer();
    } catch {
      // Clear the local session even if the refresh cookie is already gone.
    } finally {
      clearSession();
      window.localStorage.removeItem("zomato-luxe-auth");
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("refreshToken");
      toast.success("Logged out successfully.");
      navigate("/login", { replace: true });
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <PageShell
        eyebrow="Profile"
        title={user?.fullName ?? "Your account"}
        description="Personal details, loyalty context, and quick links stay grouped in one profile destination instead of looping back to the homepage."
        actions={
          <>
            <Link to="/addresses" className={linkButtonClassName}>
              Manage addresses
            </Link>
            <Link
              to="/wallet"
              className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
            >
              Open wallet
            </Link>
          </>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <SurfaceCard className="space-y-5">
            <SectionHeading
              title="Account details"
              description="Live session details from the existing auth store."
              action={
                <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={() => setIsEditModalOpen(true)}>
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit profile
                </Button>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] bg-cream px-5 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Email</p>
                <p className="mt-2 text-sm text-ink-soft">{user?.email ?? "you@example.com"}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-5 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Phone</p>
                <p className="mt-2 text-sm text-ink-soft">{formatIndianPhoneDisplay(user?.phone) || "+91 90000 00000"}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-5 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Role</p>
                <p className="mt-2 text-sm text-ink-soft">{user?.role ?? "CUSTOMER"}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-5 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Wallet balance</p>
                <p className="mt-2 text-sm text-ink-soft">Rs. {(user?.walletBalance ?? 1980).toLocaleString("en-IN")}</p>
              </div>
            </div>
          </SurfaceCard>

          <div className="space-y-6">
            <SurfaceCard className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Membership tier</p>
                    <StatusPill
                      label={getMembershipStatusLabel(user?.membershipStatus)}
                      tone={getMembershipStatusTone(user?.membershipStatus)}
                    />
                  </div>
                  <h2 className="mt-2 font-display text-4xl font-semibold text-ink">
                    {getMembershipTierLabel(user?.membershipTier)}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-ink-soft">
                    {getMembershipDescription(user?.membershipTier)}
                  </p>
                  <p className="mt-3 text-sm text-ink-soft">
                    Valid until {formatMembershipDate(user?.membershipExpiresAt)}
                  </p>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard className="space-y-4">
              <SectionHeading title="Quick actions" description="Route-level shortcuts for the most-used customer destinations." />
              <div className="flex flex-wrap gap-3">
                <Link to="/orders" className={linkButtonClassName}>
                  View orders
                </Link>
                <Link
                  to="/notifications"
                  className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
                >
                  Open notifications
                </Link>
                <Link
                  to="/favorites"
                  className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
                >
                  Favorites
                </Link>
                <Link
                  to="/membership"
                  className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
                >
                  Manage membership
                </Link>
                <Button type="button" variant="secondary" onClick={handleLogout} disabled={isLoggingOut}>
                  {isLoggingOut ? "Signing out..." : "Logout"}
                </Button>
              </div>
            </SurfaceCard>
          </div>
        </div>

        <SavedPaymentDetailsSection
          title="Account payment details"
          description="Manage the same saved cards and UPI IDs that appear during checkout, including your default payment choices."
          defaultHolderName={user?.fullName}
        />
      </PageShell>

      <ProfileFormModal
        open={isEditModalOpen}
        user={user}
        isSubmitting={isSavingProfile}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleProfileSubmit}
      />
    </>
  );
};

export const SavedAddressesPage = () => {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [activeLocation, setActiveLocation] = useState<CustomerActiveLocation | null>(() =>
    readStoredCustomerActiveLocation(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<CustomerAddress | null>(null);
  const [shouldUseSelectedAddressForSearch, setShouldUseSelectedAddressForSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [defaultingAddressId, setDefaultingAddressId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerAddress | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const persistActiveLocation = (
    address: CustomerAddress,
    source: CustomerActiveLocationSource = address.isDefault ? "default" : "saved",
  ) => {
    const nextLocation = createCustomerActiveLocationFromAddress(address, source);

    if (!nextLocation) {
      toast.error("Add location details to this address before using it for nearby restaurant search.");
      return false;
    }

    writeStoredCustomerActiveLocation(nextLocation);
    setActiveLocation(nextLocation);
    return true;
  };

  const clearActiveLocation = () => {
    clearStoredCustomerActiveLocation();
    setActiveLocation(null);
  };

  const loadAddresses = async ({ quietly = false }: { quietly?: boolean } = {}) => {
    if (!quietly) {
      setIsLoading(true);
    }

    try {
      const nextAddresses = await getCustomerAddresses();
      setAddresses(nextAddresses);
      return nextAddresses;
    } catch (error) {
      setAddresses([]);
      toast.error(getApiErrorMessage(error, "Unable to load saved addresses right now."));
      return [] as CustomerAddress[];
    } finally {
      if (!quietly) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadAddresses();
  }, []);

  useEffect(() => {
    const storedLocation = readStoredCustomerActiveLocation();
    const preferredLocation = resolvePreferredCustomerActiveLocation(addresses, storedLocation);

    if (preferredLocation) {
      if (!areCustomerActiveLocationsEqual(activeLocation, preferredLocation)) {
        setActiveLocation(preferredLocation);
      }

      if (!areCustomerActiveLocationsEqual(storedLocation, preferredLocation)) {
        writeStoredCustomerActiveLocation(preferredLocation);
      }

      return;
    }

    if (!activeLocation) {
      clearActiveLocation();
      return;
    }

    if (activeLocation.source === "default" || activeLocation.source === "saved") {
      clearActiveLocation();
    }
  }, [activeLocation, addresses]);

  const handleCloseModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setSelectedAddress(null);
    setShouldUseSelectedAddressForSearch(false);
  };

  const handleCreateAddress = () => {
    setSelectedAddress(null);
    setShouldUseSelectedAddressForSearch(!activeLocation);
    setIsModalOpen(true);
  };

  const handleEditAddress = (address: CustomerAddress) => {
    setSelectedAddress(address);
    setShouldUseSelectedAddressForSearch(activeAddressId === address.id);
    setIsModalOpen(true);
  };

  const handleSubmitAddress = async (values: AddressFormValues) => {
    setIsSubmitting(true);

    try {
      const payload = toAddressPayload(values);
      const savedAddress = selectedAddress
        ? await updateCustomerAddress(selectedAddress.id, payload)
        : await createCustomerAddress(payload);
      const shouldUseForSearch = values.useForSearch || savedAddress.isDefault;

      if (selectedAddress) {
        toast.success("Address updated successfully.");
      } else {
        toast.success("Address added successfully.");
      }

      await loadAddresses({ quietly: true });

      if (shouldUseForSearch && hasCustomerAddressCoordinates(savedAddress)) {
        persistActiveLocation(savedAddress, savedAddress.isDefault ? "default" : "saved");
      } else if (shouldUseForSearch && !hasCustomerAddressCoordinates(savedAddress)) {
        toast.success("Address saved. Add location details before using it for nearby restaurant search.");
      } else if (activeLocation?.addressId === savedAddress.id) {
        if (hasCustomerAddressCoordinates(savedAddress)) {
          persistActiveLocation(savedAddress, savedAddress.isDefault ? "default" : "saved");
        } else {
          clearActiveLocation();
        }
      }

      setIsModalOpen(false);
      setSelectedAddress(null);
      setShouldUseSelectedAddressForSearch(false);
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          selectedAddress ? "Unable to update this address right now." : "Unable to add this address right now.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefault = async (address: CustomerAddress) => {
    setDefaultingAddressId(address.id);

    try {
      const updatedAddress = await updateCustomerAddress(address.id, { isDefault: true });
      await loadAddresses({ quietly: true });

      if (hasCustomerAddressCoordinates(updatedAddress)) {
        persistActiveLocation({ ...updatedAddress, isDefault: true }, "default");
        toast.success("Default address updated and linked to nearby restaurant search.");
      } else {
        toast.success("Default address updated. Add location details before using it for nearby restaurant search.");
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update the default address right now."));
    } finally {
      setDefaultingAddressId(null);
    }
  };

  const handleUseForSearch = (address: CustomerAddress) => {
    if (!hasCustomerAddressCoordinates(address)) {
      toast.error("Add location details to this address before using it for nearby restaurant search.");
      setSelectedAddress(address);
      setShouldUseSelectedAddressForSearch(true);
      setIsModalOpen(true);
      return;
    }

    if (persistActiveLocation(address, address.isDefault ? "default" : "saved")) {
      toast.success("Nearby restaurant search now uses this saved address.");
    }
  };

  const handleDeleteAddress = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteCustomerAddress(deleteTarget.id);
      const nextAddresses = await loadAddresses({ quietly: true });

      if (activeLocation?.addressId === deleteTarget.id) {
        const replacementAddress =
          nextAddresses.find((address) => address.isDefault && hasCustomerAddressCoordinates(address)) ??
          nextAddresses.find((address) => hasCustomerAddressCoordinates(address));

        if (replacementAddress) {
          persistActiveLocation(replacementAddress, replacementAddress.isDefault ? "default" : "saved");
          toast.success("Address deleted. Nearby restaurant search moved to another saved address.");
        } else {
          clearActiveLocation();
          toast.success("Address deleted. Choose another address with location details to browse restaurants.");
        }
      } else {
        toast.success("Address deleted successfully.");
      }

      setDeleteTarget(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to delete this address right now."));
    } finally {
      setIsDeleting(false);
    }
  };

  const activeAddressId = activeLocation?.addressId ?? null;

  return (
    <>
      <PageShell
        eyebrow="Addresses"
        title="Saved handoff points for every dining mood."
        description="Home, office, and occasion-ready destinations are grouped into a dedicated page instead of being hidden inside checkout."
        actions={
          <Button type="button" onClick={handleCreateAddress}>
            Add new address
          </Button>
        }
      >
        <SurfaceCard className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill label={activeLocation ? "Active for search" : "Location needed"} tone={activeLocation ? "success" : "warning"} />
                {activeLocation?.label ? <StatusPill label={activeLocation.label} tone="info" /> : null}
              </div>
              <p className="text-sm font-semibold text-ink">
                {activeLocation
                  ? activeLocation.addressId
                    ? "Nearby restaurants are currently filtered from this saved delivery location."
                    : "Nearby restaurants are currently filtered from a temporary delivery location."
                  : "Choose a saved address with location details before browsing nearby restaurants."}
              </p>
              <p className="text-sm leading-7 text-ink-soft">
                {activeLocation
                  ? activeLocation.addressId
                    ? activeLocation.address
                    : `${activeLocation.address} Use one of the saved addresses below to replace this temporary search location.`
                  : "Save an address with a map pin, current location, or typed-address match, then use it for food search."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/restaurants" className={linkButtonClassName}>
                Browse restaurants
              </Link>
            </div>
          </div>
        </SurfaceCard>

        {isLoading ? (
          <SurfaceCard>
            <p className="text-sm leading-7 text-ink-soft">Loading your saved addresses.</p>
          </SurfaceCard>
        ) : addresses.length ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {addresses.map((address) => {
              const addressLines = getAddressLines(address);

              return (
                <SurfaceCard key={address.id} className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-display text-3xl font-semibold text-ink">{getAddressHeading(address)}</p>
                        <p className="mt-1 text-sm text-ink-soft">{getAddressSubtitle(address)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {address.isDefault ? <StatusPill label="Default" tone="info" /> : null}
                      {activeAddressId === address.id ? <StatusPill label="Search active" tone="success" /> : null}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] bg-cream px-5 py-4 text-sm leading-7 text-ink-soft">
                    <p>{addressLines.line1}</p>
                    <p>{addressLines.line2}</p>
                    {address.contactPhone ? <p>{formatIndianPhoneDisplay(address.contactPhone)}</p> : null}
                  </div>

                  <div className="space-y-3 rounded-[1.5rem] border border-accent/10 bg-white px-5 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusPill
                        label={getAddressLocationStatus(address).label}
                        tone={getAddressLocationStatus(address).tone}
                      />
                      <p className="text-sm text-ink-soft">{getAddressLocationStatus(address).message}</p>
                    </div>
                    <p className="text-sm leading-7 text-ink-soft">
                      <span className="font-semibold text-ink">Coordinates:</span> {getAddressCoordinateSummary(address)}
                    </p>
                    {!hasCustomerAddressCoordinates(address) ? (
                      <p className="text-sm leading-7 text-ink-soft">
                        This saved address remains editable and usable at checkout, but restaurant discovery stays blocked until coordinates are attached.
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant={activeAddressId === address.id ? "secondary" : "primary"}
                      className="px-3 py-2 text-xs"
                      onClick={() => handleUseForSearch(address)}
                      disabled={activeAddressId === address.id}
                    >
                      {hasCustomerAddressCoordinates(address)
                        ? activeAddressId === address.id
                          ? "Using for search"
                          : "Use for search"
                        : "Add location details"}
                    </Button>
                    <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={() => handleEditAddress(address)}>
                      <Edit3 className="mr-2 h-4 w-4" />
                      Edit address
                    </Button>
                    {!address.isDefault ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-3 py-2 text-xs"
                        onClick={() => void handleSetDefault(address)}
                        disabled={defaultingAddressId === address.id}
                      >
                        {defaultingAddressId === address.id ? "Updating..." : "Set as default"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-3 py-2 text-xs"
                      onClick={() => setDeleteTarget(address)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No saved addresses yet"
            description="Add a delivery address here so checkout stays fast, polished, and ready for your next order."
          />
        )}
      </PageShell>

      <AddressFormModal
        open={isModalOpen}
        address={selectedAddress}
        defaultRecipientName={user?.fullName}
        defaultPhone={user?.phone}
        defaultUseForSearch={shouldUseSelectedAddressForSearch}
        isSubmitting={isSubmitting}
        onClose={handleCloseModal}
        onSubmit={handleSubmitAddress}
      />

      <ConfirmDangerModal
        open={Boolean(deleteTarget)}
        title="Delete saved address"
        description="This removes the address from your saved list. Orders already placed keep their historic delivery address details."
        confirmLabel="Delete address"
        isSubmitting={isDeleting}
        onClose={() => {
          if (!isDeleting) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={() => void handleDeleteAddress()}
      />
    </>
  );
};

export const WalletPage = () => {
  const { user } = useAuth();
  const rows = walletTransactions.map(([date, note, amount]) => [date, note, amount]);

  return (
    <PageShell
      eyebrow="Wallet and payments"
      title="Credits, saved methods, and spend history."
      description="The wallet route keeps balance read-only while using the same saved card and UPI records that appear during checkout and in your profile."
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <SurfaceCard className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Available balance</p>
                <h2 className="mt-2 font-display text-5xl font-semibold text-ink">
                  Rs. {(user?.walletBalance ?? 1980).toLocaleString("en-IN")}
                </h2>
              </div>
            </div>
          </SurfaceCard>

          <SavedPaymentDetailsSection
            title="Saved payment methods"
            description="Manage the same saved cards and UPI IDs that are reused across wallet surfaces and checkout."
            defaultHolderName={user?.fullName}
          />
        </div>

        <SurfaceCard className="space-y-4">
          <SectionHeading title="Recent wallet activity" description="Shared demo ledger until wallet endpoints are surfaced page-by-page." />
          <Table columns={["Date", "Activity", "Amount"]} rows={rows} className="border-none bg-transparent shadow-none" />
        </SurfaceCard>
      </div>
    </PageShell>
  );
};
