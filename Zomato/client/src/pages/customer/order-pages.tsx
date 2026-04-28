import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CreditCard, Edit3, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDangerModal } from "@/components/admin/admin-ui";
import { RouteMap } from "@/components/maps/route-map";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { IndianPhoneInput } from "@/components/ui/indian-phone-input";
import { Modal } from "@/components/ui/modal";
import { PageShell, SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { getApiErrorMessage } from "@/lib/auth";
import {
  createCustomerAddress,
  deleteCustomerPaymentMethod,
  createCustomerPaymentMethod,
  createCustomerReview,
  clearCustomerCart,
  clearPendingCustomerCouponSelection,
  getCustomerAddresses,
  getCustomerCarts,
  getCustomerOrderById,
  getCustomerOrders,
  getCustomerPaymentMethods,
  getPublicOffers,
  placeCustomerOrder,
  readPendingCustomerCouponSelection,
  removeCustomerCartItem,
  removeCustomerCartOffer,
  setDefaultCustomerSavedPaymentMethod,
  type CustomerAddressPayload,
  type CustomerPaymentMethod,
  type CustomerOffer,
  updateCustomerCartItem,
  updateCustomerReview,
  updateCustomerPaymentMethod,
  updateCustomerAddress,
  writePendingCustomerCouponSelection,
  type CustomerAddress,
  type CustomerCart,
  type CustomerOrder,
  applyCustomerCartOffer,
} from "@/lib/customer";
import { cn } from "@/utils/cn";
import { getOrderById, getStatusTone, orders, paymentMethods, savedAddresses } from "@/lib/demo-data";
import {
  formatIndianPhoneDisplay,
  getIndianPhoneInputValue,
  requiredIndianPhoneSchema,
} from "@/lib/phone";

const linkButtonClassName =
  "inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const formatOrderDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const formatOrderItemsSummary = (items: CustomerOrder["items"]) => {
  if (!items.length) {
    return "Items will appear here once the order is confirmed.";
  }

  const preview = items.slice(0, 2).map((item) => `${item.quantity}x ${item.itemName}`);
  const extraCount = items.length - preview.length;

  return extraCount > 0 ? `${preview.join(", ")} +${extraCount} more` : preview.join(", ");
};

const normalizeCouponCode = (value?: string | null) => value?.trim().toUpperCase() ?? "";

const formatCouponSavingsSummary = (offer: {
  title: string;
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number | null;
}) => {
  const savings =
    offer.discountType === "PERCENTAGE"
      ? `${offer.discountValue}% off`
      : `${formatCurrency(offer.discountValue)} off`;

  const details = [`${savings} on eligible orders`, `Min ${formatCurrency(offer.minOrderAmount)}`];

  if (offer.maxDiscount) {
    details.push(`Max ${formatCurrency(offer.maxDiscount)}`);
  }

  return details.join(" - ");
};

const isCouponEligibleForCart = (offer: CustomerOffer, cart: CustomerCart) => {
  const matchesRestaurantScope =
    offer.scope !== "RESTAURANT" ||
    !offer.restaurantLinks.length ||
    offer.restaurantLinks.some((link) => link.restaurant.id === cart.restaurant.id);

  return offer.isActive && matchesRestaurantScope && cart.summary.subtotal >= offer.minOrderAmount;
};

const getCouponScopeSummary = (offer: CustomerOffer, cart: CustomerCart) => {
  if (offer.scope !== "RESTAURANT" || !offer.restaurantLinks.length) {
    return "Platform offer";
  }

  return offer.restaurantLinks.some((link) => link.restaurant.id === cart.restaurant.id)
    ? `Matches ${cart.restaurant.name}`
    : `Only for ${offer.restaurantLinks.map((link) => link.restaurant.name).join(", ")}`;
};

const toLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const tipOptions = [0, 30, 50, 100];

const sanitizeTipAmount = (value?: string | number | null) => {
  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(value ?? "0");

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  return Math.round(numericValue);
};

const getOrderStatusTone = (status: string) => {
  const normalized = status.toUpperCase();

  if (normalized.includes("DELIVERED")) {
    return "success" as const;
  }

  if (
    normalized.includes("CANCELLED") ||
    normalized.includes("FAILED") ||
    normalized.includes("REFUNDED")
  ) {
    return "warning" as const;
  }

  if (normalized.includes("DELAYED")) {
    return "warning" as const;
  }

  return "info" as const;
};

const formatEtaMinutes = (value?: number | null) =>
  value != null ? `${value} min` : "Pending";

const formatDistanceKm = (value?: number | null) =>
  value != null ? `${value.toFixed(1)} km` : "Pending";

const buildOrderRouteMarkers = (order: CustomerOrder) => [
  {
    id: `restaurant-${order.id}`,
    label: order.restaurant.name,
    description: "Pickup point",
    latitude: order.restaurant.latitude,
    longitude: order.restaurant.longitude,
    color: "#d97706",
  },
  {
    id: `customer-${order.id}`,
    label: order.address.title?.trim() || "Delivery address",
    description: [order.address.area, order.address.city].filter(Boolean).join(", ") || "Drop-off point",
    latitude: order.address.latitude,
    longitude: order.address.longitude,
    color: "#0f766e",
  },
  ...(order.deliveryPartner?.currentLatitude != null && order.deliveryPartner?.currentLongitude != null
    ? [
        {
          id: `partner-${order.deliveryPartner.id}`,
          label: order.deliveryPartner.user.fullName,
          description: "Delivery partner",
          latitude: order.deliveryPartner.currentLatitude,
          longitude: order.deliveryPartner.currentLongitude,
          color: "#8b1e24",
        },
      ]
    : []),
];

const parseSnapshot = (value?: string | null) => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as {
      includedItems?: Array<{
        menuItemId: number;
        name: string;
        image?: string | null;
        quantity: number;
      }>;
      categoryTag?: string | null;
    };
  } catch {
    return null;
  }
};

const isLiveCustomerSession = (isAuthenticated: boolean, role?: string | null) =>
  isAuthenticated && role === "CUSTOMER";

const mergeCustomerOrderLocation = (
  order: CustomerOrder,
  payload: {
    latitude: number;
    longitude: number;
    timestamp: string;
    deliveryPartnerUserId?: number;
  },
) => {
  if (!order.deliveryPartner) {
    return order;
  }

  if (
    payload.deliveryPartnerUserId &&
    order.deliveryPartner.userId !== payload.deliveryPartnerUserId
  ) {
    return order;
  }

  return {
    ...order,
    deliveryPartner: {
      ...order.deliveryPartner,
      currentLatitude: payload.latitude,
      currentLongitude: payload.longitude,
      lastLocationUpdatedAt: payload.timestamp,
    },
  };
};

const terminalOrderStatuses = new Set(["DELIVERED", "CANCELLED", "REFUNDED", "PAYMENT_FAILED"]);

const isActiveTrackedOrder = (status?: string | null) =>
  status ? !terminalOrderStatuses.has(status.trim().toUpperCase()) : false;

const isDeliveredOrder = (status?: string | null) => status?.trim().toUpperCase() === "DELIVERED";

const canReviewOrder = (order?: CustomerOrder | null) => Boolean(order && isDeliveredOrder(order.status));

const syncCustomerOrderStatus = (order: CustomerOrder, status?: string | null): CustomerOrder => {
  if (!status || order.status === status) {
    return order;
  }

  return {
    ...order,
    status,
  };
};

const syncCustomerOrderReview = (
  order: CustomerOrder,
  review: NonNullable<CustomerOrder["review"]>,
): CustomerOrder => ({
  ...order,
  review,
});

const OrderReviewModal = ({
  open,
  order,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  order: CustomerOrder;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { rating: number; reviewText?: string }) => Promise<void>;
}) => {
  const [rating, setRating] = useState<string>("5");
  const [reviewText, setReviewText] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setRating(String(order.review?.rating ?? 5));
    setReviewText(order.review?.reviewText ?? "");
  }, [open, order.review?.id, order.review?.rating, order.review?.reviewText]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={order.review ? "Update your rating" : "Rate your delivered order"}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({
            rating: Number(rating),
            reviewText: reviewText.trim() || undefined,
          });
        }}
      >
        <p className="text-sm leading-7 text-ink-soft">
          Share your experience with {order.restaurant.name}. Reviews stay limited to delivered orders from your account.
        </p>
        <Select label="Rating" value={rating} onChange={(event) => setRating(event.target.value)} disabled={isSubmitting}>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} / 5
            </option>
          ))}
        </Select>
        <Textarea
          label="Review"
          placeholder="Tell us how the order arrived, tasted, and felt overall."
          value={reviewText}
          onChange={(event) => setReviewText(event.target.value)}
          disabled={isSubmitting}
        />
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Saving..."
              : order.review
                ? "Save review"
                : "Submit review"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const paymentModeContent = {
  CARD: {
    title: paymentMethods[0]?.title ?? "Saved card",
    subtitle: paymentMethods[0]?.subtitle ?? "Pay with your saved card.",
  },
  UPI: {
    title: paymentMethods[1]?.title ?? "UPI",
    subtitle: paymentMethods[1]?.subtitle ?? "Fast checkout with your UPI app.",
  },
  WALLET: {
    title: paymentMethods[2]?.title ?? "Wallet balance",
    subtitle: paymentMethods[2]?.subtitle ?? "Use your available wallet balance.",
  },
  COD: {
    title: "Cash on delivery",
    subtitle: "Pay your rider at handoff if you prefer an offline finish.",
  },
} as const;

type CheckoutPaymentTab = keyof typeof paymentModeContent;

type StoredCardDetails = {
  label: string;
  holderName: string;
  last4: string;
  expiryMonth: string;
  expiryYear: string;
  isPrimary: boolean;
};

type StoredUpiDetails = {
  upiId: string;
  appLabel?: string;
  isPrimary: boolean;
};

type StoredPaymentPreferences = {
  card?: StoredCardDetails | null;
  upi?: StoredUpiDetails | null;
};

const PAYMENT_PREFERENCES_STORAGE_PREFIX = "zomato-luxe-payment-preferences";

const cardDetailsSchema = z.object({
  label: z.string().trim().min(2, "Card label is required.").max(40),
  holderName: z.string().trim().min(2, "Card holder name is required.").max(80),
  last4: z.string().trim().regex(/^\d{4}$/, "Enter the last 4 digits only."),
  expiryMonth: z.string().trim().regex(/^(0[1-9]|1[0-2])$/, "Use a valid month like 08."),
  expiryYear: z.string().trim().regex(/^\d{2,4}$/, "Use a valid expiry year."),
  isPrimary: z.boolean().default(true),
});

const upiDetailsSchema = z.object({
  upiId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/, "Enter a valid UPI ID."),
  appLabel: z.string().trim().max(40).optional().or(z.literal("")),
  isPrimary: z.boolean().default(true),
});

type CardDetailsFormValues = z.infer<typeof cardDetailsSchema>;
type UpiDetailsFormValues = z.infer<typeof upiDetailsSchema>;

const getPaymentPreferencesStorageKey = (userId?: number | null) =>
  `${PAYMENT_PREFERENCES_STORAGE_PREFIX}:${userId ?? "guest"}`;

const readStoredPaymentPreferences = (storageKey: string): StoredPaymentPreferences => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return {};
    }

    return JSON.parse(rawValue) as StoredPaymentPreferences;
  } catch {
    return {};
  }
};

const writeStoredPaymentPreferences = (storageKey: string, value: StoredPaymentPreferences) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(value));
};

const normalizeText = (value?: string | null) => value?.trim() ?? "";

const getPreferredPaymentMethod = (paymentMethods: CustomerPaymentMethod[], type: CustomerPaymentMethod["type"]) =>
  paymentMethods.find((paymentMethod) => paymentMethod.type === type && paymentMethod.isPrimary) ??
  paymentMethods.find((paymentMethod) => paymentMethod.type === type) ??
  null;

const toStoredCardDetails = (paymentMethod: CustomerPaymentMethod | null): StoredCardDetails | null =>
  paymentMethod && paymentMethod.type === "CARD"
    ? {
        label: paymentMethod.label?.trim() || "Saved card",
        holderName: paymentMethod.holderName?.trim() || "",
        last4: paymentMethod.maskedEnding?.trim() || "",
        expiryMonth: paymentMethod.expiryMonth?.trim() || "",
        expiryYear: paymentMethod.expiryYear?.trim() || "",
        isPrimary: paymentMethod.isPrimary,
      }
    : null;

const toStoredUpiDetails = (paymentMethod: CustomerPaymentMethod | null): StoredUpiDetails | null =>
  paymentMethod && paymentMethod.type === "UPI"
    ? {
        upiId: paymentMethod.upiId?.trim() || "",
        appLabel: paymentMethod.label?.trim() || undefined,
        isPrimary: paymentMethod.isPrimary,
      }
    : null;

const getSavedPaymentMethodTitle = (paymentMethod: CustomerPaymentMethod) => {
  if (paymentMethod.type === "CARD") {
    return `${paymentMethod.label ?? "Card"} - **** **** **** ${paymentMethod.maskedEnding ?? "0000"}`;
  }

  return paymentMethod.label?.trim()
    ? `${paymentMethod.label} - ${paymentMethod.upiId ?? ""}`
    : `UPI - ${paymentMethod.upiId ?? "No ID"}`;
};

const getSavedPaymentMethodSubtitle = (paymentMethod: CustomerPaymentMethod) => {
  if (paymentMethod.type === "CARD") {
    const details = [
      paymentMethod.holderName?.trim(),
      paymentMethod.expiryMonth && paymentMethod.expiryYear
        ? `Expires ${paymentMethod.expiryMonth}/${paymentMethod.expiryYear}`
        : null,
    ].filter(Boolean);

    return details.join(" - ") || "Masked card summary";
  }

  return paymentMethod.isPrimary ? "Primary UPI method" : "Ready for quick checkout";
};

const toPaymentMethodPayload = (paymentMethod: CustomerPaymentMethod) =>
  paymentMethod.type === "CARD"
    ? ({
        type: "CARD",
        label: paymentMethod.label?.trim() || "Saved card",
        holderName: paymentMethod.holderName?.trim() || "",
        maskedEnding: paymentMethod.maskedEnding?.trim() || "",
        expiryMonth: paymentMethod.expiryMonth?.trim() || "",
        expiryYear: paymentMethod.expiryYear?.trim() || "",
        isPrimary: paymentMethod.isPrimary,
      } as const)
    : ({
        type: "UPI",
        label: paymentMethod.label?.trim() || undefined,
        upiId: paymentMethod.upiId?.trim() || "",
        isPrimary: paymentMethod.isPrimary,
      } as const);

const CardDetailsModal = ({
  open,
  details,
  defaultHolderName,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  details: StoredCardDetails | null;
  defaultHolderName?: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: CardDetailsFormValues) => Promise<void>;
}) => {
  const form = useForm<CardDetailsFormValues>({
    resolver: zodResolver(cardDetailsSchema),
    defaultValues: {
      label: details?.label ?? "",
      holderName: details?.holderName ?? normalizeText(defaultHolderName),
      last4: details?.last4 ?? "",
      expiryMonth: details?.expiryMonth ?? "",
      expiryYear: details?.expiryYear ?? "",
      isPrimary: details?.isPrimary ?? true,
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      label: details?.label ?? "",
      holderName: details?.holderName ?? normalizeText(defaultHolderName),
      last4: details?.last4 ?? "",
      expiryMonth: details?.expiryMonth ?? "",
      expiryYear: details?.expiryYear ?? "",
      isPrimary: details?.isPrimary ?? true,
    });
  }, [defaultHolderName, details, form, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      ...values,
      label: values.label.trim(),
      holderName: values.holderName.trim(),
      last4: values.last4.trim(),
      expiryMonth: values.expiryMonth.trim(),
      expiryYear: values.expiryYear.trim(),
    });
  });

  return (
    <Modal open={open} onClose={onClose} title={details ? "Update card summary" : "Add card summary"}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4 text-sm leading-7 text-ink-soft">
          Only a masked card summary is saved here for quick checkout. Full card numbers and CVV are never stored.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Card label"
            placeholder="Visa Personal"
            error={form.formState.errors.label?.message}
            {...form.register("label")}
          />
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
            error={form.formState.errors.last4?.message}
            {...form.register("last4")}
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
        <label className="flex items-center justify-between rounded-[1.5rem] border border-accent/10 bg-cream-soft/60 px-4 py-3">
          <span className="text-sm font-semibold text-ink">Mark as primary card</span>
          <input type="checkbox" className="h-4 w-4 accent-[rgb(139,30,36)]" {...form.register("isPrimary")} />
        </label>
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : details ? "Save card" : "Add card"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const UpiDetailsModal = ({
  open,
  details,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  details: StoredUpiDetails | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: UpiDetailsFormValues) => Promise<void>;
}) => {
  const form = useForm<UpiDetailsFormValues>({
    resolver: zodResolver(upiDetailsSchema),
    defaultValues: {
      upiId: details?.upiId ?? "",
      appLabel: details?.appLabel ?? "",
      isPrimary: details?.isPrimary ?? true,
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      upiId: details?.upiId ?? "",
      appLabel: details?.appLabel ?? "",
      isPrimary: details?.isPrimary ?? true,
    });
  }, [details, form, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      upiId: values.upiId.trim(),
      appLabel: values.appLabel?.trim() ?? "",
      isPrimary: values.isPrimary,
    });
  });

  return (
    <Modal open={open} onClose={onClose} title={details ? "Update UPI ID" : "Add UPI ID"}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="UPI ID"
          placeholder="aditi@okicici"
          error={form.formState.errors.upiId?.message}
          {...form.register("upiId")}
        />
        <Input
          label="App label"
          placeholder="GPay"
          error={form.formState.errors.appLabel?.message}
          {...form.register("appLabel")}
        />
        <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4 text-sm leading-7 text-ink-soft">
          Use an app tag like GPay, PhonePe, or Paytm if you want the summary card to read more naturally.
        </div>
        <label className="flex items-center justify-between rounded-[1.5rem] border border-accent/10 bg-cream-soft/60 px-4 py-3">
          <span className="text-sm font-semibold text-ink">Mark as primary UPI ID</span>
          <input type="checkbox" className="h-4 w-4 accent-[rgb(139,30,36)]" {...form.register("isPrimary")} />
        </label>
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : details ? "Save UPI ID" : "Add UPI ID"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const CHECKOUT_ADDRESS_TYPE_OPTIONS = [
  { value: "HOME", label: "Home" },
  { value: "WORK", label: "Work" },
  { value: "OTHER", label: "Other" },
] as const;

const checkoutAddressSchema = z.object({
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
  isDefault: z.boolean().default(false),
});

type CheckoutAddressFormValues = z.infer<typeof checkoutAddressSchema>;

const checkoutTimingOptions = [
  { value: "ASAP", label: "ASAP" },
  { value: "SCHEDULE_30", label: "30-45 min" },
  { value: "SCHEDULE_60", label: "60 min" },
] as const;

const checkoutHandoffOptions = [
  { value: "RING_BELL", label: "Ring bell" },
  { value: "LEAVE_AT_DOOR", label: "Leave at door" },
  { value: "CALL_ON_ARRIVAL", label: "Call on arrival" },
] as const;

const mapCheckoutAddressToFormValues = (
  address: CustomerAddress | null,
  defaults?: { recipientName?: string | null; contactPhone?: string | null },
): CheckoutAddressFormValues => ({
  addressType: (address?.addressType as CheckoutAddressFormValues["addressType"] | undefined) ?? "HOME",
  title: normalizeText(address?.title),
  recipientName: normalizeText(address?.recipientName) || normalizeText(defaults?.recipientName),
  contactPhone: getIndianPhoneInputValue(address?.contactPhone) || getIndianPhoneInputValue(defaults?.contactPhone),
  houseNo: normalizeText(address?.houseNo),
  street: normalizeText(address?.street),
  landmark: normalizeText(address?.landmark),
  area: normalizeText(address?.area),
  city: normalizeText(address?.city),
  state: normalizeText(address?.state),
  pincode: normalizeText(address?.pincode),
  isDefault: address?.isDefault ?? false,
});

const toCheckoutAddressPayload = (values: CheckoutAddressFormValues): CustomerAddressPayload => {
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
    isDefault: values.isDefault,
  };
};

const getCheckoutAddressHeading = (address: CustomerAddress) =>
  address.title?.trim() || toLabel(address.addressType);

const getCheckoutAddressLines = (address: CustomerAddress) => ({
  line1: [address.houseNo, address.street, address.area].filter(Boolean).join(", "),
  line2: [address.landmark, address.city, address.state, address.pincode].filter(Boolean).join(", "),
});

const getCheckoutOptionLabel = (
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) => options.find((option) => option.value === value)?.label ?? value;

const buildCheckoutSpecialInstructions = ({
  deliveryNotes,
  deliveryTiming,
  handoffPreference,
}: {
  deliveryNotes: string;
  deliveryTiming: string;
  handoffPreference: string;
}) => {
  const parts = [
    deliveryTiming !== "ASAP"
      ? `Timing: ${getCheckoutOptionLabel(checkoutTimingOptions, deliveryTiming)}`
      : null,
    handoffPreference !== "RING_BELL"
      ? `Handoff: ${getCheckoutOptionLabel(checkoutHandoffOptions, handoffPreference)}`
      : null,
    deliveryNotes.trim() ? `Notes: ${deliveryNotes.trim()}` : null,
  ].filter(Boolean);

  const serialized = parts.join(" | ").trim();
  return serialized ? serialized.slice(0, 500) : "";
};

const buildPaymentHref = ({
  cartId,
  addressId,
  specialInstructions,
  tipAmount,
}: {
  cartId: number;
  addressId: number;
  specialInstructions: string;
  tipAmount: number;
}) => {
  const nextParams = new URLSearchParams({
    cartId: String(cartId),
    addressId: String(addressId),
  });

  if (specialInstructions.trim()) {
    nextParams.set("notes", specialInstructions.trim());
  }

  if (tipAmount > 0) {
    nextParams.set("tip", String(tipAmount));
  }

  return `/payment?${nextParams.toString()}`;
};

const CheckoutAddressFormModal = ({
  open,
  address,
  defaultRecipientName,
  defaultPhone,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  address: CustomerAddress | null;
  defaultRecipientName?: string | null;
  defaultPhone?: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: CheckoutAddressFormValues) => Promise<void>;
}) => {
  const form = useForm<CheckoutAddressFormValues>({
    resolver: zodResolver(checkoutAddressSchema),
    defaultValues: mapCheckoutAddressToFormValues(address, {
      recipientName: defaultRecipientName,
      contactPhone: defaultPhone,
    }),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(
      mapCheckoutAddressToFormValues(address, {
        recipientName: defaultRecipientName,
        contactPhone: defaultPhone,
      }),
    );
  }, [address, defaultPhone, defaultRecipientName, form, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <Modal open={open} onClose={onClose} title={address ? "Edit address" : "Add new address"} className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Address type" error={form.formState.errors.addressType?.message} {...form.register("addressType")}>
            {CHECKOUT_ADDRESS_TYPE_OPTIONS.map((option) => (
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
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (address ? "Saving..." : "Adding...") : address ? "Save changes" : "Add address"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export const CartPage = () => {
  const { isAuthenticated, user } = useAuth();
  const [carts, setCarts] = useState<CustomerCart[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<number | null>(null);
  const [pendingCartId, setPendingCartId] = useState<number | null>(null);
  const useLiveFlow = isLiveCustomerSession(isAuthenticated, user?.role);
  const demoOrder = orders[0];

  const loadCarts = async () => {
    if (!useLiveFlow) {
      return;
    }

    setIsLoading(true);
    try {
      setCarts(await getCustomerCarts());
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load your cart."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCarts();
  }, [useLiveFlow]);

  const handleQuantityChange = async (cartItemId: number, quantity: number) => {
    setPendingItemId(cartItemId);
    try {
      await updateCustomerCartItem(cartItemId, { quantity });
      await loadCarts();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update this cart item."));
    } finally {
      setPendingItemId(null);
    }
  };

  const handleRemoveItem = async (cartItemId: number) => {
    setPendingItemId(cartItemId);
    try {
      await removeCustomerCartItem(cartItemId);
      await loadCarts();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to remove this cart item."));
    } finally {
      setPendingItemId(null);
    }
  };

  const handleClearCart = async (cartId: number) => {
    setPendingCartId(cartId);
    try {
      await clearCustomerCart(cartId);
      await loadCarts();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to clear this cart."));
    } finally {
      setPendingCartId(null);
    }
  };

  if (!useLiveFlow) {
    return (
      <PageShell
        eyebrow="Cart"
        title="A calm final review before dinner arrives."
        description="Every line item, note, and total stays visible with a refined summary on larger screens."
        actions={<Link to="/checkout" className={linkButtonClassName}>Proceed to checkout</Link>}
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {demoOrder.items.map((item, index) => (
              <SurfaceCard key={item} className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-display text-3xl font-semibold text-ink">{item}</p>
                  <p className="mt-2 text-sm text-ink-soft">Prepared by {demoOrder.restaurantName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-ink-soft">Qty {index + 1}</p>
                  <p className="mt-2 text-lg font-semibold text-ink">₹{index === 0 ? "545" : "195"}</p>
                </div>
              </SurfaceCard>
            ))}
          </div>
          <SurfaceCard className="space-y-4 lg:sticky lg:top-28 lg:h-fit">
            <SectionHeading title="Order summary" description="Refined totals with room for delivery notes and promo savings." />
            <div className="space-y-3 text-sm text-ink-soft">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>₹1,040</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Delivery fee</span>
                <span>₹95</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Taxes</span>
                <span>₹110</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-ink">
                <span>Total payable</span>
                <span>{demoOrder.total}</span>
              </div>
            </div>
            <Button className="w-full" type="button">
              Continue to checkout
            </Button>
          </SurfaceCard>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Cart"
      title="A calm final review before dinner arrives."
      description="Live carts keep combo bundles, add-ons, and totals stable while preserving the current premium summary layout."
    >
      {isLoading ? (
        <SurfaceCard>
          <p className="text-sm text-ink-soft">Loading your active carts…</p>
        </SurfaceCard>
      ) : carts.length ? (
        <div className="space-y-8">
          {carts.map((cart) => (
            <div key={cart.id} className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                <SectionHeading
                  title={cart.restaurant.name}
                  description={`${cart.restaurant.avgDeliveryTime} min average delivery • ${cart.items.length} items`}
                />
                {cart.items.map((item) => {
                  const snapshot = item.snapshot ?? parseSnapshot(item.itemSnapshot);

                  return (
                    <SurfaceCard key={item.id} className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-display text-3xl font-semibold text-ink">{item.combo?.name ?? item.menuItem?.name ?? "Cart item"}</p>
                          <p className="mt-2 text-sm text-ink-soft">
                            {item.itemType === "COMBO" ? "Combo offer" : "Menu item"}
                          </p>
                        </div>
                        <p className="text-lg font-semibold text-ink">{formatCurrency(item.totalPrice)}</p>
                      </div>

                      {item.itemType === "COMBO" && snapshot?.includedItems?.length ? (
                        <div className="rounded-[1.5rem] bg-cream px-4 py-4 text-sm text-ink-soft">
                          <p className="font-semibold text-ink">Included items</p>
                          <p className="mt-2">
                            {snapshot.includedItems.map((includedItem) => `${includedItem.quantity}x ${includedItem.name}`).join(", ")}
                          </p>
                        </div>
                      ) : null}

                      {item.addons.length ? (
                        <div className="rounded-[1.5rem] bg-cream px-4 py-4 text-sm text-ink-soft">
                          <p className="font-semibold text-ink">Selected add-ons</p>
                          <p className="mt-2">
                            {item.addons.map((addon) => `${addon.addon.name} (${formatCurrency(addon.addonPrice)})`).join(", ")}
                          </p>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void handleQuantityChange(item.id, Math.max(1, item.quantity - 1))}
                            disabled={pendingItemId === item.id}
                          >
                            -
                          </Button>
                          <span className="text-sm font-semibold text-ink">Qty {item.quantity}</span>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void handleQuantityChange(item.id, item.quantity + 1)}
                            disabled={pendingItemId === item.id}
                          >
                            +
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => void handleRemoveItem(item.id)}
                          disabled={pendingItemId === item.id}
                        >
                          {pendingItemId === item.id ? "Removing..." : "Remove"}
                        </Button>
                      </div>
                    </SurfaceCard>
                  );
                })}
              </div>

              <SurfaceCard className="space-y-4 lg:sticky lg:top-28 lg:h-fit">
                <SectionHeading title="Order summary" description={cart.restaurant.name} />
                <div className="space-y-3 text-sm text-ink-soft">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(cart.summary.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Delivery fee</span>
                    <span>{formatCurrency(cart.summary.deliveryFee)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Taxes</span>
                    <span>{formatCurrency(cart.summary.taxAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Discount</span>
                    <span>-{formatCurrency(cart.summary.discountAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold text-ink">
                    <span>Total payable</span>
                    <span>{formatCurrency(cart.summary.payableTotal)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <Link to={`/checkout?cartId=${cart.id}`} className={linkButtonClassName}>
                    Proceed to checkout
                  </Link>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleClearCart(cart.id)}
                    disabled={pendingCartId === cart.id}
                  >
                    {pendingCartId === cart.id ? "Clearing..." : "Clear cart"}
                  </Button>
                </div>
              </SurfaceCard>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <EmptyState
            title="Your cart is empty"
            description="Add dishes or combos from a restaurant page to start a live order."
          />
          <div className="flex justify-center">
            <Link to="/restaurants" className={linkButtonClassName}>
              Browse restaurants
            </Link>
          </div>
        </div>
      )}
    </PageShell>
  );
};

export const CheckoutPage = () => {
  const { isAuthenticated, user } = useAuth();
  const [params] = useSearchParams();
  const [carts, setCarts] = useState<CustomerCart[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [deliveryTiming, setDeliveryTiming] = useState("ASAP");
  const [handoffPreference, setHandoffPreference] = useState("RING_BELL");
  const [tipAmount, setTipAmount] = useState(() => sanitizeTipAmount(params.get("tip")));
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const useLiveFlow = isLiveCustomerSession(isAuthenticated, user?.role);

  const loadCheckoutData = async () => {
    if (!useLiveFlow) {
      return;
    }

    setIsLoading(true);
    try {
      const [cartRows, addressRows] = await Promise.all([getCustomerCarts(), getCustomerAddresses()]);
      setCarts(cartRows);
      setAddresses(addressRows);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load checkout details."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCheckoutData();
  }, [useLiveFlow]);

  useEffect(() => {
    if (!addresses.length) {
      setSelectedAddressId(null);
      return;
    }

    setSelectedAddressId((currentValue) => {
      if (currentValue && addresses.some((address) => address.id === currentValue)) {
        return currentValue;
      }

      const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
      return defaultAddress.id;
    });
  }, [addresses]);

  const selectedCart =
    carts.find((cart) => String(cart.id) === params.get("cartId")) ?? carts[0] ?? null;
  const serializedCheckoutDetails = buildCheckoutSpecialInstructions({
    deliveryNotes: specialInstructions,
    deliveryTiming,
    handoffPreference,
  });
  const paymentHref =
    selectedCart && selectedAddressId
      ? buildPaymentHref({
          cartId: selectedCart.id,
          addressId: selectedAddressId,
          specialInstructions: serializedCheckoutDetails,
          tipAmount,
        })
      : null;

  const handleOpenNewAddress = () => {
    setEditingAddress(null);
    setIsAddressModalOpen(true);
  };

  const handleOpenEditAddress = (address: CustomerAddress) => {
    setEditingAddress(address);
    setIsAddressModalOpen(true);
  };

  const handleCloseAddressModal = () => {
    if (isSavingAddress) {
      return;
    }

    setIsAddressModalOpen(false);
    setEditingAddress(null);
  };

  const handleSaveAddress = async (values: CheckoutAddressFormValues) => {
    setIsSavingAddress(true);

    try {
      const payload = toCheckoutAddressPayload(values);

      if (editingAddress) {
        const updatedAddress = await updateCustomerAddress(editingAddress.id, payload);
        setSelectedAddressId(updatedAddress.id);
        toast.success("Address updated successfully.");
      } else {
        const createdAddress = await createCustomerAddress(payload);
        setSelectedAddressId(createdAddress.id);
        toast.success("Address added successfully.");
      }

      await loadCheckoutData();
      setIsAddressModalOpen(false);
      setEditingAddress(null);
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          editingAddress ? "Unable to update this address right now." : "Unable to add this address right now.",
        ),
      );
    } finally {
      setIsSavingAddress(false);
    }
  };

  if (!useLiveFlow) {
    return (
      <PageShell
        eyebrow="Checkout"
        title="Confirm address, timing, and handoff details."
        description="Structured checkout keeps addresses, delivery notes, and order recap separated without changing the broader layout language."
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <SurfaceCard className="space-y-4">
              <SectionHeading title="Saved addresses" description="Choose the handoff point that fits tonight’s plan." />
              <div className="grid gap-4">
                {savedAddresses.map((address) => (
                  <div key={address.title} className="rounded-[1.5rem] bg-cream px-5 py-4">
                    <p className="font-semibold text-ink">{address.title}</p>
                    <p className="mt-2 text-sm text-ink-soft">{address.line1}</p>
                    <p className="text-sm text-ink-soft">{address.line2}</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>
            <SurfaceCard className="space-y-4">
              <SectionHeading title="Delivery notes" description="Share gate codes, floor numbers, or preferred handoff details." />
              <Input placeholder="Add instructions for the rider" />
            </SurfaceCard>
          </div>
          <SurfaceCard className="space-y-4 lg:sticky lg:top-28 lg:h-fit">
            <SectionHeading title="Tonight’s order" description="Saffron Story" />
            {orders[0].items.map((item) => (
              <div key={item} className="flex items-center justify-between text-sm text-ink-soft">
                <span>{item}</span>
                <span>₹{item.includes("Biryani") ? "545" : "195"}</span>
              </div>
            ))}
            <div className="border-t border-accent/10 pt-4 text-sm font-semibold text-ink">
              <div className="flex items-center justify-between">
                <span>Total</span>
                <span>{orders[0].total}</span>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Checkout"
      title="Confirm address, timing, and handoff details."
      description="Live checkout keeps combo bundles, add-ons, and order recap together without changing the current layout language."
    >
      {isLoading ? (
        <SurfaceCard>
          <p className="text-sm text-ink-soft">Loading checkout details…</p>
        </SurfaceCard>
      ) : selectedCart ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <SurfaceCard className="space-y-4">
              <SectionHeading title="Saved addresses" description="Choose the handoff point that fits tonight’s plan." />
              <div className="flex justify-end">
                <Button type="button" variant="secondary" onClick={handleOpenNewAddress}>
                  Add address
                </Button>
              </div>
              <div className="grid gap-4">
                {addresses.length ? (
                  addresses.map((address) => {
                    const addressLines = getCheckoutAddressLines(address);
                    const isSelected = selectedAddressId === address.id;

                    return (
                      <div
                        key={address.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedAddressId(address.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedAddressId(address.id);
                          }
                        }}
                        className={
                          isSelected
                            ? "cursor-pointer rounded-[1.5rem] border border-accent bg-accent/[0.04] px-5 py-4 text-left"
                            : "cursor-pointer rounded-[1.5rem] bg-cream px-5 py-4 text-left"
                        }
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-ink">{getCheckoutAddressHeading(address)}</p>
                              {address.isDefault ? <StatusPill label="Default" tone="info" /> : null}
                              {isSelected ? <StatusPill label="Selected" tone="success" /> : null}
                            </div>
                            {address.recipientName ? (
                              <p className="text-sm font-medium text-ink-soft">{address.recipientName}</p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {!isSelected ? (
                              <Button
                                type="button"
                                variant="secondary"
                                className="px-4 py-2 text-xs"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedAddressId(address.id);
                                }}
                              >
                                Deliver here
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              className="px-3 py-2 text-xs"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenEditAddress(address);
                              }}
                            >
                              Edit address
                            </Button>
                          </div>
                        </div>
                        {addressLines.line1 ? <p className="mt-3 text-sm text-ink-soft">{addressLines.line1}</p> : null}
                        {addressLines.line2 ? <p className="text-sm text-ink-soft">{addressLines.line2}</p> : null}
                        {address.contactPhone ? <p className="mt-2 text-sm text-ink-muted">{formatIndianPhoneDisplay(address.contactPhone)}</p> : null}
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    title="No saved addresses yet"
                    description="Add an address here to keep the order flow moving without leaving checkout."
                  />
                )}
              </div>
            </SurfaceCard>
            <SurfaceCard className="space-y-5">
              <SectionHeading
                title="Timing and handoff"
                description="Choose when you want the order and how you want the rider to complete the handoff."
              />
              <div className="space-y-4">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-ink">Delivery timing</p>
                  <div className="flex flex-wrap gap-3">
                    {checkoutTimingOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDeliveryTiming(option.value)}
                        className={
                          deliveryTiming === option.value
                            ? "rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft"
                            : "rounded-full border border-accent/15 bg-white px-4 py-2 text-sm font-semibold text-ink-soft shadow-soft"
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-ink">Handoff preference</p>
                  <div className="flex flex-wrap gap-3">
                    {checkoutHandoffOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setHandoffPreference(option.value)}
                        className={
                          handoffPreference === option.value
                            ? "rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft"
                            : "rounded-full border border-accent/15 bg-white px-4 py-2 text-sm font-semibold text-ink-soft shadow-soft"
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4 text-sm leading-7 text-ink-soft">
                  {`Selected: ${getCheckoutOptionLabel(checkoutTimingOptions, deliveryTiming)} | ${getCheckoutOptionLabel(checkoutHandoffOptions, handoffPreference)}`}
                </div>
              </div>
            </SurfaceCard>
            <SurfaceCard className="space-y-4">
              <SectionHeading title="Delivery notes" description="Share gate codes, floor numbers, or preferred handoff details." />
              <Input
                placeholder="Add instructions for the rider"
                value={specialInstructions}
                onChange={(event) => setSpecialInstructions(event.target.value)}
                maxLength={320}
              />
            </SurfaceCard>
            <SurfaceCard className="space-y-4">
              <SectionHeading
                title="Tip your delivery partner"
                description="Carry a small thank-you into payment, tracking, and the final order summary."
              />
              <div className="flex flex-wrap gap-3">
                {tipOptions.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setTipAmount(amount)}
                    className={
                      tipAmount === amount
                        ? "rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft"
                        : "rounded-full border border-accent/15 bg-white px-4 py-2 text-sm font-semibold text-ink-soft shadow-soft"
                    }
                  >
                    {amount === 0 ? "No tip" : `Add ${formatCurrency(amount)}`}
                  </button>
                ))}
              </div>
            </SurfaceCard>
          </div>
          <SurfaceCard className="space-y-4 lg:sticky lg:top-28 lg:h-fit">
            <SectionHeading title="Tonight’s order" description={selectedCart.restaurant.name} />
            {selectedCart.items.map((item) => (
              <div key={item.id} className="space-y-2 text-sm text-ink-soft">
                <div className="flex items-center justify-between">
                  <span>{item.combo?.name ?? item.menuItem?.name ?? "Cart item"}</span>
                  <span>{formatCurrency(item.totalPrice)}</span>
                </div>
                {item.addons.length ? (
                  <p className="text-xs text-ink-muted">
                    {item.addons.map((addon) => addon.addon.name).join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
            <div className="border-t border-accent/10 pt-4 text-sm font-semibold text-ink">
              {tipAmount ? (
                <div className="mb-2 flex items-center justify-between text-sm font-medium text-ink-soft">
                  <span>Tip</span>
                  <span>{formatCurrency(tipAmount)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span>Total</span>
                <span>{formatCurrency(selectedCart.summary.payableTotal + tipAmount)}</span>
              </div>
            </div>
            {paymentHref ? (
              <Link to={paymentHref} className={linkButtonClassName}>
                Continue to payment
              </Link>
            ) : null}
          </SurfaceCard>
        </div>
      ) : (
        <div className="space-y-4">
          <EmptyState
            title="No cart selected"
            description="Choose a restaurant and add dishes or combos before checking out."
          />
          <div className="flex justify-center">
            <Link to="/restaurants" className={linkButtonClassName}>
              Browse restaurants
            </Link>
          </div>
        </div>
      )}
      <CheckoutAddressFormModal
        open={isAddressModalOpen}
        address={editingAddress}
        defaultRecipientName={user?.fullName}
        defaultPhone={user?.phone}
        isSubmitting={isSavingAddress}
        onClose={handleCloseAddressModal}
        onSubmit={handleSaveAddress}
      />
    </PageShell>
  );
};

export const PaymentPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [params] = useSearchParams();
  const [activeMethod, setActiveMethod] = useState<CheckoutPaymentTab>("CARD");
  const [carts, setCarts] = useState<CustomerCart[]>([]);
  const [availableOffers, setAvailableOffers] = useState<CustomerOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [savedPaymentPreferences, setSavedPaymentPreferences] = useState<StoredPaymentPreferences>({});
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<CustomerPaymentMethod[]>([]);
  const [selectedCardMethodId, setSelectedCardMethodId] = useState<number | null>(null);
  const [selectedUpiMethodId, setSelectedUpiMethodId] = useState<number | null>(null);
  const [editingCardMethod, setEditingCardMethod] = useState<CustomerPaymentMethod | null>(null);
  const [editingUpiMethod, setEditingUpiMethod] = useState<CustomerPaymentMethod | null>(null);
  const [deleteTargetPaymentMethod, setDeleteTargetPaymentMethod] = useState<CustomerPaymentMethod | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [isSavingPaymentDetails, setIsSavingPaymentDetails] = useState(false);
  const [isDeletingPaymentMethod, setIsDeletingPaymentMethod] = useState(false);
  const [cardSecurityCode, setCardSecurityCode] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponMessageTone, setCouponMessageTone] = useState<"info" | "success" | "error">("info");
  const [pendingCouponCode, setPendingCouponCode] = useState("");
  const [pendingCouponCartId, setPendingCouponCartId] = useState<number | null>(null);
  const useLiveFlow = isLiveCustomerSession(isAuthenticated, user?.role);
  const paymentPreferencesStorageKey = useMemo(
    () => getPaymentPreferencesStorageKey(user?.id),
    [user?.id],
  );
  const cartParam = params.get("cartId");
  const couponParam = normalizeCouponCode(params.get("coupon"));
  const savedCardMethods = useLiveFlow ? savedPaymentMethods.filter((paymentMethod) => paymentMethod.type === "CARD") : [];
  const savedUpiMethods = useLiveFlow ? savedPaymentMethods.filter((paymentMethod) => paymentMethod.type === "UPI") : [];

  const loadSavedPaymentMethods = async () => {
    const paymentMethodRows = await getCustomerPaymentMethods();
    setSavedPaymentMethods(paymentMethodRows);
    return paymentMethodRows;
  };

  useEffect(() => {
    if (!useLiveFlow) {
      return;
    }

    setIsLoading(true);
    void Promise.all([getCustomerCarts(), loadSavedPaymentMethods()])
      .then(([cartRows]) => setCarts(cartRows))
      .catch((error) => {
        toast.error(getApiErrorMessage(error, "Unable to load the payment summary."));
      })
      .finally(() => setIsLoading(false));
  }, [useLiveFlow]);

  useEffect(() => {
    if (!useLiveFlow) {
      setAvailableOffers([]);
      setIsLoadingOffers(false);
      return;
    }

    let isMounted = true;
    setIsLoadingOffers(true);

    void getPublicOffers()
      .then((offerRows) => {
        if (isMounted) {
          setAvailableOffers(offerRows);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAvailableOffers([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingOffers(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [useLiveFlow]);

  useEffect(() => {
    if (useLiveFlow) {
      setSavedPaymentPreferences({});
      return;
    }

    setSavedPaymentPreferences(readStoredPaymentPreferences(paymentPreferencesStorageKey));
  }, [paymentPreferencesStorageKey, useLiveFlow]);

  useEffect(() => {
    setPaymentError(null);
  }, [
    activeMethod,
    cardSecurityCode,
    savedPaymentMethods,
    savedPaymentPreferences,
    selectedCardMethodId,
    selectedUpiMethodId,
    user?.walletBalance,
  ]);

  useEffect(() => {
    if (!useLiveFlow) {
      setSelectedCardMethodId(null);
      return;
    }

    if (!savedCardMethods.length) {
      setSelectedCardMethodId(null);
      return;
    }

    setSelectedCardMethodId((currentId) =>
      currentId && savedCardMethods.some((paymentMethod) => paymentMethod.id === currentId)
        ? currentId
        : getPreferredPaymentMethod(savedCardMethods, "CARD")?.id ?? savedCardMethods[0]?.id ?? null,
    );
  }, [savedCardMethods, useLiveFlow]);

  useEffect(() => {
    setCardSecurityCode("");
  }, [selectedCardMethodId]);

  useEffect(() => {
    if (!useLiveFlow) {
      setSelectedUpiMethodId(null);
      return;
    }

    if (!savedUpiMethods.length) {
      setSelectedUpiMethodId(null);
      return;
    }

    setSelectedUpiMethodId((currentId) =>
      currentId && savedUpiMethods.some((paymentMethod) => paymentMethod.id === currentId)
        ? currentId
        : getPreferredPaymentMethod(savedUpiMethods, "UPI")?.id ?? savedUpiMethods[0]?.id ?? null,
    );
  }, [savedUpiMethods, useLiveFlow]);

  useEffect(() => {
    if (!useLiveFlow) {
      setPendingCouponCode("");
      setPendingCouponCartId(null);
      return;
    }

    const pendingSelection = readPendingCustomerCouponSelection(user?.id);
    setPendingCouponCode(normalizeCouponCode(pendingSelection?.code));
    setPendingCouponCartId(pendingSelection?.cartId ?? null);
  }, [useLiveFlow, user?.id]);

  const selectedCart =
    carts.find((cart) => String(cart.id) === (cartParam ?? (pendingCouponCartId ? String(pendingCouponCartId) : null))) ??
    carts[0] ??
    null;
  const addressId = Number(params.get("addressId") ?? "0");
  const specialInstructions = params.get("notes") ?? undefined;
  const tipAmount = sanitizeTipAmount(params.get("tip"));
  const payableWithTip = (selectedCart?.summary.payableTotal ?? 0) + tipAmount;
  const selectedCardMethod =
    (useLiveFlow
      ? savedCardMethods.find((paymentMethod) => paymentMethod.id === selectedCardMethodId) ??
        getPreferredPaymentMethod(savedCardMethods, "CARD")
      : null) ?? null;
  const selectedUpiMethod =
    (useLiveFlow
      ? savedUpiMethods.find((paymentMethod) => paymentMethod.id === selectedUpiMethodId) ??
        getPreferredPaymentMethod(savedUpiMethods, "UPI")
      : null) ?? null;
  const savedCardDetails = useLiveFlow ? toStoredCardDetails(selectedCardMethod) : savedPaymentPreferences.card ?? null;
  const savedUpiDetails = useLiveFlow ? toStoredUpiDetails(selectedUpiMethod) : savedPaymentPreferences.upi ?? null;
  const editingCardDetails = useLiveFlow ? toStoredCardDetails(editingCardMethod) : savedCardDetails;
  const editingUpiDetails = useLiveFlow ? toStoredUpiDetails(editingUpiMethod) : savedUpiDetails;
  const selectedPaymentSummary =
    activeMethod === "CARD"
      ? useLiveFlow
        ? selectedCardMethod
          ? getSavedPaymentMethodTitle(selectedCardMethod)
          : "No saved card selected"
        : savedCardDetails
          ? `${savedCardDetails.label} - **** **** **** ${savedCardDetails.last4}`
          : "No saved card selected"
      : activeMethod === "UPI"
        ? useLiveFlow
          ? selectedUpiMethod
            ? getSavedPaymentMethodTitle(selectedUpiMethod)
            : "No saved UPI selected"
          : savedUpiDetails
            ? savedUpiDetails.appLabel
              ? `${savedUpiDetails.appLabel} - ${savedUpiDetails.upiId}`
              : `UPI - ${savedUpiDetails.upiId}`
            : "No saved UPI selected"
        : activeMethod === "WALLET"
          ? paymentModeContent.WALLET.title
          : paymentModeContent.COD.title;
  const walletSubtitle = useLiveFlow
    ? `${formatCurrency(user?.walletBalance ?? 0)} available for checkout.`
    : paymentModeContent.WALLET.subtitle;
  const eligibleCoupons = useMemo(
    () =>
      selectedCart
        ? availableOffers
            .filter((offer) => normalizeCouponCode(offer.code) && isCouponEligibleForCart(offer, selectedCart))
            .sort((left, right) => left.minOrderAmount - right.minOrderAmount)
        : [],
    [availableOffers, selectedCart],
  );
  const matchedCoupon =
    availableOffers.find(
      (offer) => normalizeCouponCode(offer.code) && normalizeCouponCode(offer.code) === normalizeCouponCode(couponCode),
    ) ?? null;
  const appliedCouponCode = normalizeCouponCode(selectedCart?.offer?.code);

  useEffect(() => {
    if (!useLiveFlow) {
      return;
    }

    if (appliedCouponCode) {
      setCouponCode(appliedCouponCode);

      if (appliedCouponCode === couponParam || appliedCouponCode === pendingCouponCode) {
        clearPendingCustomerCouponSelection(user?.id);
        setPendingCouponCode("");
        setPendingCouponCartId(null);
      }

      return;
    }

    const seededCoupon = couponParam || pendingCouponCode;
    if (!seededCoupon) {
      return;
    }

    setCouponCode((currentCode) => (currentCode.trim() ? currentCode : seededCoupon));
    setCouponMessage((currentMessage) => currentMessage ?? `${seededCoupon} is ready to apply for this payment.`);
    setCouponMessageTone("info");
  }, [appliedCouponCode, couponParam, pendingCouponCode, useLiveFlow, user?.id]);

  const persistPaymentPreferences = (nextValue: StoredPaymentPreferences) => {
    writeStoredPaymentPreferences(paymentPreferencesStorageKey, nextValue);
    setSavedPaymentPreferences(nextValue);
  };

  const handleCreateCard = () => {
    setEditingCardMethod(null);
    setIsCardModalOpen(true);
  };

  const handleEditCard = (paymentMethod: CustomerPaymentMethod) => {
    setEditingCardMethod(paymentMethod);
    setSelectedCardMethodId(paymentMethod.id);
    setIsCardModalOpen(true);
  };

  const handleCreateUpi = () => {
    setEditingUpiMethod(null);
    setIsUpiModalOpen(true);
  };

  const handleEditUpi = (paymentMethod: CustomerPaymentMethod) => {
    setEditingUpiMethod(paymentMethod);
    setSelectedUpiMethodId(paymentMethod.id);
    setIsUpiModalOpen(true);
  };

  const handleSetDefaultPaymentMethod = async (paymentMethod: CustomerPaymentMethod) => {
    if (paymentMethod.isDefault ?? paymentMethod.isPrimary) {
      if (paymentMethod.type === "CARD") {
        setSelectedCardMethodId(paymentMethod.id);
      } else {
        setSelectedUpiMethodId(paymentMethod.id);
      }

      return;
    }

    setIsSavingPaymentDetails(true);

    try {
      await setDefaultCustomerSavedPaymentMethod(paymentMethod.id);
      await loadSavedPaymentMethods();
      if (paymentMethod.type === "CARD") {
        setSelectedCardMethodId(paymentMethod.id);
      } else {
        setSelectedUpiMethodId(paymentMethod.id);
      }

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
      setIsSavingPaymentDetails(false);
    }
  };

  const handleDeleteSelectedPaymentMethod = async () => {
    if (!deleteTargetPaymentMethod) {
      return;
    }

    setIsDeletingPaymentMethod(true);

    try {
      await deleteCustomerPaymentMethod(deleteTargetPaymentMethod.id);
      const nextMethods = await loadSavedPaymentMethods();
      const nextCards = nextMethods.filter((paymentMethod) => paymentMethod.type === "CARD");
      const nextUpiMethods = nextMethods.filter((paymentMethod) => paymentMethod.type === "UPI");

      if (deleteTargetPaymentMethod.type === "CARD") {
        setSelectedCardMethodId(
          nextCards.find((paymentMethod) => paymentMethod.isPrimary)?.id ?? nextCards[0]?.id ?? null,
        );
        setEditingCardMethod(null);
      } else {
        setSelectedUpiMethodId(
          nextUpiMethods.find((paymentMethod) => paymentMethod.isPrimary)?.id ?? nextUpiMethods[0]?.id ?? null,
        );
        setEditingUpiMethod(null);
      }

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

  const getPaymentValidationMessage = () => {
    if (activeMethod === "CARD") {
      if (!cardDetailsSchema.safeParse(savedCardDetails).success) {
        return "Add a saved card before continuing.";
      }

      if (!/^\d{3,4}$/.test(cardSecurityCode.trim())) {
        return "Enter the card CVV for this payment. It is never stored.";
      }

      return null;
    }

    if (activeMethod === "UPI") {
      return upiDetailsSchema.safeParse(savedUpiDetails).success
        ? null
        : "Enter a valid UPI ID before continuing.";
    }

    if (activeMethod === "WALLET" && useLiveFlow && selectedCart) {
      return (user?.walletBalance ?? 0) >= payableWithTip
        ? null
        : "Wallet balance is not sufficient for this order.";
    }

    return null;
  };

  const updateCartRow = (updatedCart: CustomerCart) => {
    setCarts((currentCarts) => [updatedCart, ...currentCarts.filter((cart) => cart.id !== updatedCart.id)]);
  };

  const handleSaveCardDetails = async (values: CardDetailsFormValues) => {
    setIsSavingPaymentDetails(true);

    try {
      if (useLiveFlow) {
        if (editingCardMethod) {
          const updatedMethod = await updateCustomerPaymentMethod(editingCardMethod.id, {
            type: "CARD",
            label: values.label,
            holderName: values.holderName,
            maskedEnding: values.last4,
            expiryMonth: values.expiryMonth,
            expiryYear: values.expiryYear,
            isPrimary: values.isPrimary,
          });
          setSelectedCardMethodId(updatedMethod.id);
        } else {
          const createdMethod = await createCustomerPaymentMethod({
            type: "CARD",
            label: values.label,
            holderName: values.holderName,
            maskedEnding: values.last4,
            expiryMonth: values.expiryMonth,
            expiryYear: values.expiryYear,
            isPrimary: values.isPrimary,
          });
          setSelectedCardMethodId(createdMethod.id);
        }

        await loadSavedPaymentMethods();
      } else {
        const nextValue: StoredPaymentPreferences = {
          ...savedPaymentPreferences,
          card: values,
        };
        persistPaymentPreferences(nextValue);
      }

      toast.success("Card summary saved.");
      setEditingCardMethod(null);
      setIsCardModalOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save the card summary right now."));
    } finally {
      setIsSavingPaymentDetails(false);
    }
  };

  const handleSaveUpiDetails = async (values: UpiDetailsFormValues) => {
    setIsSavingPaymentDetails(true);

    try {
      if (useLiveFlow) {
        if (editingUpiMethod) {
          const updatedMethod = await updateCustomerPaymentMethod(editingUpiMethod.id, {
            type: "UPI",
            upiId: values.upiId,
            label: values.appLabel || undefined,
            isPrimary: values.isPrimary,
          });
          setSelectedUpiMethodId(updatedMethod.id);
        } else {
          const createdMethod = await createCustomerPaymentMethod({
            type: "UPI",
            upiId: values.upiId,
            label: values.appLabel || undefined,
            isPrimary: values.isPrimary,
          });
          setSelectedUpiMethodId(createdMethod.id);
        }

        await loadSavedPaymentMethods();
      } else {
        const nextValue: StoredPaymentPreferences = {
          ...savedPaymentPreferences,
          upi: {
            upiId: values.upiId,
            appLabel: values.appLabel || undefined,
            isPrimary: values.isPrimary,
          },
        };
        persistPaymentPreferences(nextValue);
      }

      toast.success("UPI ID saved.");
      setEditingUpiMethod(null);
      setIsUpiModalOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save the UPI ID right now."));
    } finally {
      setIsSavingPaymentDetails(false);
    }
  };

  const handleApplyCoupon = async (nextCode?: string) => {
    if (!useLiveFlow || !selectedCart) {
      return;
    }

    const code = normalizeCouponCode(nextCode ?? couponCode);
    if (!code) {
      setCouponMessage("Enter a coupon code before applying it.");
      setCouponMessageTone("error");
      toast.error("Enter a coupon code before applying it.");
      return;
    }

    setIsApplyingCoupon(true);
    setCouponMessage(null);

    try {
      const updatedCart = await applyCustomerCartOffer(selectedCart.id, code);
      updateCartRow(updatedCart);
      setCouponCode(normalizeCouponCode(updatedCart.offer?.code) || code);
      setCouponMessage(`Coupon ${normalizeCouponCode(updatedCart.offer?.code) || code} applied successfully.`);
      setCouponMessageTone("success");
      writePendingCustomerCouponSelection(user?.id, {
        code,
        cartId: updatedCart.id,
      });
      toast.success(`Applied ${code} to your ${updatedCart.restaurant.name} order.`);
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to apply this coupon right now.");
      setCouponMessage(message);
      setCouponMessageTone("error");
      toast.error(message);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = async () => {
    if (!useLiveFlow || !selectedCart?.offer) {
      return;
    }

    setIsApplyingCoupon(true);
    setCouponMessage(null);

    try {
      const removedCode = normalizeCouponCode(selectedCart.offer.code) || "the coupon";
      const updatedCart = await removeCustomerCartOffer(selectedCart.id);
      updateCartRow(updatedCart);
      setCouponCode("");
      clearPendingCustomerCouponSelection(user?.id);
      setPendingCouponCode("");
      setPendingCouponCartId(null);
      setCouponMessage(`Removed ${removedCode} from this payment.`);
      setCouponMessageTone("info");
      toast.success(`Removed ${removedCode} from your ${updatedCart.restaurant.name} order.`);
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to remove this coupon right now.");
      setCouponMessage(message);
      setCouponMessageTone("error");
      toast.error(message);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const selectedPaymentPanel =
    activeMethod === "CARD" ? (
      <div className="rounded-[1.75rem] bg-cream px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-ink">
              {savedCardDetails?.label ?? "No saved card summary"}
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              {savedCardDetails
                ? `${savedCardDetails.holderName} • ending ${savedCardDetails.last4}`
                : "Add a masked card summary for quicker checkout. Full card numbers are never stored here."}
            </p>
            {savedCardDetails ? (
              <p className="mt-2 text-xs text-ink-muted">
                Expires {savedCardDetails.expiryMonth}/{savedCardDetails.expiryYear}
                {savedCardDetails.isPrimary ? " • Primary card" : ""}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            className="px-4 py-2 text-xs"
            onClick={() => setIsCardModalOpen(true)}
          >
            {savedCardDetails ? "Update card" : "Add card"}
          </Button>
        </div>
      </div>
    ) : activeMethod === "UPI" ? (
      <div className="rounded-[1.75rem] bg-cream px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-ink">
              {savedUpiDetails?.appLabel
                ? `${savedUpiDetails.appLabel} - ${savedUpiDetails.upiId}`
                : savedUpiDetails?.upiId ?? "No saved UPI ID"}
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              {savedUpiDetails
                ? "Your saved UPI ID is ready for quick checkout."
                : "Add a UPI ID like aditi@okicici or myname@oksbi for faster payment."}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="px-4 py-2 text-xs"
            onClick={() => setIsUpiModalOpen(true)}
          >
            {savedUpiDetails ? "Update UPI ID" : "Add UPI ID"}
          </Button>
        </div>
      </div>
    ) : activeMethod === "WALLET" ? (
      <div className="rounded-[1.75rem] bg-cream px-5 py-5">
        <p className="font-semibold text-ink">{paymentModeContent.WALLET.title}</p>
        <p className="mt-2 text-sm text-ink-soft">{walletSubtitle}</p>
        <p className="mt-2 text-xs text-ink-muted">
          Wallet recharge and balance management stay view-only here unless a dedicated wallet flow is connected.
        </p>
      </div>
    ) : (
      <div className="rounded-[1.75rem] bg-cream px-5 py-5">
        <p className="font-semibold text-ink">{paymentModeContent.COD.title}</p>
        <p className="mt-2 text-sm text-ink-soft">{paymentModeContent.COD.subtitle}</p>
        <p className="mt-2 text-xs text-ink-muted">
          Keep exact change handy if possible for a smoother handoff at delivery.
        </p>
      </div>
    );

  const paymentPanel =
    activeMethod === "CARD" ? (
      <div className="space-y-4 rounded-[1.75rem] bg-cream px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-ink">Saved cards</p>
            <p className="mt-2 text-sm text-ink-soft">
              Select a saved card, switch the default, or add a new masked summary without leaving checkout.
            </p>
          </div>
          <Button type="button" variant="secondary" className="px-4 py-2 text-xs" onClick={handleCreateCard}>
            Add new card
          </Button>
        </div>

        {savedCardMethods.length ? (
          <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
            {savedCardMethods.map((paymentMethod) => {
              const isSelected = selectedCardMethod?.id === paymentMethod.id;

              return (
                <div
                  key={paymentMethod.id}
                  className={cn(
                    "rounded-[1.5rem] border bg-white shadow-soft transition",
                    isSelected ? "border-accent/40 bg-accent/[0.04]" : "border-accent/10",
                  )}
                >
                  <button
                    type="button"
                    className="w-full px-4 py-4 text-left"
                    onClick={() => setSelectedCardMethodId(paymentMethod.id)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                          <CreditCard className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-ink">{getSavedPaymentMethodTitle(paymentMethod)}</p>
                            {isSelected ? <StatusPill label="Selected" tone="success" /> : null}
                            {paymentMethod.isPrimary ? <StatusPill label="Default" tone="info" /> : null}
                          </div>
                          <p className="mt-1 text-sm text-ink-soft">{getSavedPaymentMethodSubtitle(paymentMethod)}</p>
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="flex flex-wrap gap-2 px-4 pb-4">
                    {!paymentMethod.isPrimary ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-3 py-2 text-xs"
                        onClick={() => void handleSetDefaultPaymentMethod(paymentMethod)}
                        disabled={isSavingPaymentDetails}
                      >
                        Set default
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-3 py-2 text-xs"
                      onClick={() => handleEditCard(paymentMethod)}
                      disabled={isSavingPaymentDetails}
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
              );
            })}
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-accent/10 bg-white px-5 py-4 text-sm text-ink-soft">
            Add a masked card summary once and reuse it during checkout. Full card numbers and CVV are never stored.
          </div>
        )}

        <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-accent">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">
                {selectedCardMethod ? `Paying with ${getSavedPaymentMethodTitle(selectedCardMethod)}` : "Card security check"}
              </p>
              <p className="mt-1 text-sm text-ink-soft">Enter CVV only for this payment. It is never saved.</p>
              {selectedCardMethod ? (
                <div className="mt-4 max-w-[180px]">
                  <Input
                    label="CVV"
                    placeholder="123"
                    inputMode="numeric"
                    maxLength={4}
                    value={cardSecurityCode}
                    onChange={(event) => setCardSecurityCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    ) : activeMethod === "UPI" ? (
      <div className="space-y-4 rounded-[1.75rem] bg-cream px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-ink">Saved UPI IDs</p>
            <p className="mt-2 text-sm text-ink-soft">
              Pick a saved UPI ID, switch the default, or add a new one without interrupting checkout.
            </p>
          </div>
          <Button type="button" variant="secondary" className="px-4 py-2 text-xs" onClick={handleCreateUpi}>
            Add new UPI
          </Button>
        </div>

        {savedUpiMethods.length ? (
          <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
            {savedUpiMethods.map((paymentMethod) => {
              const isSelected = selectedUpiMethod?.id === paymentMethod.id;

              return (
                <div
                  key={paymentMethod.id}
                  className={cn(
                    "rounded-[1.5rem] border bg-white shadow-soft transition",
                    isSelected ? "border-accent/40 bg-accent/[0.04]" : "border-accent/10",
                  )}
                >
                  <button
                    type="button"
                    className="w-full px-4 py-4 text-left"
                    onClick={() => setSelectedUpiMethodId(paymentMethod.id)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-ink">{getSavedPaymentMethodTitle(paymentMethod)}</p>
                            {isSelected ? <StatusPill label="Selected" tone="success" /> : null}
                            {paymentMethod.isPrimary ? <StatusPill label="Default" tone="info" /> : null}
                          </div>
                          <p className="mt-1 text-sm text-ink-soft">{getSavedPaymentMethodSubtitle(paymentMethod)}</p>
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="flex flex-wrap gap-2 px-4 pb-4">
                    {!paymentMethod.isPrimary ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-3 py-2 text-xs"
                        onClick={() => void handleSetDefaultPaymentMethod(paymentMethod)}
                        disabled={isSavingPaymentDetails}
                      >
                        Set default
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-3 py-2 text-xs"
                      onClick={() => handleEditUpi(paymentMethod)}
                      disabled={isSavingPaymentDetails}
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
              );
            })}
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-accent/10 bg-white px-5 py-4 text-sm text-ink-soft">
            Add a UPI ID like `name@bank` once and reuse it during checkout.
          </div>
        )}

        <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4">
          <p className="font-semibold text-ink">
            {selectedUpiMethod ? `Paying with ${getSavedPaymentMethodTitle(selectedUpiMethod)}` : "UPI checkout ready"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {selectedUpiMethod
              ? "Your selected UPI ID will be sent with this order."
              : "Add a valid UPI ID like `name@bank` for faster payment."}
          </p>
        </div>
      </div>
    ) : (
      selectedPaymentPanel
    );

  const couponSection = useLiveFlow && selectedCart ? (
    <div className="space-y-4 rounded-[1.75rem] border border-accent/10 bg-white px-5 py-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Coupons</p>
          <p className="mt-2 font-semibold text-ink">Use a code with {toLabel(activeMethod)}</p>
          <p className="mt-2 text-sm leading-7 text-ink-soft">
            Apply a live coupon or pick from eligible offers for this cart. The current coupon engine validates
            active status, expiry, restaurant scope, and minimum order before it updates your payable total.
          </p>
        </div>
        {selectedCart.offer ? (
          <StatusPill
            label={selectedCart.offer.code ? `${selectedCart.offer.code} applied` : "Coupon applied"}
            tone="success"
          />
        ) : null}
      </div>

      <form
        className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void handleApplyCoupon();
        }}
      >
        <Input
          label="Coupon code"
          placeholder="Enter or paste a coupon code"
          value={couponCode}
          onChange={(event) => {
            setCouponCode(normalizeCouponCode(event.target.value));
            if (couponMessage) {
              setCouponMessage(null);
            }
          }}
        />
        <Button type="submit" disabled={isApplyingCoupon}>
          {isApplyingCoupon ? "Applying..." : "Apply coupon"}
        </Button>
        {selectedCart.offer ? (
          <Button type="button" variant="secondary" onClick={() => void handleRemoveCoupon()} disabled={isApplyingCoupon}>
            Remove
          </Button>
        ) : null}
      </form>

      {couponMessage ? (
        <div
          className={`rounded-[1.5rem] border border-accent/10 px-4 py-4 text-sm shadow-soft ${
            couponMessageTone === "error" ? "bg-white text-accent-soft" : "bg-accent/[0.03] text-ink-soft"
          }`}
        >
          {couponMessage}
        </div>
      ) : null}

      {selectedCart.offer ? (
        <div className="rounded-[1.5rem] bg-cream px-5 py-5 text-sm text-ink-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">{selectedCart.offer.code ?? selectedCart.offer.title}</p>
              <p className="mt-2">{selectedCart.offer.title}</p>
            </div>
            <p className="text-sm font-semibold text-ink">
              -{formatCurrency(selectedCart.summary.discountAmount)}
            </p>
          </div>
          <p className="mt-3">{formatCouponSavingsSummary(selectedCart.offer)}</p>
        </div>
      ) : matchedCoupon ? (
        <div className="rounded-[1.5rem] bg-cream px-5 py-5 text-sm text-ink-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">{matchedCoupon.code ?? matchedCoupon.title}</p>
              <p className="mt-2">{matchedCoupon.title}</p>
            </div>
            <StatusPill label={getCouponScopeSummary(matchedCoupon, selectedCart)} tone="info" />
          </div>
          <p className="mt-3">{formatCouponSavingsSummary(matchedCoupon)}</p>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Eligible offers</p>
          <p className="text-xs text-ink-muted">
            {isLoadingOffers
              ? "Loading offers..."
              : eligibleCoupons.length
                ? `${eligibleCoupons.length} coupon${eligibleCoupons.length > 1 ? "s" : ""} available`
                : "No live coupons currently match this cart"}
          </p>
        </div>
        {eligibleCoupons.length ? (
          <div className="flex flex-wrap gap-3">
            {eligibleCoupons.map((offer) => (
              <Chip
                key={offer.id}
                active={normalizeCouponCode(couponCode) === normalizeCouponCode(offer.code)}
                onClick={() => {
                  setCouponCode(normalizeCouponCode(offer.code));
                  setCouponMessage(`${normalizeCouponCode(offer.code)} is ready to apply on this payment.`);
                  setCouponMessageTone("info");
                }}
              >
                {offer.code ?? offer.title}
              </Chip>
            ))}
          </div>
        ) : isLoadingOffers ? (
          <p className="text-sm text-ink-soft">Checking your live offers for this cart.</p>
        ) : (
          <p className="text-sm text-ink-soft">
            No coupon currently matches this cart&apos;s subtotal or restaurant scope. You can still paste a code to
            try it.
          </p>
        )}
        <p className="text-xs leading-6 text-ink-muted">
          Payment-mode, category, and membership restrictions are not stored in the current offer model, so live
          validation here follows the same cart rules already enforced by the backend.
        </p>
      </div>
    </div>
  ) : null;

  const handlePlaceOrder = async () => {
    const validationMessage = getPaymentValidationMessage();

    if (validationMessage) {
      setPaymentError(validationMessage);
      toast.error(validationMessage);
      return;
    }

    if (!useLiveFlow) {
      navigate("/order-success");
      return;
    }

    if (!selectedCart || !addressId) {
      toast.error("Choose a cart and delivery address before placing the order.");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedSavedPaymentMethodId =
        activeMethod === "CARD" ? selectedCardMethod?.id : activeMethod === "UPI" ? selectedUpiMethod?.id : undefined;
      const order = await placeCustomerOrder({
        cartId: selectedCart.id,
        addressId,
        paymentMethod: activeMethod,
        paymentMethodId: selectedSavedPaymentMethodId,
        savedPaymentMethodId: selectedSavedPaymentMethodId,
        tipAmount,
        specialInstructions,
      });
      toast.success("Order placed successfully.");
      navigate(`/order-success?orderId=${order.id}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to place your order."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!useLiveFlow) {
    return (
      <PageShell
        eyebrow="Payment"
        title="Choose the payment rhythm that feels effortless."
        description="A polished payment surface with cards, wallet, and UPI options that still sits naturally in the current design system."
        actions={
          <Button type="button" onClick={() => void handlePlaceOrder()} disabled={isSubmitting}>
            {isSubmitting ? "Processing..." : "Complete payment"}
          </Button>
        }
      >
        <SurfaceCard className="space-y-6">
          <Tabs
            items={[
              { value: "card", label: "Cards" },
              { value: "upi", label: "UPI" },
              { value: "wallet", label: "Wallet" },
              { value: "cod", label: "Cash" },
            ]}
            value={activeMethod.toLowerCase()}
            onChange={(value) => setActiveMethod(value.toUpperCase() as CheckoutPaymentTab)}
          />
          <div className="grid gap-4 lg:grid-cols-3">{selectedPaymentPanel}</div>
          {paymentError ? (
            <div className="rounded-[1.75rem] border border-accent/10 bg-white px-5 py-4 text-sm text-accent-soft shadow-soft">
              {paymentError}
            </div>
          ) : null}
          <div className="rounded-[1.75rem] border border-accent/10 bg-accent/[0.03] px-5 py-4 text-sm text-ink-soft">
            Selected method: <span className="font-semibold text-ink">{selectedPaymentSummary}</span>
          </div>
        </SurfaceCard>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Payment"
      title="Choose the payment rhythm that feels effortless."
      description="Live payment placement keeps the existing polished surface while sending your combo or dish order through the backend."
    >
      {isLoading ? (
        <SurfaceCard>
          <p className="text-sm text-ink-soft">Loading payment summary…</p>
        </SurfaceCard>
      ) : selectedCart ? (
        <SurfaceCard className="space-y-6">
          <Tabs
            items={[
              { value: "CARD", label: "Cards" },
              { value: "UPI", label: "UPI" },
              { value: "WALLET", label: "Wallet" },
              { value: "COD", label: "Cash" },
            ]}
            value={activeMethod}
            onChange={(value) => setActiveMethod(value as CheckoutPaymentTab)}
          />
          <div className="grid gap-4 lg:grid-cols-3">{paymentPanel}</div>
          {paymentError ? (
            <div className="rounded-[1.75rem] border border-accent/10 bg-white px-5 py-4 text-sm text-accent-soft shadow-soft">
              {paymentError}
            </div>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              <div className="rounded-[1.75rem] border border-accent/10 bg-accent/[0.03] px-5 py-4 text-sm text-ink-soft">
                Selected method: <span className="font-semibold text-ink">{selectedPaymentSummary}</span>
              </div>
              {couponSection}
            </div>
            <div className="space-y-3 rounded-[1.75rem] bg-cream px-5 py-5 text-sm text-ink-soft">
              <div className="flex items-start justify-between gap-4">
                <span>Payment</span>
                <span className="max-w-[190px] text-right font-semibold text-ink">{selectedPaymentSummary}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(selectedCart.summary.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Delivery fee</span>
                <span>{formatCurrency(selectedCart.summary.deliveryFee)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Taxes</span>
                <span>{formatCurrency(selectedCart.summary.taxAmount)}</span>
              </div>
              {selectedCart.summary.discountAmount > 0 ? (
                <div className="flex items-center justify-between text-accent">
                  <span>
                    Offer savings
                    {selectedCart.offer?.code ? ` (${selectedCart.offer.code})` : ""}
                  </span>
                  <span>-{formatCurrency(selectedCart.summary.discountAmount)}</span>
                </div>
              ) : null}
              {tipAmount ? (
                <div className="flex items-center justify-between">
                  <span>Tip</span>
                  <span>{formatCurrency(tipAmount)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between font-semibold text-ink">
                <span>Total payable</span>
                <span>{formatCurrency(payableWithTip)}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={() => void handlePlaceOrder()} disabled={isSubmitting}>
              {isSubmitting ? "Placing order..." : "Complete payment"}
            </Button>
          </div>
        </SurfaceCard>
      ) : (
        <div className="space-y-4">
          <EmptyState
            title="No cart selected"
            description="Return to checkout to confirm a cart and address before paying."
          />
          <div className="flex justify-center">
            <Link to="/cart" className={linkButtonClassName}>
              Open cart
            </Link>
          </div>
        </div>
      )}
      <CardDetailsModal
        open={isCardModalOpen}
        details={editingCardDetails}
        defaultHolderName={user?.fullName}
        isSubmitting={isSavingPaymentDetails}
        onClose={() => {
          setEditingCardMethod(null);
          setIsCardModalOpen(false);
        }}
        onSubmit={handleSaveCardDetails}
      />
      <UpiDetailsModal
        open={isUpiModalOpen}
        details={editingUpiDetails}
        isSubmitting={isSavingPaymentDetails}
        onClose={() => {
          setEditingUpiMethod(null);
          setIsUpiModalOpen(false);
        }}
        onSubmit={handleSaveUpiDetails}
      />
      <ConfirmDangerModal
        open={Boolean(deleteTargetPaymentMethod)}
        title={deleteTargetPaymentMethod?.type === "CARD" ? "Delete saved card" : "Delete saved UPI ID"}
        description={
          deleteTargetPaymentMethod?.type === "CARD"
            ? "This masked card summary will be removed from your saved payment methods."
            : "This saved UPI ID will be removed from your payment methods."
        }
        confirmLabel="Delete"
        isSubmitting={isDeletingPaymentMethod}
        onClose={() => setDeleteTargetPaymentMethod(null)}
        onConfirm={() => void handleDeleteSelectedPaymentMethod()}
      />
    </PageShell>
  );
};

export const OrderSuccessPage = () => {
  const [params] = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const useLiveFlow = isLiveCustomerSession(isAuthenticated, user?.role);
  const liveOrderId = Number(params.get("orderId") ?? "0");
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [isLoading, setIsLoading] = useState(useLiveFlow);
  const [loadError, setLoadError] = useState<string | null>(null);
  const demoOrder = orders[0];

  useEffect(() => {
    if (!useLiveFlow) {
      return;
    }

    if (!liveOrderId) {
      setOrder(null);
      setLoadError("The latest order confirmation could not be identified.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    void getCustomerOrderById(liveOrderId)
      .then((currentOrder) => setOrder(currentOrder))
      .catch((error) => {
        setOrder(null);
        setLoadError(getApiErrorMessage(error, "Unable to load this order confirmation."));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [liveOrderId, useLiveFlow, user?.id]);

  if (useLiveFlow && isLoading) {
    return (
      <PageShell
        eyebrow="Order confirmed"
        title="Dinner is in motion."
        description="We are loading the latest confirmation for your live order."
      >
        <SurfaceCard>
          <p className="text-sm text-ink-soft">Loading your order details...</p>
        </SurfaceCard>
      </PageShell>
    );
  }

  if (useLiveFlow && !order) {
    return (
      <PageShell
        eyebrow="Order confirmed"
        title="Dinner is in motion."
        description="Your live order confirmation could not be loaded just yet."
      >
        <div className="space-y-4">
          <EmptyState
            title="We couldn't load this order confirmation"
            description={loadError ?? "Open your order history to check the latest status for your account."}
          />
          <div className="flex justify-center">
            <Link
              to="/orders"
              className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
            >
              View order history
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  if (useLiveFlow && order) {
    return (
      <PageShell
        eyebrow="Order confirmed"
        title="Dinner is in motion."
        description="Your live order has been placed successfully and the kitchen has everything it needs."
        actions={
          <>
            {isActiveTrackedOrder(order.status) ? (
              <Link to={`/track-order/${order.id}`} className={linkButtonClassName}>
                Track live order
              </Link>
            ) : (
              <Link to={`/orders/${order.id}`} className={linkButtonClassName}>
                View order details
              </Link>
            )}
            <Link
              to="/orders"
              className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
            >
              View order history
            </Link>
          </>
        }
      >
        <SurfaceCard className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            <Sparkles className="h-8 w-8 text-accent" />
            <h2 className="font-display text-4xl font-semibold text-ink">Order {order.orderNumber}</h2>
            <p className="text-sm leading-7 text-ink-soft">
              {order.restaurant.name} has received your order and will update the live timeline as it moves.
            </p>
          </div>
          <div className="rounded-[1.75rem] bg-cream px-5 py-5">
            <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Current status</p>
            <p className="mt-2 font-display text-4xl font-semibold text-ink">{toLabel(order.status)}</p>
          </div>
          <div className="rounded-[1.75rem] bg-cream px-5 py-5">
            <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Delivery address</p>
            <p className="mt-2 text-sm text-ink-soft">
              {[order.address.houseNo, order.address.street, order.address.area, order.address.city]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        </SurfaceCard>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Order confirmed"
      title="Dinner is in motion."
      description="Your order has been placed successfully and the kitchen has everything it needs."
      actions={
        <>
          <Link to={`/track-order/${demoOrder.id}`} className={linkButtonClassName}>
            Track live order
          </Link>
          <Link
            to="/orders"
            className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
          >
            View order history
          </Link>
        </>
      }
    >
      <SurfaceCard className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          <Sparkles className="h-8 w-8 text-accent" />
          <h2 className="font-display text-4xl font-semibold text-ink">Order {demoOrder.orderNumber}</h2>
          <p className="text-sm leading-7 text-ink-soft">Saffron Story has accepted your order and the kitchen is preparing it.</p>
        </div>
        <div className="rounded-[1.75rem] bg-cream px-5 py-5">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Estimated arrival</p>
          <p className="mt-2 font-display text-4xl font-semibold text-ink">{demoOrder.eta}</p>
        </div>
        <div className="rounded-[1.75rem] bg-cream px-5 py-5">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Delivery address</p>
          <p className="mt-2 text-sm text-ink-soft">{demoOrder.deliveryAddress}</p>
        </div>
      </SurfaceCard>
    </PageShell>
  );
};

export const OrderTrackingPage = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { isAuthenticated, user } = useAuth();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const useLiveFlow = isLiveCustomerSession(isAuthenticated, user?.role);
  const [isLoading, setIsLoading] = useState(useLiveFlow);
  const [loadError, setLoadError] = useState<string | null>(null);
  const parsedOrderId = Number(orderId ?? "0");
  const demoOrder = getOrderById(orderId) ?? orders[0];
  const shouldSubscribeToOrder = useLiveFlow && Boolean(parsedOrderId) && (order ? isActiveTrackedOrder(order.status) : true);

  const handleCloseTracking = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }

    navigate("/orders");
  };

  const loadOrder = async ({ quietly = false }: { quietly?: boolean } = {}) => {
    if (!useLiveFlow) {
      return;
    }

    if (!parsedOrderId) {
      setOrder(null);
      setLoadError("The requested order could not be identified.");
      setIsLoading(false);
      return;
    }

    if (!quietly) {
      setIsLoading(true);
    }

    setLoadError(null);

    try {
      setOrder(await getCustomerOrderById(parsedOrderId));
    } catch (error) {
      setOrder(null);
      setLoadError(getApiErrorMessage(error, "Unable to load this order."));
    } finally {
      if (!quietly) {
        setIsLoading(false);
      }
    }
  };

  const handleReviewSubmit = async (payload: { rating: number; reviewText?: string }) => {
    if (!order) {
      return;
    }

    setIsSubmittingReview(true);
    try {
      const review = order.review
        ? await updateCustomerReview(order.review.id, payload)
        : await createCustomerReview({
            restaurantId: order.restaurant.id,
            orderId: order.id,
            rating: payload.rating,
            reviewText: payload.reviewText,
          });
      setOrder((currentOrder) => (currentOrder ? syncCustomerOrderReview(currentOrder, review) : currentOrder));
      setIsReviewModalOpen(false);
      toast.success(order.review ? "Review updated successfully." : "Review submitted successfully.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save your review right now."));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  useEffect(() => {
    if (!useLiveFlow) {
      return;
    }

    void loadOrder();
  }, [parsedOrderId, useLiveFlow, user?.id]);

  useRealtimeSubscription({
    enabled: shouldSubscribeToOrder,
    userId: user?.id,
    orderIds: [parsedOrderId],
    onOrderStatusUpdate: (payload) => {
      if (payload.orderId === parsedOrderId) {
        setOrder((currentOrder) => (currentOrder ? syncCustomerOrderStatus(currentOrder, payload.status) : currentOrder));
        void loadOrder({ quietly: true });
      }
    },
    onDeliveryLocationUpdate: (payload) => {
      if (payload.orderId !== parsedOrderId) {
        return;
      }

      setOrder((currentOrder) =>
        currentOrder && isActiveTrackedOrder(currentOrder.status)
          ? mergeCustomerOrderLocation(currentOrder, payload)
          : currentOrder,
      );
    },
  });

  if (useLiveFlow && isLoading) {
    return (
      <PageShell
        eyebrow="Live order tracking"
        title="Track your order in real time."
        description="We are loading the latest delivery status, route, and timeline for this order."
        actions={
          <Button type="button" variant="secondary" onClick={handleCloseTracking}>
            Close
          </Button>
        }
      >
        <SurfaceCard>
          <p className="text-sm text-ink-soft">Loading your live order...</p>
        </SurfaceCard>
      </PageShell>
    );
  }

  if (useLiveFlow && !order) {
    return (
      <PageShell
        eyebrow="Live order tracking"
        title="Track your order in real time."
        description="This live order could not be loaded for your account."
        actions={
          <Button type="button" variant="secondary" onClick={handleCloseTracking}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          <EmptyState
            title="We couldn't load this order"
            description={loadError ?? "The order may no longer exist or may not belong to your account."}
          />
          <div className="flex justify-center">
            <Link to="/orders" className={linkButtonClassName}>
              Back to order history
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  if (useLiveFlow && order) {
    if (!isActiveTrackedOrder(order.status)) {
      const latestStatusEvent = order.statusEvents[order.statusEvents.length - 1];

      return (
        <>
          <PageShell
            eyebrow={isDeliveredOrder(order.status) ? "Delivery complete" : "Order completed"}
            title={isDeliveredOrder(order.status) ? "Your order has arrived." : `${toLabel(order.status)}.`}
            description={
              isDeliveredOrder(order.status)
                ? "Live tracking has ended cleanly and this order now lives in your completed history."
                : "Live tracking has ended for this order and the final timeline is saved in your history."
            }
            actions={
              <>
                <Button type="button" variant="secondary" onClick={handleCloseTracking}>
                  Close
                </Button>
                {canReviewOrder(order) ? (
                  <Button type="button" onClick={() => setIsReviewModalOpen(true)}>
                    {order.review ? "Edit review" : "Rate order"}
                  </Button>
                ) : null}
                <Link to={`/orders/${order.id}`} className={linkButtonClassName}>Open order details</Link>
              </>
            }
          >
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <SurfaceCard className="space-y-4">
                <SectionHeading title="Delivery summary" description={order.orderNumber} />
                <div className="rounded-[1.75rem] bg-cream px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{order.restaurant.name}</p>
                      <p className="mt-2 text-sm text-ink-soft">
                        {isDeliveredOrder(order.status)
                          ? `Delivered ${formatOrderDateTime(order.deliveredAt ?? latestStatusEvent?.createdAt ?? order.orderedAt)}`
                          : `Final update: ${formatOrderDateTime(latestStatusEvent?.createdAt ?? order.orderedAt)}`}
                      </p>
                    </div>
                    <StatusPill label={toLabel(order.status)} tone={getOrderStatusTone(order.status)} />
                  </div>
                  {order.review ? (
                    <p className="mt-3 text-sm text-ink-soft">
                      Your review: {order.review.rating}/5
                      {order.review.reviewText ? ` - ${order.review.reviewText}` : ""}
                    </p>
                  ) : canReviewOrder(order) ? (
                    <p className="mt-3 text-sm text-ink-soft">
                      Your food has been delivered. You can rate this order whenever you are ready.
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Total</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{formatCurrency(order.totalAmount)}</p>
                  </div>
                  <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Tip</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{formatCurrency(order.tipAmount)}</p>
                  </div>
                  <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Distance</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{formatDistanceKm(order.routeDistanceKm)}</p>
                  </div>
                </div>
              </SurfaceCard>
              <SurfaceCard className="space-y-5">
                <SectionHeading title="Order timeline" description={order.orderNumber} />
                {order.statusEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-4">
                    <div className="mt-1 h-3 w-3 rounded-full bg-accent" />
                    <div>
                      <p className="font-semibold text-ink">{toLabel(event.status)}</p>
                      <p className="mt-1 text-sm text-ink-soft">{formatOrderDateTime(event.createdAt)}</p>
                      {event.note ? <p className="mt-1 text-sm text-ink-soft">{event.note}</p> : null}
                    </div>
                  </div>
                ))}
              </SurfaceCard>
            </div>
          </PageShell>
          {canReviewOrder(order) ? (
            <OrderReviewModal
              open={isReviewModalOpen}
              order={order}
              isSubmitting={isSubmittingReview}
              onClose={() => setIsReviewModalOpen(false)}
              onSubmit={handleReviewSubmit}
            />
          ) : null}
        </>
      );
    }

    return (
      <PageShell
        eyebrow="Live order tracking"
        title={`Track ${order.restaurant.name} in real time.`}
        description="Live status, ETA, route distance, and partner assignment stay synced with your order timeline."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={handleCloseTracking}>
              Close
            </Button>
            <Link to={`/orders/${order.id}`} className={linkButtonClassName}>Open order details</Link>
          </>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <SurfaceCard className="space-y-4">
            <SectionHeading title="Delivery partner" description="Your handoff contact for tonight." />
            <div className="rounded-[1.75rem] bg-cream px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{order.deliveryPartner?.user.fullName ?? "Assignment pending"}</p>
                  <p className="mt-2 text-sm text-ink-soft">{formatIndianPhoneDisplay(order.deliveryPartner?.user.phone) || "Phone will appear once assigned."}</p>
                </div>
                <StatusPill label={toLabel(order.status)} tone={getOrderStatusTone(order.status)} />
              </div>
              <p className="mt-3 text-sm text-ink-soft">
                {order.status === "LOOKING_FOR_DELIVERY_PARTNER"
                  ? "We are matching the fastest available rider for this order."
                  : order.status === "DELAYED"
                    ? `A short delay has been applied. Current delay buffer: ${order.delayMinutes} min.`
                    : order.deliveryPartner
                      ? "Your rider location appears on the map below as soon as live coordinates are available."
                      : "Restaurant and drop-off locations are already locked for dispatch."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">ETA</p>
                <p className="mt-2 text-sm font-semibold text-ink">{formatEtaMinutes(order.estimatedDeliveryMinutes)}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Distance</p>
                <p className="mt-2 text-sm font-semibold text-ink">{formatDistanceKm(order.routeDistanceKm)}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Tip</p>
                <p className="mt-2 text-sm font-semibold text-ink">{formatCurrency(order.tipAmount)}</p>
              </div>
            </div>
            <RouteMap
              markers={buildOrderRouteMarkers(order)}
              emptyMessage="Live map will appear as soon as restaurant, drop-off, or rider coordinates are available."
            />
          </SurfaceCard>
          <SurfaceCard className="space-y-5">
            <SectionHeading title="Order timeline" description={order.orderNumber} />
            {order.specialInstructions ? (
              <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4 text-sm leading-7 text-ink-soft">
                {order.specialInstructions}
              </div>
            ) : null}
            {order.statusEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-4">
                <div className="mt-1 h-3 w-3 rounded-full bg-accent" />
                <div>
                  <p className="font-semibold text-ink">{toLabel(event.status)}</p>
                  <p className="mt-1 text-sm text-ink-soft">{formatOrderDateTime(event.createdAt)}</p>
                  {event.note ? <p className="mt-1 text-sm text-ink-soft">{event.note}</p> : null}
                </div>
              </div>
            ))}
          </SurfaceCard>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Live order tracking"
      title={`Track ${demoOrder.restaurantName} in real time.`}
      description="This screen uses the existing route structure and demo timeline data until live socket events are hooked in page-by-page."
      actions={
        <>
          <Button type="button" variant="secondary" onClick={handleCloseTracking}>
            Close
          </Button>
          <Link to={`/orders/${demoOrder.id}`} className={linkButtonClassName}>Open order details</Link>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <SurfaceCard className="space-y-4">
          <SectionHeading title="Delivery partner" description="Your handoff contact for tonight." />
          <div className="rounded-[1.75rem] bg-cream px-5 py-5">
            <p className="font-semibold text-ink">{demoOrder.rider.name}</p>
            <p className="mt-2 text-sm text-ink-soft">{demoOrder.rider.phone}</p>
            <p className="text-sm text-ink-soft">{demoOrder.rider.vehicle}</p>
          </div>
          <div className="rounded-[1.75rem] border border-dashed border-accent/20 bg-white/60 px-5 py-16 text-center text-sm text-ink-soft">
            Live map area ready for Socket.IO location updates.
          </div>
        </SurfaceCard>
        <SurfaceCard className="space-y-5">
          <SectionHeading title="Order timeline" description={demoOrder.orderNumber} />
          {demoOrder.timeline.map((step) => (
            <div key={step.label} className="flex items-start gap-4">
              <div className={`mt-1 h-3 w-3 rounded-full ${step.done ? "bg-accent" : "bg-accent/20"}`} />
              <div>
                <p className="font-semibold text-ink">{step.label}</p>
                <p className="mt-1 text-sm text-ink-soft">{step.time}</p>
              </div>
            </div>
          ))}
        </SurfaceCard>
      </div>
    </PageShell>
  );
};

export const OrdersHistoryPage = () => {
  const { isAuthenticated, user } = useAuth();
  const useLiveFlow = isLiveCustomerSession(isAuthenticated, user?.role);
  const [ordersList, setOrdersList] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(useLiveFlow);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadOrders = async ({ quietly = false }: { quietly?: boolean } = {}) => {
    if (!useLiveFlow) {
      return;
    }

    if (!quietly) {
      setIsLoading(true);
    }

    setLoadError(null);

    try {
      setOrdersList(await getCustomerOrders());
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load your orders.");
      setOrdersList([]);
      setLoadError(message);

      if (!quietly) {
        toast.error(message);
      }
    } finally {
      if (!quietly) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!useLiveFlow) {
      return;
    }

    void loadOrders();
  }, [useLiveFlow, user?.id]);

  useRealtimeSubscription({
    enabled: useLiveFlow,
    userId: user?.id,
    onNotification: (notification) => {
      if (notification.type === "ORDER") {
        void loadOrders({ quietly: true });
      }
    },
    onOrderStatusUpdate: () => {
      void loadOrders({ quietly: true });
    },
  });

  if (useLiveFlow) {
    return (
      <PageShell
        eyebrow="Order history"
        title="Every recent order, neatly organized."
        description="Live order history now keeps combo bundles and add-on selections in the same premium archive view."
      >
        {isLoading ? (
          <SurfaceCard>
            <p className="text-sm text-ink-soft">Loading your orders…</p>
          </SurfaceCard>
        ) : loadError ? (
          <EmptyState
            title="We couldn't load your orders"
            description={loadError}
          />
        ) : ordersList.length ? (
          <div className="grid gap-5">
            {ordersList.map((order) => (
              <SurfaceCard key={order.id} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">{order.orderNumber}</p>
                  <h2 className="font-display text-4xl font-semibold text-ink">{order.restaurant.name}</h2>
                  <p className="text-sm text-ink-soft">{formatOrderDateTime(order.orderedAt)}</p>
                  <p className="text-sm text-ink-soft">{formatOrderItemsSummary(order.items)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPill label={toLabel(order.status)} tone={getOrderStatusTone(order.status)} />
                  <p className="text-sm font-semibold text-ink">{formatCurrency(order.totalAmount)}</p>
                  <Link to={`/orders/${order.id}`} className="inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft">
                    View details
                  </Link>
                </div>
              </SurfaceCard>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No live orders yet"
            description="Your completed dish and combo orders will appear here once you place them."
          />
        )}
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Order history"
      title="Every recent order, neatly organized."
      description="A customer-friendly order archive with quick access to tracking and detail views."
    >
      <div className="grid gap-5">
        {orders.map((order) => (
          <SurfaceCard key={order.id} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">{order.orderNumber}</p>
              <h2 className="font-display text-4xl font-semibold text-ink">{order.restaurantName}</h2>
              <p className="text-sm text-ink-soft">{order.placedAt}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill label={order.status.replace(/_/g, " ")} tone={getStatusTone(order.status)} />
              <p className="text-sm font-semibold text-ink">{order.total}</p>
              <Link to={`/orders/${order.id}`} className="inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft">
                View details
              </Link>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </PageShell>
  );
};

export const OrderDetailsPage = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { isAuthenticated, user } = useAuth();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const useLiveFlow = isLiveCustomerSession(isAuthenticated, user?.role);
  const [isLoading, setIsLoading] = useState(useLiveFlow);
  const [loadError, setLoadError] = useState<string | null>(null);
  const parsedOrderId = Number(orderId ?? "0");
  const demoOrder = getOrderById(orderId);
  const shouldSubscribeToOrder = useLiveFlow && Boolean(parsedOrderId) && (order ? isActiveTrackedOrder(order.status) : true);

  const handleCloseOrderDetails = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }

    navigate("/orders");
  };

  const loadOrder = async ({ quietly = false }: { quietly?: boolean } = {}) => {
    if (!useLiveFlow) {
      return;
    }

    if (!parsedOrderId) {
      setOrder(null);
      setLoadError("The requested order could not be identified.");
      setIsLoading(false);
      return;
    }

    if (!quietly) {
      setIsLoading(true);
    }

    setLoadError(null);

    try {
      setOrder(await getCustomerOrderById(parsedOrderId));
    } catch (error) {
      setOrder(null);
      setLoadError(getApiErrorMessage(error, "Unable to load this order."));
    } finally {
      if (!quietly) {
        setIsLoading(false);
      }
    }
  };

  const handleReviewSubmit = async (payload: { rating: number; reviewText?: string }) => {
    if (!order) {
      return;
    }

    setIsSubmittingReview(true);
    try {
      const review = order.review
        ? await updateCustomerReview(order.review.id, payload)
        : await createCustomerReview({
            restaurantId: order.restaurant.id,
            orderId: order.id,
            rating: payload.rating,
            reviewText: payload.reviewText,
          });
      setOrder((currentOrder) => (currentOrder ? syncCustomerOrderReview(currentOrder, review) : currentOrder));
      setIsReviewModalOpen(false);
      toast.success(order.review ? "Review updated successfully." : "Review submitted successfully.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save your review right now."));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  useEffect(() => {
    if (!useLiveFlow) {
      return;
    }

    void loadOrder();
  }, [parsedOrderId, useLiveFlow, user?.id]);

  useRealtimeSubscription({
    enabled: shouldSubscribeToOrder,
    userId: user?.id,
    orderIds: [parsedOrderId],
    onOrderStatusUpdate: (payload) => {
      if (payload.orderId === parsedOrderId) {
        setOrder((currentOrder) => (currentOrder ? syncCustomerOrderStatus(currentOrder, payload.status) : currentOrder));
        void loadOrder({ quietly: true });
      }
    },
    onDeliveryLocationUpdate: (payload) => {
      if (payload.orderId !== parsedOrderId) {
        return;
      }

      setOrder((currentOrder) =>
        currentOrder && isActiveTrackedOrder(currentOrder.status)
          ? mergeCustomerOrderLocation(currentOrder, payload)
          : currentOrder,
      );
    },
  });

  if (useLiveFlow && isLoading) {
    return (
      <PageShell
        eyebrow="Order details"
        title="Order details"
        description="We are loading the latest details for this order."
        actions={
          <Button type="button" variant="secondary" onClick={handleCloseOrderDetails}>
            Close
          </Button>
        }
      >
        <SurfaceCard>
          <p className="text-sm text-ink-soft">Loading your order...</p>
        </SurfaceCard>
      </PageShell>
    );
  }

  if (useLiveFlow && !order) {
    return (
      <PageShell
        eyebrow="Order details"
        title="Order details"
        description="This order could not be loaded for your account."
        actions={
          <Button type="button" variant="secondary" onClick={handleCloseOrderDetails}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          <EmptyState
            title="We couldn't load this order"
            description={loadError ?? "The order may no longer exist or may not belong to your account."}
          />
          <div className="flex justify-center">
            <Link to="/orders" className={linkButtonClassName}>
              Back to order history
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  if (useLiveFlow && order) {
    return (
      <>
        <PageShell
          eyebrow="Order details"
          title={order.orderNumber}
          description={`A detailed record of your ${order.restaurant.name} order, payment method, and delivery timeline.`}
          actions={
            <>
              <Button type="button" variant="secondary" onClick={handleCloseOrderDetails}>
                Close
              </Button>
              {isActiveTrackedOrder(order.status) ? (
                <Link to={`/track-order/${order.id}`} className={linkButtonClassName}>Track this order</Link>
              ) : null}
              {canReviewOrder(order) ? (
                <Button type="button" onClick={() => setIsReviewModalOpen(true)}>
                  {order.review ? "Edit review" : "Rate order"}
                </Button>
              ) : null}
            </>
          }
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <SurfaceCard className="space-y-5">
              <SectionHeading
                title={order.restaurant.name}
                description={formatOrderDateTime(order.orderedAt)}
              />
              {order.items.map((item) => {
                const snapshot = parseSnapshot(item.itemSnapshot);

                return (
                  <div key={item.id} className="rounded-[1.5rem] bg-cream px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-ink">{item.itemName}</p>
                      <p className="text-sm text-ink-soft">
                        {item.quantity} x {formatCurrency(item.itemPrice)}
                      </p>
                    </div>
                    {item.itemType === "COMBO" && snapshot?.includedItems?.length ? (
                      <p className="mt-2 text-xs text-ink-muted">
                        Includes {snapshot.includedItems.map((includedItem) => `${includedItem.quantity}x ${includedItem.name}`).join(", ")}
                      </p>
                    ) : null}
                    {item.addons.length ? (
                      <p className="mt-2 text-xs text-ink-muted">
                        Add-ons: {item.addons.map((addon) => addon.addonName).join(", ")}
                      </p>
                    ) : null}
                  </div>
                );
              })}
              <div className="space-y-4 pt-2">
                {order.statusEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between text-sm text-ink-soft">
                    <span>{toLabel(event.status)}</span>
                    <span>{formatOrderDateTime(event.createdAt)}</span>
                  </div>
                ))}
              </div>
            </SurfaceCard>
            <SurfaceCard className="space-y-4">
              <SectionHeading title="Payment & delivery" />
              <div className="flex flex-wrap gap-2">
                <StatusPill label={toLabel(order.status)} tone={getOrderStatusTone(order.status)} />
              </div>
              <div className="space-y-3 text-sm text-ink-soft">
                <p>
                  <span className="font-semibold text-ink">Paid via:</span> {toLabel(order.paymentMethod)}
                </p>
                <p>
                  <span className="font-semibold text-ink">Total:</span> {formatCurrency(order.totalAmount)}
                </p>
                <p>
                  <span className="font-semibold text-ink">Tip:</span> {formatCurrency(order.tipAmount)}
                </p>
                <p>
                  <span className="font-semibold text-ink">ETA:</span> {formatEtaMinutes(order.estimatedDeliveryMinutes)}
                </p>
                <p>
                  <span className="font-semibold text-ink">Route distance:</span> {formatDistanceKm(order.routeDistanceKm)}
                </p>
                <p>
                  <span className="font-semibold text-ink">Delivering to:</span>{" "}
                  {[order.address.houseNo, order.address.street, order.address.area, order.address.city]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p>
                  <span className="font-semibold text-ink">Delivery partner:</span>{" "}
                  {order.deliveryPartner?.user.fullName ?? "Assignment pending"}
                </p>
                {order.review ? (
                  <p>
                    <span className="font-semibold text-ink">Your review:</span> {order.review.rating}/5
                    {order.review.reviewText ? ` - ${order.review.reviewText}` : ""}
                  </p>
                ) : canReviewOrder(order) ? (
                  <p>
                    <span className="font-semibold text-ink">Review:</span> Your delivered order is ready to be rated.
                  </p>
                ) : null}
                {order.specialInstructions ? (
                  <p>
                    <span className="font-semibold text-ink">Checkout details:</span> {order.specialInstructions}
                  </p>
                ) : null}
              </div>
              <RouteMap
                markers={buildOrderRouteMarkers(order)}
                emptyMessage="Map details will appear as soon as your restaurant, drop-off, or rider coordinates are available."
              />
            </SurfaceCard>
          </div>
        </PageShell>
        {canReviewOrder(order) ? (
          <OrderReviewModal
            open={isReviewModalOpen}
            order={order}
            isSubmitting={isSubmittingReview}
            onClose={() => setIsReviewModalOpen(false)}
            onSubmit={handleReviewSubmit}
          />
        ) : null}
      </>
    );
  }

  if (!demoOrder) {
    return <Navigate to="/404" replace />;
  }

  return (
    <PageShell
      eyebrow="Order details"
      title={demoOrder.orderNumber}
      description={`A detailed record of your ${demoOrder.restaurantName} order, payment method, and delivery timeline.`}
      actions={
        <>
          <Button type="button" variant="secondary" onClick={handleCloseOrderDetails}>
            Close
          </Button>
          {isActiveTrackedOrder(demoOrder.status) ? (
            <Link to={`/track-order/${demoOrder.id}`} className={linkButtonClassName}>Track this order</Link>
          ) : null}
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <SurfaceCard className="space-y-5">
          <SectionHeading title={demoOrder.restaurantName} description={demoOrder.placedAt} />
          {demoOrder.items.map((item) => (
            <div key={item} className="flex items-center justify-between rounded-[1.5rem] bg-cream px-5 py-4">
              <p className="text-sm font-semibold text-ink">{item}</p>
              <p className="text-sm text-ink-soft">Included</p>
            </div>
          ))}
          <div className="space-y-4 pt-2">
            {demoOrder.timeline.map((step) => (
              <div key={step.label} className="flex items-center justify-between text-sm text-ink-soft">
                <span>{step.label}</span>
                <span>{step.time}</span>
              </div>
            ))}
          </div>
        </SurfaceCard>
        <SurfaceCard className="space-y-4">
          <SectionHeading title="Payment & delivery" />
          <div className="space-y-3 text-sm text-ink-soft">
            <p>
              <span className="font-semibold text-ink">Paid via:</span> {demoOrder.paymentMethod}
            </p>
            <p>
              <span className="font-semibold text-ink">Total:</span> {demoOrder.total}
            </p>
            <p>
              <span className="font-semibold text-ink">Delivering to:</span> {demoOrder.deliveryAddress}
            </p>
          </div>
        </SurfaceCard>
      </div>
    </PageShell>
  );
};
