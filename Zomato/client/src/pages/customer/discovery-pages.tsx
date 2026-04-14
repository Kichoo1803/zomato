import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { CatalogItemModal, type CatalogItemSelection } from "@/components/customer/catalog-item-modal";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { PageShell, SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { RatingBadge } from "@/components/ui/rating-badge";
import { Tabs } from "@/components/ui/tabs";
import { SearchBar } from "@/components/navigation/search-bar";
import { FoodItemCard } from "@/components/cards/food-item-card";
import { OfferCard } from "@/components/cards/offer-card";
import { RestaurantCard } from "@/components/cards/restaurant-card";
import { ReviewCard } from "@/components/cards/review-card";
import { useAuth } from "@/hooks/use-auth";
import { getApiErrorMessage } from "@/lib/auth";
import {
  addCustomerCartItem,
  addCustomerFavorite,
  applyCustomerCartOffer,
  clearPendingCustomerCouponSelection,
  createCustomerPaymentMethod,
  getCustomerFavorites,
  getCustomerCarts,
  getCustomerPaymentMethods,
  getPublicOffers,
  getPublicRestaurantBySlug,
  getPublicRestaurants,
  readPendingCustomerCouponSelection,
  removeCustomerFavorite,
  removeCustomerCartOffer,
  updateCustomerPaymentMethod,
  updateCustomerMembership,
  writePendingCustomerCouponSelection,
  type CustomerCart,
  type CustomerFavoriteRestaurant,
  type CustomerPaymentMethod,
  type CustomerOffer,
  type CustomerRestaurantDetail,
  type CustomerRestaurantSummary,
} from "@/lib/customer";
import type { MembershipStatus, MembershipTier } from "@/types/auth";
import {
  getRestaurantBySlug,
  membershipBenefits,
  restaurantCategories,
  restaurants as demoRestaurants,
} from "@/lib/demo-data";

const linkButtonClassName =
  "inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft";

type RestaurantCardData = {
  id?: number;
  slug: string;
  name: string;
  image: string;
  area: string;
  addressSummary?: string;
  cuisineLabel: string;
  rating: number;
  deliveryTime: number;
  costForTwo: string;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const formatLocationText = (...parts: Array<string | null | undefined>) =>
  parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");

const mapLiveRestaurantCard = (restaurant: CustomerRestaurantSummary): RestaurantCardData => ({
  id: restaurant.id,
  slug: restaurant.slug,
  name: restaurant.name,
  image: restaurant.coverImage ?? "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  area: formatLocationText(restaurant.area, restaurant.city, restaurant.state),
  addressSummary: restaurant.addressLine?.trim() || undefined,
  cuisineLabel:
    restaurant.cuisineMappings.map((mapping) => mapping.cuisine.name).join(" • ") || "Curated menu",
  rating: restaurant.avgRating,
  deliveryTime: restaurant.avgDeliveryTime,
  costForTwo: formatCurrency(restaurant.costForTwo),
});

const mapFavoriteRestaurantCard = (favorite: CustomerFavoriteRestaurant): RestaurantCardData => ({
  id: favorite.restaurant.id,
  slug: favorite.restaurant.slug,
  name: favorite.restaurant.name,
  image:
    favorite.restaurant.coverImage ??
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  area: formatLocationText(favorite.restaurant.area, favorite.restaurant.city, favorite.restaurant.state),
  addressSummary: favorite.restaurant.addressLine?.trim() || undefined,
  cuisineLabel:
    favorite.restaurant.cuisineMappings.map((mapping) => mapping.cuisine.name).join(" â€¢ ") || "Saved favorite",
  rating: favorite.restaurant.avgRating,
  deliveryTime: favorite.restaurant.avgDeliveryTime,
  costForTwo: formatCurrency(favorite.restaurant.costForTwo),
});

const demoRestaurantCards: RestaurantCardData[] = demoRestaurants.map((restaurant) => ({
  slug: restaurant.slug,
  name: restaurant.name,
  image: restaurant.image,
  area: restaurant.area,
  addressSummary: restaurant.address,
  cuisineLabel: restaurant.cuisineLabel,
  rating: restaurant.rating,
  deliveryTime: restaurant.deliveryTime,
  costForTwo: restaurant.costForTwo,
}));

const useCustomerFavorites = () => {
  const { user } = useAuth();
  const [favoriteRestaurantIds, setFavoriteRestaurantIds] = useState<number[]>([]);
  const [favoriteCards, setFavoriteCards] = useState<RestaurantCardData[]>([]);
  const [hasResolved, setHasResolved] = useState(false);
  const [pendingRestaurantIds, setPendingRestaurantIds] = useState<number[]>([]);

  const loadFavorites = async ({ quietly = false }: { quietly?: boolean } = {}) => {
    if (!quietly) {
      setHasResolved(false);
    }

    try {
      const favorites = await getCustomerFavorites();
      setFavoriteRestaurantIds(favorites.map((favorite) => favorite.restaurantId));
      setFavoriteCards(favorites.map(mapFavoriteRestaurantCard));
    } catch {
      setFavoriteRestaurantIds([]);
      setFavoriteCards([]);
    } finally {
      setHasResolved(true);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setFavoriteRestaurantIds([]);
      setFavoriteCards([]);
      setHasResolved(true);
      return;
    }

    void loadFavorites();
  }, [user?.id]);

  const favoriteIdSet = useMemo(() => new Set(favoriteRestaurantIds), [favoriteRestaurantIds]);

  const toggleFavorite = async (restaurant: RestaurantCardData) => {
    if (!restaurant.id) {
      return;
    }

    const restaurantId = restaurant.id;
    const isFavorite = favoriteIdSet.has(restaurantId);
    setPendingRestaurantIds((currentIds) =>
      currentIds.includes(restaurantId) ? currentIds : [...currentIds, restaurantId],
    );

    try {
      if (isFavorite) {
        await removeCustomerFavorite(restaurantId);
        setFavoriteRestaurantIds((currentIds) => currentIds.filter((currentId) => currentId !== restaurantId));
        setFavoriteCards((currentCards) => currentCards.filter((card) => card.id !== restaurantId));
        toast.success("Removed from favorites.");
      } else {
        await addCustomerFavorite(restaurantId);
        setFavoriteRestaurantIds((currentIds) =>
          currentIds.includes(restaurantId) ? currentIds : [...currentIds, restaurantId],
        );
        toast.success("Added to favorites.");
        void loadFavorites({ quietly: true });
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update favorites right now."));
    } finally {
      setPendingRestaurantIds((currentIds) => currentIds.filter((currentId) => currentId !== restaurantId));
    }
  };

  return {
    favoriteCards,
    favoriteIdSet,
    isLoading: !hasResolved,
    isFavoritePending: (restaurantId?: number) =>
      restaurantId != null ? pendingRestaurantIds.includes(restaurantId) : false,
    toggleFavorite,
  };
};

type MembershipPlan = {
  tier: MembershipTier;
  priceValue: number;
  priceLabel: string;
  cadence: string;
  summary: string;
  benefits: string[];
};

const membershipPlans: MembershipPlan[] = [
  {
    tier: "CLASSIC",
    priceValue: 0,
    priceLabel: "Free",
    cadence: "Base plan",
    summary: "A low-friction starting tier for customers who want the premium flow without a paid commitment yet.",
    benefits: [
      "Access to everyday offers and curated restaurant discovery",
      "Saved addresses, wallet, and order history in one account",
      "Fast checkout with your preferred delivery and payment details",
    ],
  },
  {
    tier: "GOLD",
    priceValue: 299,
    priceLabel: "Rs. 299",
    cadence: "30 days",
    summary: "Built for frequent diners who want faster delivery promises, richer rewards, and priority reservation access.",
    benefits: membershipBenefits,
  },
  {
    tier: "PLATINUM",
    priceValue: 599,
    priceLabel: "Rs. 599",
    cadence: "30 days",
    summary: "A higher-touch tier for regular premium ordering with broader perks and stronger priority treatment.",
    benefits: [
      ...membershipBenefits,
      "Higher-value member-only offers across premium kitchens",
      "Priority support handling for time-sensitive dining plans",
    ],
  },
];

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

const formatMembershipDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
      }).format(new Date(value))
    : "Not scheduled";

type MembershipPaymentMode = "CARD" | "UPI";

type MembershipCardDetails = {
  label: string;
  holderName: string;
  last4: string;
  expiryMonth: string;
  expiryYear: string;
  isPrimary: boolean;
};

type MembershipUpiDetails = {
  upiId: string;
  appLabel?: string;
};

const isPaidMembershipTier = (tier: MembershipTier) => tier !== "CLASSIC";
const membershipTierRanks: Record<MembershipTier, number> = {
  CLASSIC: 0,
  GOLD: 1,
  PLATINUM: 2,
};
const getMembershipTierRank = (tier?: MembershipTier | null) => membershipTierRanks[tier ?? "CLASSIC"];

const completedMembershipStatuses = new Set(["INACTIVE", "EXPIRED", "COMPLETED"]);

const normalizeMembershipStatusValue = (status?: string | null) => status?.trim().toUpperCase() ?? "ACTIVE";

const hasMembershipExpired = (expiresAt?: string | null) => {
  if (!expiresAt) {
    return false;
  }

  const expiresAtTimestamp = new Date(expiresAt).getTime();
  return Number.isFinite(expiresAtTimestamp) && expiresAtTimestamp <= Date.now();
};

const getEffectiveMembershipStatus = (
  tier: MembershipTier,
  status?: string | null,
  expiresAt?: string | null,
): MembershipStatus => {
  const normalizedStatus = normalizeMembershipStatusValue(status);

  if (completedMembershipStatuses.has(normalizedStatus)) {
    return normalizedStatus === "INACTIVE" ? "INACTIVE" : "EXPIRED";
  }

  if (isPaidMembershipTier(tier) && hasMembershipExpired(expiresAt)) {
    return "EXPIRED";
  }

  return "ACTIVE";
};

type MembershipUpgradeBlockReason = {
  buttonLabel: string;
  detail: string;
};

const getMembershipUpgradeBlockReason = ({
  currentTier,
  targetTier,
}: {
  currentTier: MembershipTier;
  targetTier: MembershipTier;
}): MembershipUpgradeBlockReason | null => {
  const currentTierRank = getMembershipTierRank(currentTier);
  const targetTierRank = getMembershipTierRank(targetTier);

  if (targetTierRank < currentTierRank) {
    return {
      buttonLabel: "Current plan is higher",
      detail: "Downgrade is not allowed from the upgrade flow.",
    };
  }

  if (targetTierRank === currentTierRank) {
    return {
      buttonLabel: "Current plan",
      detail: "You are already on this plan.",
    };
  }

  return null;
};

const membershipPaymentModeItems = [
  { value: "CARD", label: "Cards" },
  { value: "UPI", label: "UPI" },
] as const;

const membershipCardDetailsSchema = z.object({
  label: z.string().trim().min(2, "Card label is required.").max(40),
  holderName: z.string().trim().min(2, "Card holder name is required.").max(80),
  last4: z.string().trim().regex(/^\d{4}$/, "Enter the last 4 digits only."),
  expiryMonth: z.string().trim().regex(/^(0[1-9]|1[0-2])$/, "Use a valid month like 08."),
  expiryYear: z.string().trim().regex(/^\d{2,4}$/, "Use a valid expiry year."),
  isPrimary: z.boolean().default(true),
});

const membershipUpiDetailsSchema = z.object({
  upiId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/, "Enter a valid UPI ID."),
  appLabel: z.string().trim().max(40).optional().or(z.literal("")),
});

type MembershipCardDetailsFormValues = z.infer<typeof membershipCardDetailsSchema>;
type MembershipUpiDetailsFormValues = z.infer<typeof membershipUpiDetailsSchema>;

const normalizeMembershipText = (value?: string | null) => value?.trim() ?? "";

const getPaymentMethodTitle = (paymentMethod: CustomerPaymentMethod) => {
  if (paymentMethod.type === "CARD") {
    return `${paymentMethod.label ?? "Card"} ending ${paymentMethod.maskedEnding ?? "0000"}`;
  }

  return paymentMethod.label?.trim()
    ? `${paymentMethod.label} - ${paymentMethod.upiId ?? ""}`
    : `UPI - ${paymentMethod.upiId ?? "No ID"}`;
};

const getPaymentMethodSubtitle = (paymentMethod: CustomerPaymentMethod) => {
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

const getPreferredPaymentMethod = (
  paymentMethods: CustomerPaymentMethod[],
  type: MembershipPaymentMode,
) =>
  paymentMethods.find((paymentMethod) => paymentMethod.type === type && paymentMethod.isPrimary) ??
  paymentMethods.find((paymentMethod) => paymentMethod.type === type) ??
  null;

const getPreferredPaymentMethodId = (
  paymentMethods: CustomerPaymentMethod[],
  type: MembershipPaymentMode,
) => getPreferredPaymentMethod(paymentMethods, type)?.id ?? null;

const getMembershipPaymentModeLabel = (mode: MembershipPaymentMode) => (mode === "CARD" ? "Card" : "UPI");

const toMembershipCardDetails = (paymentMethod: CustomerPaymentMethod | null): MembershipCardDetails | null =>
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

const toMembershipUpiDetails = (paymentMethod: CustomerPaymentMethod | null): MembershipUpiDetails | null =>
  paymentMethod && paymentMethod.type === "UPI"
    ? {
        upiId: paymentMethod.upiId?.trim() || "",
        appLabel: paymentMethod.label?.trim() || undefined,
      }
    : null;

const getMembershipPaymentDetailSummary = (
  paymentMode: MembershipPaymentMode,
  paymentMethod: CustomerPaymentMethod | null,
) => {
  if (!paymentMethod) {
    return paymentMode === "CARD" ? "No saved card selected" : "No saved UPI ID selected";
  }

  if (paymentMethod.type === "CARD") {
    return `${paymentMethod.label ?? "Card"} ending ${paymentMethod.maskedEnding ?? "0000"}`;
  }

  return paymentMethod.label?.trim()
    ? `${paymentMethod.label} - ${paymentMethod.upiId ?? "Saved UPI ID"}`
    : paymentMethod.upiId ?? "Saved UPI ID";
};

const MembershipCardDetailsModal = ({
  open,
  details,
  defaultHolderName,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  details: MembershipCardDetails | null;
  defaultHolderName?: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: MembershipCardDetailsFormValues) => Promise<void>;
}) => {
  const form = useForm<MembershipCardDetailsFormValues>({
    resolver: zodResolver(membershipCardDetailsSchema),
    defaultValues: {
      label: details?.label ?? "",
      holderName: details?.holderName ?? normalizeMembershipText(defaultHolderName),
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
      holderName: details?.holderName ?? normalizeMembershipText(defaultHolderName),
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
          Only a masked card summary is saved here for membership upgrades. Full card numbers and CVV are never stored.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Card label" placeholder="Visa Personal" error={form.formState.errors.label?.message} {...form.register("label")} />
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

const MembershipUpiDetailsModal = ({
  open,
  details,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  details: MembershipUpiDetails | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: MembershipUpiDetailsFormValues) => Promise<void>;
}) => {
  const form = useForm<MembershipUpiDetailsFormValues>({
    resolver: zodResolver(membershipUpiDetailsSchema),
    defaultValues: {
      upiId: details?.upiId ?? "",
      appLabel: details?.appLabel ?? "",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      upiId: details?.upiId ?? "",
      appLabel: details?.appLabel ?? "",
    });
  }, [details, form, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      upiId: values.upiId.trim(),
      appLabel: values.appLabel?.trim() ?? "",
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
          Use an app tag like GPay, PhonePe, or Paytm if you want the saved summary to read more naturally.
        </div>
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

const useRestaurantCatalogue = (search?: string) => {
  const [liveRestaurants, setLiveRestaurants] = useState<CustomerRestaurantSummary[] | null>(null);
  const [hasResolved, setHasResolved] = useState(false);
  const normalizedSearch = search?.trim() ?? "";

  useEffect(() => {
    let isMounted = true;
    setHasResolved(false);

    void getPublicRestaurants(normalizedSearch ? { search: normalizedSearch } : undefined)
      .then((rows) => {
        if (isMounted) {
          setLiveRestaurants(rows);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLiveRestaurants([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setHasResolved(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [normalizedSearch]);

  const hasLiveData = Boolean(liveRestaurants?.length);
  const shouldUseDemoFallback = !normalizedSearch && hasResolved && !hasLiveData;

  const restaurantCards = hasLiveData
    ? (liveRestaurants ?? []).map(mapLiveRestaurantCard)
    : shouldUseDemoFallback
      ? demoRestaurantCards
      : [];

  const categories = hasLiveData
    ? [
        "All",
        ...Array.from(
          new Set(
            (liveRestaurants ?? []).flatMap((restaurant) =>
              restaurant.cuisineMappings.map((mapping) => mapping.cuisine.name),
            ),
          ),
        ),
      ]
    : shouldUseDemoFallback
      ? restaurantCategories
      : ["All"];

  return {
    restaurantCards,
    categories,
    hasLiveData,
    isLoading: !hasResolved,
  };
};

export const RestaurantListingPage = () => {
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const { restaurantCards, categories, isLoading } = useRestaurantCatalogue(appliedSearch);
  const { favoriteIdSet, isFavoritePending, toggleFavorite } = useCustomerFavorites();
  const [activeCategory, setActiveCategory] = useState("All");
  const [page, setPage] = useState(1);

  const filteredRestaurants = useMemo(() => {
    if (activeCategory === "All") {
      return restaurantCards;
    }

    return restaurantCards.filter((restaurant) =>
      `${restaurant.cuisineLabel} ${restaurant.name}`
        .toLowerCase()
        .includes(activeCategory.toLowerCase()),
    );
  }, [activeCategory, restaurantCards]);

  useEffect(() => {
    if (categories.includes(activeCategory)) {
      return;
    }

    setActiveCategory("All");
  }, [activeCategory, categories]);

  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil(filteredRestaurants.length / pageSize));
  const paginatedRestaurants = filteredRestaurants.slice((page - 1) * pageSize, page * pageSize);

  return (
    <PageShell
      eyebrow="Customer dining"
      title="Restaurants curated for polished everyday indulgence."
      description="Browse premium delivery kitchens, romantic dinner picks, pastry counters, and the city’s most dependable comfort menus."
      actions={
        <Link
          to="/membership"
          className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
        >
          Membership perks
        </Link>
      }
    >
      <SurfaceCard>
        <div className="space-y-5">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              setAppliedSearch(searchInput.trim());
              setPage(1);
            }}
          >
            <SearchBar
              className="flex-1"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by restaurant, cuisine, dish, city, state, or locality"
            />
            <Button type="submit" className="shrink-0" disabled={isLoading}>
              Search
            </Button>
          </form>
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <Chip
                key={category}
                active={activeCategory === category}
                onClick={() => {
                  setActiveCategory(category);
                  setPage(1);
                }}
              >
                {category}
              </Chip>
            ))}
          </div>
        </div>
      </SurfaceCard>

      {filteredRestaurants.length ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {paginatedRestaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.slug}
                {...restaurant}
                isFavorite={restaurant.id != null ? favoriteIdSet.has(restaurant.id) : false}
                isFavoritePending={isFavoritePending(restaurant.id)}
                favoriteActionLabel={restaurant.id != null && favoriteIdSet.has(restaurant.id) ? "Saved" : "Save"}
                onFavoriteToggle={restaurant.id != null ? () => void toggleFavorite(restaurant) : undefined}
              />
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState
          title="No restaurants matched that search"
          description="Try a broader cuisine, restaurant name, city, state, or clear the search field to see the full catalogue."
        />
      )}
    </PageShell>
  );
};

export const SearchResultsPage = () => {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const activeQuery = params.get("q")?.trim() ?? "";
  const { restaurantCards, isLoading } = useRestaurantCatalogue(activeQuery);
  const { favoriteIdSet, isFavoritePending, toggleFavorite } = useCustomerFavorites();
  const results = restaurantCards;

  return (
    <PageShell
      eyebrow="Search"
      title="Everything worth craving, all in one place."
      description="Search across restaurants, cuisines, signature dishes, and location names without leaving the current app shell."
      actions={
        <Button
          type="button"
          onClick={() => {
            const next = new URLSearchParams(params);
            if (query.trim()) {
              next.set("q", query.trim());
            } else {
              next.delete("q");
            }
            setParams(next);
          }}
        >
          Search now
        </Button>
      }
    >
      <SurfaceCard>
        <SearchBar
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try 'Chennai', 'biryani', 'Anna Nagar', or 'croissant'"
        />
      </SurfaceCard>

      <SectionHeading
        eyebrow="Search results"
        title={params.get("q") ? `Results for "${params.get("q")}"` : "Start with a dish, cuisine, restaurant, or location"}
        description={`${results.length} curated matches in the current catalogue.`}
      />

      {isLoading ? null : results.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {results.map((restaurant) => (
            <RestaurantCard
              key={restaurant.slug}
              {...restaurant}
              isFavorite={restaurant.id != null ? favoriteIdSet.has(restaurant.id) : false}
              isFavoritePending={isFavoritePending(restaurant.id)}
              favoriteActionLabel={restaurant.id != null && favoriteIdSet.has(restaurant.id) ? "Saved" : "Save"}
              onFavoriteToggle={restaurant.id != null ? () => void toggleFavorite(restaurant) : undefined}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No restaurants matched that search"
          description="Try a broader cuisine, restaurant name, location, or a dish like biryani, burrata, or croissant."
        />
      )}
    </PageShell>
  );
};

export const RestaurantDetailsPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { slug } = useParams();
  const [liveRestaurant, setLiveRestaurant] = useState<CustomerRestaurantDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selection, setSelection] = useState<CatalogItemSelection | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const { favoriteIdSet, isFavoritePending, toggleFavorite } = useCustomerFavorites();

  const handleCloseDetails = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }

    navigate("/restaurants");
  };

  useEffect(() => {
    if (!slug) {
      setLiveRestaurant(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setLiveRestaurant(null);
    setIsLoading(true);

    void getPublicRestaurantBySlug(slug)
      .then((restaurant) => {
        if (isMounted) {
          setLiveRestaurant(restaurant);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLiveRestaurant(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const handleAddToCart = async (payload: {
    restaurantId: number;
    menuItemId?: number;
    comboId?: number;
    quantity: number;
    addonIds?: number[];
    specialInstructions?: string;
  }) => {
    if (!isAuthenticated || user?.role !== "CUSTOMER") {
      toast.error("Sign in with a customer account to place live orders.");
      navigate("/login");
      return;
    }

    setIsAddingToCart(true);
    try {
      await addCustomerCartItem(payload);
      toast.success("Added to cart successfully.");
      setSelection(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to add this item to your cart."));
    } finally {
      setIsAddingToCart(false);
    }
  };

  if (isLoading) {
    return null;
  }

  if (liveRestaurant) {
    const restaurantCardData = mapLiveRestaurantCard(liveRestaurant);
    const isFavorite = favoriteIdSet.has(liveRestaurant.id);
    const cuisineLabel =
      liveRestaurant.cuisineMappings.map((mapping) => mapping.cuisine.name).join(" • ") || "Curated menu";
    const reviewCards = liveRestaurant.reviews.map((review) => ({
      author: review.user.fullName,
      title: review.reviewText ? review.reviewText.slice(0, 48) : "Premium delivery experience",
      review: review.reviewText ?? "A premium ordering experience with polished execution.",
      rating: review.rating,
      date: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(review.createdAt)),
    }));
    const liveLocationSummary =
      formatLocationText(liveRestaurant.area, liveRestaurant.city, liveRestaurant.state) || liveRestaurant.city;
    const liveAddressSummary = formatLocationText(liveRestaurant.addressLine, liveRestaurant.pincode);

    return (
      <>
        <PageShell
          eyebrow={liveLocationSummary}
          title={liveRestaurant.name}
          description={liveRestaurant.description ?? "A premium restaurant experience with live menu and combo ordering."}
          actions={
            <>
              <Button type="button" variant="secondary" onClick={handleCloseDetails}>
                Close
              </Button>
              <Link to="/cart" className={linkButtonClassName}>
                Go to cart
              </Link>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void toggleFavorite(restaurantCardData)}
                disabled={isFavoritePending(liveRestaurant.id)}
              >
                {isFavoritePending(liveRestaurant.id)
                  ? "Saving..."
                  : isFavorite
                    ? "Remove from favorites"
                    : "Add to favorites"}
              </Button>
            </>
          }
        >
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <SurfaceCard className="overflow-hidden p-0">
              <img
                src={liveRestaurant.coverImage ?? "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80"}
                alt={liveRestaurant.name}
                className="h-[420px] w-full object-cover"
              />
            </SurfaceCard>
            <SurfaceCard className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-ink-soft">{cuisineLabel}</p>
                  <p className="mt-3 text-sm leading-7 text-ink-soft">
                    {liveRestaurant.description ?? "Live restaurant details and curated ordering."}
                  </p>
                </div>
                <RatingBadge value={liveRestaurant.avgRating.toFixed(1)} />
              </div>
              <div className="flex flex-wrap gap-3">
                {liveRestaurant.categoryMappings.map((mapping) => (
                  <Chip key={mapping.category.id}>{mapping.category.name}</Chip>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Location</p>
                  <p className="mt-2 text-sm text-ink-soft">{liveLocationSummary}</p>
                  {liveAddressSummary ? (
                    <p className="mt-2 text-sm text-ink-muted">{liveAddressSummary}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Hours</p>
                  <p className="mt-2 text-sm text-ink-soft">
                    {liveRestaurant.openingTime && liveRestaurant.closingTime
                      ? `${liveRestaurant.openingTime} - ${liveRestaurant.closingTime}`
                      : "Hours unavailable"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Delivery time</p>
                  <p className="mt-2 text-sm text-ink-soft">
                    {liveRestaurant.avgDeliveryTime} min average
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Cost for two</p>
                  <p className="mt-2 text-sm text-ink-soft">{formatCurrency(liveRestaurant.costForTwo)}</p>
                </div>
              </div>
            </SurfaceCard>
          </div>

          {liveRestaurant.combos.length ? (
            <>
              <SectionHeading
                eyebrow="Combos"
                title="Curated meal combos"
                description="Meal bundles, offer pricing, and richer upsells that fit the current premium card language."
              />

              <div className="grid gap-5">
                {liveRestaurant.combos.map((combo) => (
                  <FoodItemCard
                    key={combo.id}
                    name={combo.name}
                    description={`${combo.description ?? "Meal combo"} Includes ${combo.items.map((item) => `${item.quantity}x ${item.menuItem.name}`).join(", ")}.`}
                    price={formatCurrency(combo.offerPrice ?? combo.basePrice)}
                    badge={combo.categoryTag ?? "Combo"}
                    image={combo.image ?? liveRestaurant.coverImage ?? "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80"}
                    buttonLabel="Add combo"
                    onAdd={() =>
                      setSelection({
                        type: "COMBO",
                        restaurantId: liveRestaurant.id,
                        item: combo,
                      })
                    }
                  />
                ))}
              </div>
            </>
          ) : null}

          <SectionHeading
            eyebrow="Menu"
            title="Signature dishes"
            description="Live menu items, existing add-ons, and combo-ready ordering through the current card system."
          />

          <div className="space-y-6">
            {liveRestaurant.menuCategories.map((category) => (
              <div key={category.id} className="space-y-4">
                <h3 className="font-display text-4xl font-semibold text-ink">{category.name}</h3>
                <div className="grid gap-5">
                  {category.menuItems.map((item) => (
                    <FoodItemCard
                      key={item.id}
                      name={item.name}
                      description={item.description ?? "Freshly prepared and ready for delivery."}
                      price={formatCurrency(item.discountPrice ?? item.price)}
                      badge={item.isRecommended ? "Recommended" : item.foodType}
                      image={item.image ?? liveRestaurant.coverImage ?? "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80"}
                      onAdd={() =>
                        setSelection({
                          type: "MENU_ITEM",
                          restaurantId: liveRestaurant.id,
                          item,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <SectionHeading
            eyebrow="Guest sentiment"
            title="Recent reviews"
            description="Live review data from recent orders and completed dining experiences."
          />

          <div className="grid gap-5 lg:grid-cols-2">
            {reviewCards.length ? (
              reviewCards.map((review) => (
                <ReviewCard key={`${review.author}-${review.date}`} {...review} />
              ))
            ) : (
              <EmptyState
                title="No reviews yet"
                description="The first few customer reviews will appear here once orders are completed."
              />
            )}
          </div>
        </PageShell>

        <CatalogItemModal
          open={Boolean(selection)}
          selection={selection}
          isSubmitting={isAddingToCart}
          onClose={() => setSelection(null)}
          onSubmit={handleAddToCart}
        />
      </>
    );
  }

  const demoRestaurant = getRestaurantBySlug(slug);

  if (!demoRestaurant) {
    return <Navigate to="/404" replace />;
  }

  return (
    <PageShell
      eyebrow={demoRestaurant.area}
      title={demoRestaurant.name}
      description={demoRestaurant.heroNote}
      actions={
        <>
          <Button type="button" variant="secondary" onClick={handleCloseDetails}>
            Close
          </Button>
          <Link to="/cart" className={linkButtonClassName}>
            Go to cart
          </Link>
          <Link
            to="/favorites"
            className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft"
          >
            Save restaurant
          </Link>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <SurfaceCard className="overflow-hidden p-0">
          <img src={demoRestaurant.image} alt={demoRestaurant.name} className="h-[420px] w-full object-cover" />
        </SurfaceCard>
        <SurfaceCard className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-ink-soft">{demoRestaurant.cuisineLabel}</p>
              <p className="mt-3 text-sm leading-7 text-ink-soft">{demoRestaurant.description}</p>
            </div>
            <RatingBadge value={demoRestaurant.rating.toFixed(1)} />
          </div>
          <div className="flex flex-wrap gap-3">
            {demoRestaurant.tags.map((tag) => (
              <Chip key={tag}>{tag}</Chip>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Address</p>
              <p className="mt-2 text-sm text-ink-soft">{demoRestaurant.address}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Hours</p>
              <p className="mt-2 text-sm text-ink-soft">{demoRestaurant.hours}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Delivery time</p>
              <p className="mt-2 text-sm text-ink-soft">{demoRestaurant.deliveryTime} min average</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Cost for two</p>
              <p className="mt-2 text-sm text-ink-soft">{demoRestaurant.costForTwo}</p>
            </div>
          </div>
        </SurfaceCard>
      </div>

      <SectionHeading
        eyebrow="Menu"
        title="Signature dishes"
        description="A polished demo menu presentation wired to the existing card system."
      />

      <div className="space-y-6">
        {demoRestaurant.menu.map((category) => (
          <div key={category.category} className="space-y-4">
            <h3 className="font-display text-4xl font-semibold text-ink">{category.category}</h3>
            <div className="grid gap-5">
              {category.items.map((item) => (
                <FoodItemCard key={item.name} {...item} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <SectionHeading
        eyebrow="Guest sentiment"
        title="Recent reviews"
        description="Curated review cards replace the earlier single-screen shell and keep the premium reading rhythm intact."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {demoRestaurant.reviews.map((review) => (
          <ReviewCard key={`${review.author}-${review.date}`} {...review} />
        ))}
      </div>
    </PageShell>
  );
};

export const FavoritesPage = () => {
  const { favoriteCards, isLoading, isFavoritePending, toggleFavorite } = useCustomerFavorites();

  return (
    <PageShell
      eyebrow="Favorites"
      title="Your most-loved dining spots."
      description="Saved restaurants remain ready for repeat orders, quicker comparison, and one-tap reordering."
    >
      {isLoading ? (
        <SurfaceCard>
          <p className="text-sm text-ink-soft">Loading your saved restaurants...</p>
        </SurfaceCard>
      ) : favoriteCards.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {favoriteCards.map((restaurant) => (
            <RestaurantCard
              key={restaurant.slug}
              {...restaurant}
              isFavorite
              isFavoritePending={isFavoritePending(restaurant.id)}
              favoriteActionLabel="Remove"
              onFavoriteToggle={restaurant.id != null ? () => void toggleFavorite(restaurant) : undefined}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No favorites saved yet"
          description="Save a restaurant from the catalogue or its detail page to keep it ready for your next order."
        />
      )}
    </PageShell>
  );
};

type OfferFilter = "ALL" | "PLATFORM" | "RESTAURANT" | "LIMITED_TIME" | "ELIGIBLE";

const fallbackOfferTimestamp = "2026-05-31T00:00:00.000Z";

const fallbackOffers: CustomerOffer[] = [
  {
    id: -1,
    code: "LUXE250",
    title: "Midweek supper club",
    description: "Flat Rs. 250 off premium dinner tables and delivery orders above Rs. 1,299.",
    discountType: "FLAT",
    discountValue: 250,
    minOrderAmount: 1299,
    maxDiscount: null,
    scope: "PLATFORM",
    usageLimit: null,
    perUserLimit: 1,
    startDate: null,
    endDate: null,
    isActive: true,
    createdAt: fallbackOfferTimestamp,
    updatedAt: fallbackOfferTimestamp,
    restaurantLinks: [],
  },
  {
    id: -2,
    code: "SWEETONUS",
    title: "Pastry hour privilege",
    description: "Unlock a complimentary dessert add-on with every order above Rs. 799.",
    discountType: "FLAT",
    discountValue: 0,
    minOrderAmount: 799,
    maxDiscount: null,
    scope: "RESTAURANT",
    usageLimit: null,
    perUserLimit: 1,
    startDate: null,
    endDate: fallbackOfferTimestamp,
    isActive: true,
    createdAt: fallbackOfferTimestamp,
    updatedAt: fallbackOfferTimestamp,
    restaurantLinks: [],
  },
  {
    id: -3,
    code: "TASTING18",
    title: "Chef tasting weekend",
    description: "Save 18% on chef-curated menus from the city's most-loved restaurants.",
    discountType: "PERCENTAGE",
    discountValue: 18,
    minOrderAmount: 999,
    maxDiscount: 350,
    scope: "RESTAURANT",
    usageLimit: null,
    perUserLimit: 1,
    startDate: null,
    endDate: fallbackOfferTimestamp,
    isActive: true,
    createdAt: fallbackOfferTimestamp,
    updatedAt: fallbackOfferTimestamp,
    restaurantLinks: [],
  },
];

const offerFilterOptions: Array<{ value: OfferFilter; label: string }> = [
  { value: "ALL", label: "All offers" },
  { value: "PLATFORM", label: "Platform offers" },
  { value: "RESTAURANT", label: "Restaurant offers" },
  { value: "LIMITED_TIME", label: "Limited time" },
  { value: "ELIGIBLE", label: "Eligible now" },
];

const isLiveCustomerRole = (isAuthenticated: boolean, role?: string | null) =>
  isAuthenticated && role === "CUSTOMER";

const formatOfferDiscountLabel = (offer: CustomerOffer) =>
  offer.discountType === "PERCENTAGE" ? `${offer.discountValue}% off` : `${formatCurrency(offer.discountValue)} off`;

const formatOfferSavingsSummary = (offer: CustomerOffer) => {
  const cap = offer.maxDiscount ? ` up to ${formatCurrency(offer.maxDiscount)}` : "";
  const savings =
    offer.discountType === "PERCENTAGE"
      ? `${offer.discountValue}% savings${cap}`
      : `${formatCurrency(offer.discountValue)} instant savings`;

  return `${savings} once your cart subtotal reaches ${formatCurrency(offer.minOrderAmount)}.`;
};

const getOfferHighlight = (offer: CustomerOffer) => {
  if (offer.endDate) {
    return "Limited time";
  }

  if (offer.scope === "RESTAURANT") {
    return "Restaurant edit";
  }

  return offer.discountType === "PERCENTAGE" ? "Percent savings" : "Instant savings";
};

const getOfferScopeLabel = (offer: CustomerOffer) =>
  offer.scope === "RESTAURANT" ? "Restaurant specific" : "Platform wide";

const getOfferRestaurantSummary = (offer: CustomerOffer) => {
  if (offer.scope !== "RESTAURANT") {
    return "Available across currently active restaurants in the offer engine.";
  }

  if (offer.restaurantLinks.length) {
    return offer.restaurantLinks.map((link) => link.restaurant.name).join(", ");
  }

  return "Selected partner restaurants only.";
};

const getOfferValiditySummary = (offer: CustomerOffer) => {
  if (offer.endDate) {
    return `Valid until ${formatMembershipDate(offer.endDate)}`;
  }

  if (offer.startDate) {
    return `Active from ${formatMembershipDate(offer.startDate)}`;
  }

  return "No expiry window is stored for this offer.";
};

const getOfferEligibilityRules = (offer: CustomerOffer) => {
  const rules = [
    `Cart subtotal must be at least ${formatCurrency(offer.minOrderAmount)} before delivery fee and tax.`,
    offer.scope === "RESTAURANT"
      ? `Only applies to eligible restaurant carts. ${getOfferRestaurantSummary(offer)}`
      : "Works on platform-wide carts that meet the current subtotal requirement.",
    "No payment-mode restriction is stored for this offer in the current checkout engine.",
    "Only one offer can be attached to a cart at a time.",
  ];

  if (offer.perUserLimit) {
    rules.push(`Each diner can use this code up to ${offer.perUserLimit} time${offer.perUserLimit > 1 ? "s" : ""}.`);
  }

  if (offer.usageLimit) {
    rules.push(`This offer is capped at ${offer.usageLimit} total redemptions.`);
  }

  return rules;
};

const getOfferTerms = (offer: CustomerOffer) => {
  const terms = [
    `Coupon code: ${offer.code ?? "No code assigned"}`,
    `Discount type: ${formatOfferDiscountLabel(offer)}`,
    `Applicability: ${getOfferScopeLabel(offer)}`,
    getOfferValiditySummary(offer),
  ];

  if (offer.maxDiscount) {
    terms.push(`Maximum discount: ${formatCurrency(offer.maxDiscount)}`);
  }

  return terms;
};

const getOfferHowToUse = (offer: CustomerOffer) => [
  `Copy the code ${offer.code ?? "shown above"} from this offer.`,
  "Keep an eligible cart ready before heading to checkout.",
  "Use the offer on a matching cart once the minimum subtotal is met.",
];

const getOfferStatusTone = (isActive: boolean) => (isActive ? "success" as const : "warning" as const);

const getEligibleCartsForOffer = (offer: CustomerOffer, carts: CustomerCart[]) =>
  carts.filter((cart) => {
    const matchesScope =
      offer.scope !== "RESTAURANT" ||
      !offer.restaurantLinks.length ||
      offer.restaurantLinks.some((link) => link.restaurant.id === cart.restaurant.id);

    return matchesScope && cart.summary.subtotal >= offer.minOrderAmount;
  });

const matchesOfferFilter = (offer: CustomerOffer, filter: OfferFilter, carts: CustomerCart[]) => {
  switch (filter) {
    case "PLATFORM":
      return offer.scope !== "RESTAURANT";
    case "RESTAURANT":
      return offer.scope === "RESTAURANT";
    case "LIMITED_TIME":
      return Boolean(offer.endDate);
    case "ELIGIBLE":
      return getEligibleCartsForOffer(offer, carts).length > 0;
    case "ALL":
    default:
      return true;
  }
};

export const OffersPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [offers, setOffers] = useState<CustomerOffer[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(true);
  const [isUsingFallbackOffers, setIsUsingFallbackOffers] = useState(false);
  const [offerFilter, setOfferFilter] = useState<OfferFilter>("ALL");
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  const [carts, setCarts] = useState<CustomerCart[]>([]);
  const [isLoadingCarts, setIsLoadingCarts] = useState(false);
  const [isApplyingOffer, setIsApplyingOffer] = useState(false);
  const canApplyOffers = isLiveCustomerRole(isAuthenticated, user?.role);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingOffers(true);

    void getPublicOffers()
      .then((offerRows) => {
        if (!isMounted) {
          return;
        }

        if (offerRows.length) {
          setOffers(offerRows);
          setIsUsingFallbackOffers(false);
          return;
        }

        setOffers(fallbackOffers);
        setIsUsingFallbackOffers(true);
      })
      .catch(() => {
        if (isMounted) {
          setOffers(fallbackOffers);
          setIsUsingFallbackOffers(true);
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
  }, []);

  useEffect(() => {
    if (!canApplyOffers) {
      setCarts([]);
      setIsLoadingCarts(false);
      return;
    }

    let isMounted = true;
    setIsLoadingCarts(true);

    void getCustomerCarts()
      .then((cartRows) => {
        if (isMounted) {
          setCarts(cartRows);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCarts([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingCarts(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canApplyOffers]);

  const filteredOffers = useMemo(
    () => offers.filter((offer) => matchesOfferFilter(offer, offerFilter, carts)),
    [carts, offerFilter, offers],
  );

  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) ?? null;
  const eligibleCarts = selectedOffer ? getEligibleCartsForOffer(selectedOffer, carts) : [];
  const eligibleCart = eligibleCarts[0] ?? null;
  const appliedCart =
    selectedOffer && selectedOffer.code
      ? carts.find((cart) => cart.offer?.id === selectedOffer.id || cart.offer?.code === selectedOffer.code) ?? null
      : null;

  const handleCopyCode = async (offer: CustomerOffer) => {
    if (!offer.code) {
      toast.error("This offer does not have a coupon code yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(offer.code);
      toast.success(`Copied ${offer.code} to your clipboard.`);
    } catch {
      toast.error("Unable to copy this coupon code right now.");
    }
  };

  const handleApplyOffer = async (offer: CustomerOffer) => {
    if (!offer.code || !eligibleCart) {
      toast.error("Keep an eligible cart ready before applying this offer.");
      return;
    }

    setIsApplyingOffer(true);
    try {
      const updatedCart = await applyCustomerCartOffer(eligibleCart.id, offer.code);
      setCarts((currentCarts) => [updatedCart, ...currentCarts.filter((cart) => cart.id !== updatedCart.id)]);
      writePendingCustomerCouponSelection(user?.id, {
        code: offer.code,
        cartId: updatedCart.id,
      });
      toast.success(`Applied ${offer.code} to your ${updatedCart.restaurant.name} cart.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to apply this offer right now."));
    } finally {
      setIsApplyingOffer(false);
    }
  };

  const handleUseOffer = (offer: CustomerOffer) => {
    if (!offer.code) {
      toast.error("This offer does not have a coupon code yet.");
      return;
    }

    const nextCart = appliedCart ?? eligibleCart ?? null;
    writePendingCustomerCouponSelection(user?.id, {
      code: offer.code,
      cartId: nextCart?.id ?? null,
    });

    if (nextCart) {
      toast.success(`${offer.code} is ready on the payment page.`);
      navigate(`/payment?cartId=${nextCart.id}&coupon=${offer.code}`);
      return;
    }

    toast.success(`${offer.code} is saved for your next eligible payment.`);
    setSelectedOfferId(null);
  };

  const handleRemoveAppliedOffer = async (cart: CustomerCart) => {
    setIsApplyingOffer(true);
    try {
      const updatedCart = await removeCustomerCartOffer(cart.id);
      setCarts((currentCarts) => [updatedCart, ...currentCarts.filter((row) => row.id !== updatedCart.id)]);

      if (selectedOffer?.code) {
        const pendingSelection = readPendingCustomerCouponSelection(user?.id);
        if (pendingSelection?.code?.trim().toUpperCase() === selectedOffer.code.trim().toUpperCase()) {
          clearPendingCustomerCouponSelection(user?.id);
        }
      }

      toast.success(`Removed ${cart.offer?.code ?? "the applied coupon"} from your ${cart.restaurant.name} cart.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to remove this offer right now."));
    } finally {
      setIsApplyingOffer(false);
    }
  };

  return (
    <>
      <PageShell
        eyebrow="Offers"
        title="Curated savings that still feel premium."
        description="Offer cards follow the existing warm neutrals and rounded surfaces while giving the app a fuller promotions destination."
      >
        <SurfaceCard>
          <div className="flex flex-wrap gap-3">
            {offerFilterOptions.map((filterOption) => (
              <Chip
                key={filterOption.value}
                active={offerFilter === filterOption.value}
                onClick={() => setOfferFilter(filterOption.value)}
              >
                {filterOption.label}
              </Chip>
            ))}
          </div>
        </SurfaceCard>

        {isLoadingOffers ? (
          <SurfaceCard>
            <p className="text-sm leading-7 text-ink-soft">Loading curated offers.</p>
          </SurfaceCard>
        ) : filteredOffers.length ? (
          <div className="grid gap-5 lg:grid-cols-3">
            {filteredOffers.map((offer) => (
              <OfferCard
                key={offer.id}
                title={offer.title}
                description={offer.description ?? formatOfferSavingsSummary(offer)}
                code={offer.code ?? "UNLOCK"}
                highlight={getOfferHighlight(offer)}
                onUnlock={() => setSelectedOfferId(offer.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No offers matched that filter"
            description="Try a broader offer filter or come back once a matching cart is ready."
          />
        )}
      </PageShell>

      <Modal
        open={Boolean(selectedOffer)}
        onClose={() => {
          if (!isApplyingOffer) {
            setSelectedOfferId(null);
          }
        }}
        title={selectedOffer ? selectedOffer.title : "Offer details"}
        className="max-w-4xl"
      >
        {selectedOffer ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill label={getOfferHighlight(selectedOffer)} tone="info" />
              <StatusPill label={selectedOffer.isActive ? "Active" : "Inactive"} tone={getOfferStatusTone(selectedOffer.isActive)} />
              <StatusPill label={getOfferScopeLabel(selectedOffer)} tone="info" />
              {appliedCart ? <StatusPill label="Applied" tone="success" /> : null}
              {!appliedCart && eligibleCart ? <StatusPill label="Eligible" tone="success" /> : null}
            </div>

            <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-5 py-5 text-sm leading-7 text-ink-soft">
              {selectedOffer.description ?? formatOfferSavingsSummary(selectedOffer)}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] bg-cream px-5 py-5">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Coupon code</p>
                <p className="mt-3 font-semibold text-accent">{selectedOffer.code ?? "No code assigned"}</p>
                <p className="mt-2 text-sm text-ink-soft">{formatOfferSavingsSummary(selectedOffer)}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-5 py-5">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Payment condition</p>
                <p className="mt-3 font-semibold text-ink">Any supported payment mode</p>
                <p className="mt-2 text-sm text-ink-soft">
                  No card, UPI, or wallet restriction is modeled for this offer in the current checkout engine.
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-[1.5rem] bg-cream px-5 py-5 text-sm text-ink-soft">
              <div className="flex items-center justify-between gap-4">
                <span>Discount type</span>
                <span className="font-semibold text-right text-ink">{formatOfferDiscountLabel(selectedOffer)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Minimum order</span>
                <span className="font-semibold text-right text-ink">{formatCurrency(selectedOffer.minOrderAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Maximum discount</span>
                <span className="font-semibold text-right text-ink">
                  {selectedOffer.maxDiscount ? formatCurrency(selectedOffer.maxDiscount) : "No cap"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Validity</span>
                <span className="font-semibold text-right text-ink">{getOfferValiditySummary(selectedOffer)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Restaurant applicability</span>
                <span className="font-semibold text-right text-ink">{getOfferRestaurantSummary(selectedOffer)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Category applicability</span>
                <span className="font-semibold text-right text-ink">No category-specific rule stored</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Membership requirement</span>
                <span className="font-semibold text-right text-ink">No member-only rule stored</span>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-3 rounded-[1.5rem] bg-cream px-5 py-5">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Offer benefits</p>
                <div className="space-y-3">
                  <div className="rounded-[1.5rem] bg-white px-4 py-4 text-sm leading-7 text-ink-soft">
                    {formatOfferSavingsSummary(selectedOffer)}
                  </div>
                  <div className="rounded-[1.5rem] bg-white px-4 py-4 text-sm leading-7 text-ink-soft">
                    {selectedOffer.scope === "RESTAURANT"
                      ? "Useful when you already have a cart from one of the linked restaurants."
                      : "Works cleanly with any eligible live cart in the current customer flow."}
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-[1.5rem] bg-cream px-5 py-5">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Eligibility rules</p>
                {getOfferEligibilityRules(selectedOffer).map((rule) => (
                  <div key={rule} className="rounded-[1.5rem] bg-white px-4 py-4 text-sm leading-7 text-ink-soft">
                    {rule}
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-[1.5rem] bg-cream px-5 py-5">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">How to use</p>
                {getOfferHowToUse(selectedOffer).map((step) => (
                  <div key={step} className="rounded-[1.5rem] bg-white px-4 py-4 text-sm leading-7 text-ink-soft">
                    {step}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-[1.5rem] border border-accent/10 bg-white px-5 py-5 text-sm text-ink-soft shadow-soft">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Terms and conditions</p>
              {getOfferTerms(selectedOffer).map((term) => (
                <p key={term}>{term}</p>
              ))}
              {canApplyOffers ? (
                <p>
                  {appliedCart
                    ? `Already attached to your ${appliedCart.restaurant.name} cart.`
                    : eligibleCart
                      ? `Ready to apply on your ${eligibleCart.restaurant.name} cart.`
                      : isLoadingCarts
                        ? "Checking your carts for eligibility."
                        : "No eligible cart is ready yet for this offer."}
                </p>
              ) : null}
              {isUsingFallbackOffers ? (
                <p>These offer details are currently using the existing fallback showcase because live offer data was not available.</p>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setSelectedOfferId(null)} disabled={isApplyingOffer}>
                Close
              </Button>
              {selectedOffer.code ? (
                <Button type="button" variant="secondary" onClick={() => void handleCopyCode(selectedOffer)} disabled={isApplyingOffer}>
                  Copy coupon
                </Button>
              ) : null}
              {canApplyOffers && selectedOffer.code ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleUseOffer(selectedOffer)}
                  disabled={isApplyingOffer || isUsingFallbackOffers}
                >
                  {appliedCart ? "Use in payment" : eligibleCart ? "Use coupon" : "Save for later"}
                </Button>
              ) : null}
              {appliedCart && !isUsingFallbackOffers ? (
                <Button
                  type="button"
                  onClick={() => void handleRemoveAppliedOffer(appliedCart)}
                  disabled={isApplyingOffer}
                >
                  {isApplyingOffer ? "Removing..." : "Remove coupon"}
                </Button>
              ) : canApplyOffers && selectedOffer.code && !isUsingFallbackOffers ? (
                <Button
                  type="button"
                  onClick={() => void handleApplyOffer(selectedOffer)}
                  disabled={isApplyingOffer || !eligibleCart}
                >
                  {isApplyingOffer ? "Applying..." : eligibleCart ? "Apply to cart" : "Add eligible cart first"}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
};

export const MembershipPage = () => {
  const { accessToken, setSession, user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<CustomerPaymentMethod[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<MembershipPaymentMode>("CARD");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<number | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [isSavingPaymentDetails, setIsSavingPaymentDetails] = useState(false);
  const currentTier = user?.membershipTier ?? "CLASSIC";
  const currentStatus = getEffectiveMembershipStatus(
    currentTier,
    user?.membershipStatus,
    user?.membershipExpiresAt,
  );
  const currentPlanRank = getMembershipTierRank(currentTier);
  const currentPlan = membershipPlans.find((plan) => plan.tier === currentTier) ?? membershipPlans[0];
  const recommendedPlan = membershipPlans.find((plan) => getMembershipTierRank(plan.tier) > currentPlanRank) ?? null;
  const selectedPlanBlockReason = selectedPlan
    ? getMembershipUpgradeBlockReason({
        currentTier,
        targetTier: selectedPlan.tier,
      })
    : null;
  const isSelectedPlanPaid = selectedPlan ? isPaidMembershipTier(selectedPlan.tier) : false;
  const cardPaymentMethods = useMemo(
    () => savedPaymentMethods.filter((paymentMethod) => paymentMethod.type === "CARD"),
    [savedPaymentMethods],
  );
  const upiPaymentMethods = useMemo(
    () => savedPaymentMethods.filter((paymentMethod) => paymentMethod.type === "UPI"),
    [savedPaymentMethods],
  );
  const paymentMethodsForSelectedMode = selectedPaymentMode === "CARD" ? cardPaymentMethods : upiPaymentMethods;
  const selectedPaymentMethod =
    paymentMethodsForSelectedMode.find((paymentMethod) => paymentMethod.id === selectedPaymentMethodId) ??
    getPreferredPaymentMethod(savedPaymentMethods, selectedPaymentMode);
  const selectedCardDetails = toMembershipCardDetails(
    cardPaymentMethods.find((paymentMethod) => paymentMethod.id === selectedPaymentMethodId) ??
      getPreferredPaymentMethod(savedPaymentMethods, "CARD"),
  );
  const selectedUpiDetails = toMembershipUpiDetails(
    upiPaymentMethods.find((paymentMethod) => paymentMethod.id === selectedPaymentMethodId) ??
      getPreferredPaymentMethod(savedPaymentMethods, "UPI"),
  );
  const paymentDetailSummary = isSelectedPlanPaid
    ? getMembershipPaymentDetailSummary(selectedPaymentMode, selectedPaymentMethod)
    : "No payment needed";

  const loadPaymentMethods = async ({ quietly = false }: { quietly?: boolean } = {}) => {
    if (!quietly) {
      setIsLoadingPaymentMethods(true);
    }

    setPaymentMethodsError(null);

    try {
      const paymentMethods = await getCustomerPaymentMethods();
      setSavedPaymentMethods(paymentMethods);
      return paymentMethods;
    } catch (error) {
      setSavedPaymentMethods([]);
      setPaymentMethodsError(getApiErrorMessage(error, "Unable to load your saved payment methods right now."));
      return [];
    } finally {
      if (!quietly) {
        setIsLoadingPaymentMethods(false);
      }
    }
  };

  useEffect(() => {
    void loadPaymentMethods();
  }, []);

  useEffect(() => {
    if (!selectedPlan || !isPaidMembershipTier(selectedPlan.tier)) {
      return;
    }

    setSelectedPaymentMode((currentMode) => {
      if (currentMode === "CARD" && cardPaymentMethods.length) {
        return currentMode;
      }

      if (currentMode === "UPI" && upiPaymentMethods.length) {
        return currentMode;
      }

      return cardPaymentMethods.length ? "CARD" : "UPI";
    });
  }, [cardPaymentMethods.length, selectedPlan, upiPaymentMethods.length]);

  useEffect(() => {
    if (!selectedPlan || !isPaidMembershipTier(selectedPlan.tier)) {
      return;
    }

    setSelectedPaymentMethodId((currentSelectedId) => {
      if (
        currentSelectedId &&
        savedPaymentMethods.some(
          (paymentMethod) => paymentMethod.id === currentSelectedId && paymentMethod.type === selectedPaymentMode,
        )
      ) {
        return currentSelectedId;
      }

      return getPreferredPaymentMethodId(savedPaymentMethods, selectedPaymentMode);
    });
  }, [savedPaymentMethods, selectedPaymentMode, selectedPlan]);

  const handleSaveCardDetails = async (values: MembershipCardDetailsFormValues) => {
    setIsSavingPaymentDetails(true);

    try {
      const currentCardMethod =
        cardPaymentMethods.find((paymentMethod) => paymentMethod.id === selectedPaymentMethodId) ??
        getPreferredPaymentMethod(savedPaymentMethods, "CARD");

      const paymentMethod = currentCardMethod
        ? await updateCustomerPaymentMethod(currentCardMethod.id, {
            type: "CARD",
            label: values.label,
            holderName: values.holderName,
            maskedEnding: values.last4,
            expiryMonth: values.expiryMonth,
            expiryYear: values.expiryYear,
            isPrimary: values.isPrimary,
          })
        : await createCustomerPaymentMethod({
            type: "CARD",
            label: values.label,
            holderName: values.holderName,
            maskedEnding: values.last4,
            expiryMonth: values.expiryMonth,
            expiryYear: values.expiryYear,
            isPrimary: values.isPrimary,
          });

      await loadPaymentMethods({ quietly: true });
      setSelectedPaymentMode("CARD");
      setSelectedPaymentMethodId(paymentMethod.id);
      setIsCardModalOpen(false);
      toast.success("Card summary saved.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save the card summary right now."));
    } finally {
      setIsSavingPaymentDetails(false);
    }
  };

  const handleSaveUpiDetails = async (values: MembershipUpiDetailsFormValues) => {
    setIsSavingPaymentDetails(true);

    try {
      const currentUpiMethod =
        upiPaymentMethods.find((paymentMethod) => paymentMethod.id === selectedPaymentMethodId) ??
        getPreferredPaymentMethod(savedPaymentMethods, "UPI");

      const paymentMethod = currentUpiMethod
        ? await updateCustomerPaymentMethod(currentUpiMethod.id, {
            type: "UPI",
            upiId: values.upiId,
            label: values.appLabel || undefined,
            isPrimary: true,
          })
        : await createCustomerPaymentMethod({
            type: "UPI",
            upiId: values.upiId,
            label: values.appLabel || undefined,
            isPrimary: true,
          });

      await loadPaymentMethods({ quietly: true });
      setSelectedPaymentMode("UPI");
      setSelectedPaymentMethodId(paymentMethod.id);
      setIsUpiModalOpen(false);
      toast.success("UPI ID saved.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save the UPI ID right now."));
    } finally {
      setIsSavingPaymentDetails(false);
    }
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedPlan) {
      return;
    }

    if (selectedPlanBlockReason) {
      toast.error(selectedPlanBlockReason.detail);
      return;
    }

    if (isPaidMembershipTier(selectedPlan.tier) && !selectedPaymentMethod) {
      toast.error(
        selectedPaymentMode === "CARD"
          ? "Add a saved card before upgrading this plan."
          : "Add a saved UPI ID before upgrading this plan.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const nextUser = await updateCustomerMembership({
        tier: selectedPlan.tier,
        ...(isPaidMembershipTier(selectedPlan.tier)
          ? {
              paymentMode: selectedPaymentMode,
              paymentMethodId: selectedPaymentMethod!.id,
            }
          : {}),
      });

      if (accessToken) {
        setSession({ user: nextUser, accessToken });
      }

      toast.success(`${getMembershipTierLabel(selectedPlan.tier)} is now active.`);
      setSelectedPlan(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update your membership right now."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageShell
        eyebrow="Membership"
        title="Luxe Circle membership, designed for regular indulgence."
        description="Benefit-rich but visually quiet, this page expands the membership nav route that previously looped back to the homepage."
        actions={
          <Button
            type="button"
            onClick={() => {
              if (recommendedPlan) {
                setSelectedPlan(recommendedPlan);
              }
            }}
            disabled={!recommendedPlan || isSubmitting}
          >
            {recommendedPlan ? "Upgrade membership" : "Highest plan active"}
          </Button>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <SurfaceCard className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Current tier</p>
                <h2 className="mt-2 font-display text-5xl font-semibold text-ink">
                  {getMembershipTierLabel(currentTier)}
                </h2>
              </div>
              <StatusPill
                label={getMembershipStatusLabel(currentStatus)}
                tone={getMembershipStatusTone(currentStatus)}
              />
            </div>
            <p className="text-sm leading-7 text-ink-soft">{currentPlan.summary}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] bg-cream px-5 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Plan status</p>
                <p className="mt-2 text-sm text-ink-soft">{getMembershipStatusLabel(currentStatus)}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-5 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Valid until</p>
                <p className="mt-2 text-sm text-ink-soft">{formatMembershipDate(user?.membershipExpiresAt)}</p>
              </div>
            </div>
          </SurfaceCard>
          <div className="grid gap-4">
            {currentPlan.benefits.map((benefit) => (
              <SurfaceCard key={benefit}>
                <p className="text-sm leading-7 text-ink-soft">{benefit}</p>
              </SurfaceCard>
            ))}
          </div>
        </div>

        <SectionHeading
          eyebrow="Plan comparison"
          title="Choose the plan that fits your ordering rhythm."
          description="Current plan status, pricing rhythm, and core perks stay visible without leaving the existing membership route."
        />

        <div className="grid gap-5 lg:grid-cols-3">
          {membershipPlans.map((plan) => {
            const isCurrentPlan = plan.tier === currentTier;
            const planBlockReason = getMembershipUpgradeBlockReason({
              currentTier,
              targetTier: plan.tier,
            });

            return (
              <SurfaceCard key={plan.tier} className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">{plan.cadence}</p>
                    <h3 className="mt-2 font-display text-4xl font-semibold text-ink">
                      {getMembershipTierLabel(plan.tier)}
                    </h3>
                  </div>
                  {isCurrentPlan ? <StatusPill label="Current plan" tone="info" /> : null}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{plan.priceLabel}</p>
                  <p className="mt-2 text-sm leading-7 text-ink-soft">{plan.summary}</p>
                </div>
                <div className="space-y-3">
                  {plan.benefits.map((benefit) => (
                    <div key={benefit} className="rounded-[1.5rem] bg-cream px-4 py-4 text-sm leading-7 text-ink-soft">
                      {benefit}
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant={isCurrentPlan ? "secondary" : "primary"}
                  disabled={isCurrentPlan || isSubmitting || Boolean(planBlockReason)}
                  onClick={() => {
                    if (!planBlockReason) {
                      setSelectedPlan(plan);
                    }
                  }}
                >
                  {isCurrentPlan
                    ? "Current membership"
                    : planBlockReason
                      ? planBlockReason.buttonLabel
                      : "Upgrade to this plan"}
                </Button>
                {planBlockReason ? (
                  <p className="text-sm leading-7 text-ink-soft">{planBlockReason.detail}</p>
                ) : null}
              </SurfaceCard>
            );
          })}
        </div>
      </PageShell>

      <Modal
        open={Boolean(selectedPlan)}
        onClose={() => {
          if (!isSubmitting) {
            setSelectedPlan(null);
          }
        }}
        title={
          selectedPlan
            ? `${selectedPlan.tier === "CLASSIC" ? "Switch to" : "Upgrade to"} ${getMembershipTierLabel(selectedPlan.tier)}`
            : "Upgrade membership"
        }
      >
        {selectedPlan ? (
          <div className="space-y-5">
            <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4 text-sm leading-7 text-ink-soft">
              {selectedPlanBlockReason
                ? selectedPlanBlockReason.detail
                : isSelectedPlanPaid
                ? "Confirm this paid plan change with a saved card or UPI method to activate the selected membership tier immediately."
                : "Confirm this plan change to switch your account back to the base membership tier without any payment details."}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] bg-cream px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Current plan</p>
                  <StatusPill label="Current" tone="info" />
                </div>
                <p className="mt-3 font-semibold text-ink">{getMembershipTierLabel(currentTier)}</p>
                <p className="mt-2 text-sm leading-7 text-ink-soft">{currentPlan.summary}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Upgrading to</p>
                  <StatusPill label={isSelectedPlanPaid ? "Paid plan" : "Base plan"} tone="info" />
                </div>
                <p className="mt-3 font-semibold text-ink">{getMembershipTierLabel(selectedPlan.tier)}</p>
                <p className="mt-2 text-sm leading-7 text-ink-soft">{selectedPlan.summary}</p>
              </div>
            </div>
            <div className="space-y-3 rounded-[1.5rem] bg-cream px-5 py-5 text-sm text-ink-soft">
              <div className="flex items-center justify-between">
                <span>Price</span>
                <span className="font-semibold text-ink">{selectedPlan.priceLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Billing</span>
                <span className="font-semibold text-ink">{selectedPlan.cadence}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Renewal status</span>
                <span className="font-semibold text-ink">
                  {selectedPlan.tier === "CLASSIC" ? "No renewal charge" : `Renews after ${selectedPlan.cadence}`}
                </span>
              </div>
            </div>
            <div className="grid gap-3">
              {selectedPlan.benefits.map((benefit) => (
                <div key={benefit} className="rounded-[1.5rem] bg-cream px-4 py-4 text-sm leading-7 text-ink-soft">
                  {benefit}
                </div>
              ))}
            </div>
            {isSelectedPlanPaid && !selectedPlanBlockReason ? (
              <div className="space-y-4 rounded-[1.5rem] bg-cream px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Payment mode</p>
                    <p className="mt-2 text-sm text-ink-soft">
                      Choose a payment mode, then select or save the matching payment details for this upgrade.
                    </p>
                  </div>
                  <Tabs items={[...membershipPaymentModeItems]} value={selectedPaymentMode} onChange={(value) => setSelectedPaymentMode(value as MembershipPaymentMode)} />
                </div>

                {isLoadingPaymentMethods ? (
                  <div className="rounded-[1.5rem] bg-white px-4 py-4 text-sm text-ink-soft">
                    Loading your saved payment methods.
                  </div>
                ) : paymentMethodsError ? (
                  <div className="rounded-[1.5rem] border border-accent/10 bg-white px-4 py-4 text-sm leading-7 text-ink-soft">
                    {paymentMethodsError}
                  </div>
                ) : paymentMethodsForSelectedMode.length ? (
                  <div className="space-y-3">
                    <div className="grid gap-3">
                      {paymentMethodsForSelectedMode.map((paymentMethod) => {
                      const isSelected = selectedPaymentMethodId === paymentMethod.id;

                      return (
                        <button
                          key={paymentMethod.id}
                          type="button"
                          onClick={() => setSelectedPaymentMethodId(paymentMethod.id)}
                          className={`flex w-full items-start justify-between gap-4 rounded-[1.5rem] border px-4 py-4 text-left transition ${
                            isSelected
                              ? "border-accent/20 bg-white shadow-soft"
                              : "border-accent/10 bg-white"
                          }`}
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <p className="font-semibold text-ink">{getPaymentMethodTitle(paymentMethod)}</p>
                              {paymentMethod.isPrimary ? <StatusPill label="Primary" tone="info" /> : null}
                            </div>
                            <p className="mt-1 text-sm text-ink-soft">{getPaymentMethodSubtitle(paymentMethod)}</p>
                          </div>
                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-muted">
                            {isSelected ? "Selected" : "Select"}
                          </span>
                        </button>
                      );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-accent/10 bg-white px-4 py-4">
                      <div>
                        <p className="font-semibold text-ink">
                          {selectedPaymentMode === "CARD" ? "Saved card summary" : "Saved UPI ID"}
                        </p>
                        <p className="mt-2 text-sm text-ink-soft">
                          {getMembershipPaymentDetailSummary(selectedPaymentMode, selectedPaymentMethod)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Link
                          to="/wallet"
                          className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-4 py-2 text-xs font-semibold text-ink shadow-soft"
                        >
                          Manage methods
                        </Link>
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-4 py-2 text-xs"
                          onClick={() => {
                            if (selectedPaymentMode === "CARD") {
                              setIsCardModalOpen(true);
                            } else {
                              setIsUpiModalOpen(true);
                            }
                          }}
                        >
                          {selectedPaymentMode === "CARD"
                            ? selectedCardDetails
                              ? "Update card"
                              : "Add card"
                            : selectedUpiDetails
                              ? "Update UPI ID"
                              : "Add UPI ID"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-accent/10 bg-white px-4 py-4">
                    <div>
                      <p className="font-semibold text-ink">
                        {selectedPaymentMode === "CARD" ? "No saved card summary" : "No saved UPI ID"}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-ink-soft">
                        {selectedPaymentMode === "CARD"
                          ? "Add a masked card summary to continue with this paid membership."
                          : "Add a valid UPI ID to continue with this paid membership."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        to="/wallet"
                        className="inline-flex items-center justify-center rounded-full border border-accent/15 bg-white px-4 py-2 text-xs font-semibold text-ink shadow-soft"
                      >
                        Manage methods
                      </Link>
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-4 py-2 text-xs"
                        onClick={() => {
                          if (selectedPaymentMode === "CARD") {
                            setIsCardModalOpen(true);
                          } else {
                            setIsUpiModalOpen(true);
                          }
                        }}
                      >
                        {selectedPaymentMode === "CARD" ? "Add card" : "Add UPI ID"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            <div className="space-y-3 rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-5 py-5 text-sm text-ink-soft">
              <div className="flex items-center justify-between gap-4">
                <span>Current plan</span>
                <span className="font-semibold text-right text-ink">{getMembershipTierLabel(currentTier)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Upgrading to</span>
                <span className="font-semibold text-right text-ink">{getMembershipTierLabel(selectedPlan.tier)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Price</span>
                <span className="font-semibold text-right text-ink">{selectedPlan.priceLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Payment mode</span>
                <span className="font-semibold text-right text-ink">
                  {isSelectedPlanPaid ? getMembershipPaymentModeLabel(selectedPaymentMode) : "Not required"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Payment details</span>
                <span className="font-semibold text-right text-ink">{paymentDetailSummary}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Amount to pay</span>
                <span className="font-semibold text-right text-ink">{selectedPlan.priceLabel}</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setSelectedPlan(null)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleConfirmUpgrade()}
                disabled={
                  isSubmitting ||
                  Boolean(selectedPlanBlockReason) ||
                  isSavingPaymentDetails ||
                  (isSelectedPlanPaid &&
                    (isLoadingPaymentMethods || !selectedPaymentMethod || Boolean(paymentMethodsError)))
                }
              >
                {isSubmitting
                  ? "Updating..."
                  : isSelectedPlanPaid
                    ? "Confirm upgrade"
                    : "Confirm change"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <MembershipCardDetailsModal
        open={isCardModalOpen}
        details={selectedCardDetails}
        defaultHolderName={user?.fullName}
        isSubmitting={isSavingPaymentDetails}
        onClose={() => {
          if (!isSavingPaymentDetails) {
            setIsCardModalOpen(false);
          }
        }}
        onSubmit={handleSaveCardDetails}
      />

      <MembershipUpiDetailsModal
        open={isUpiModalOpen}
        details={selectedUpiDetails}
        isSubmitting={isSavingPaymentDetails}
        onClose={() => {
          if (!isSavingPaymentDetails) {
            setIsUpiModalOpen(false);
          }
        }}
        onSubmit={handleSaveUpiDetails}
      />
    </>
  );
};
