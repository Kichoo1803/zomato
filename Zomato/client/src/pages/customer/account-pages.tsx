import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, Edit3, MapPin, Sparkles, Wallet } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDangerModal } from "@/components/admin/admin-ui";
import { NotificationFeed } from "@/components/notifications/notification-feed";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageShell, SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationInbox } from "@/hooks/use-notification-inbox";
import { getApiErrorMessage, logoutFromServer } from "@/lib/auth";
import {
  createCustomerAddress,
  createCustomerPaymentMethod,
  getCustomerAddresses,
  getCustomerPaymentMethods,
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
  contactPhone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{9,14}$/, "Enter a valid contact phone."),
  houseNo: z.string().trim().max(80).optional().or(z.literal("")),
  street: z.string().trim().min(2, "Street or area is required.").max(150),
  landmark: z.string().trim().max(150).optional().or(z.literal("")),
  area: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required.").max(120),
  state: z.string().trim().min(2, "State is required.").max(120),
  pincode: z.string().trim().min(4, "Pincode is required.").max(20),
  isDefault: z.boolean().default(false),
});

const profileFormSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(120),
  email: z.string().trim().email("Enter a valid email."),
  phone: z.string().trim().regex(/^\+?[1-9]\d{9,14}$/, "Enter a valid phone number.").or(z.literal("")),
  profileImage: z.string().trim().url("Enter a valid image URL.").or(z.literal("")),
});

const paymentMethodFormSchema = z
  .object({
    type: z.enum(["CARD", "UPI"]),
    label: z.string().trim().max(40).optional().or(z.literal("")),
    holderName: z.string().trim().max(80).optional().or(z.literal("")),
    maskedEnding: z.string().trim().regex(/^\d{4}$/, "Enter the last 4 digits only.").or(z.literal("")),
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
  phone: normalizeOptional(user?.phone),
  profileImage: normalizeOptional(user?.profileImage),
});

const mapPaymentMethodToFormValues = (
  paymentMethod: CustomerPaymentMethod | null,
  defaultHolderName?: string | null,
): PaymentMethodFormValues => ({
  type: paymentMethod?.type ?? "CARD",
  label: normalizeOptional(paymentMethod?.label),
  holderName: paymentMethod?.type === "CARD" ? normalizeOptional(paymentMethod.holderName) : normalizeOptional(defaultHolderName),
  maskedEnding: normalizeOptional(paymentMethod?.maskedEnding),
  expiryMonth: normalizeOptional(paymentMethod?.expiryMonth),
  expiryYear: normalizeOptional(paymentMethod?.expiryYear),
  upiId: normalizeOptional(paymentMethod?.upiId),
  isPrimary: paymentMethod?.isPrimary ?? true,
});

const mapAddressToFormValues = (
  address: CustomerAddress | null,
  defaults?: {
    recipientName?: string | null;
    contactPhone?: string | null;
  },
): AddressFormValues => ({
  addressType: (address?.addressType as AddressFormValues["addressType"] | undefined) ?? "HOME",
  title: normalizeOptional(address?.title),
  recipientName: normalizeOptional(address?.recipientName) || normalizeOptional(defaults?.recipientName),
  contactPhone: normalizeOptional(address?.contactPhone) || normalizeOptional(defaults?.contactPhone),
  houseNo: normalizeOptional(address?.houseNo),
  street: normalizeOptional(address?.street),
  landmark: normalizeOptional(address?.landmark),
  area: normalizeOptional(address?.area),
  city: normalizeOptional(address?.city),
  state: normalizeOptional(address?.state),
  pincode: normalizeOptional(address?.pincode),
  isDefault: address?.isDefault ?? false,
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
    isDefault: values.isDefault,
  };
};

const getAddressHeading = (address: CustomerAddress) =>
  address.title?.trim() || toAddressLabel(address.addressType);

const getAddressSubtitle = (address: CustomerAddress) => {
  if (address.isDefault) {
    return "Default delivery address";
  }

  const identity = [address.recipientName, address.contactPhone].filter(Boolean).join(" • ");
  return identity || "Saved delivery address";
};

const getAddressLines = (address: CustomerAddress) => ({
  line1: [address.houseNo, address.street].filter(Boolean).join(", ") || address.street || address.city,
  line2: [address.landmark, address.area, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(", "),
});

const AddressFormModal = ({
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
  onSubmit: (values: AddressFormValues) => Promise<void>;
}) => {
  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: mapAddressToFormValues(address, {
      recipientName: defaultRecipientName,
      contactPhone: defaultPhone,
    }),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(
      mapAddressToFormValues(address, {
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
          <Input
            label="Contact phone"
            type="tel"
            placeholder="+919830000301"
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
          <Input label="Phone" type="tel" error={form.formState.errors.phone?.message} {...form.register("phone")} />
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

    return details.join(" • ") || "Masked card summary";
  }

  return paymentMethod.isPrimary ? "Primary UPI method" : "Ready for quick checkout";
};

const PaymentMethodFormModal = ({
  open,
  paymentMethod,
  defaultHolderName,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  paymentMethod: CustomerPaymentMethod | null;
  defaultHolderName?: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: PaymentMethodFormValues) => Promise<void>;
}) => {
  const form = useForm<PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodFormSchema),
    defaultValues: mapPaymentMethodToFormValues(paymentMethod, defaultHolderName),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(mapPaymentMethodToFormValues(paymentMethod, defaultHolderName));
  }, [defaultHolderName, form, open, paymentMethod]);

  const selectedType = form.watch("type");

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      ...values,
      label: values.label?.trim() ?? "",
      holderName: values.holderName?.trim() ?? "",
      maskedEnding: values.maskedEnding?.trim() ?? "",
      expiryMonth: values.expiryMonth?.trim() ?? "",
      expiryYear: values.expiryYear?.trim() ?? "",
      upiId: values.upiId?.trim() ?? "",
    });
  });

  return (
    <Modal open={open} onClose={onClose} title={paymentMethod ? "Edit payment method" : "Add payment method"} className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Select
          label="Payment type"
          error={form.formState.errors.type?.message}
          disabled={Boolean(paymentMethod)}
          {...form.register("type")}
        >
          {PAYMENT_METHOD_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {selectedType === "CARD" ? (
          <>
            <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4 text-sm leading-7 text-ink-soft">
              Only a masked card summary is saved here. Full card numbers and CVV are never stored.
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
          <span className="text-sm font-semibold text-ink">Mark as primary {selectedType === "CARD" ? "method" : "UPI ID"}</span>
          <input type="checkbox" className="h-4 w-4 accent-[rgb(139,30,36)]" {...form.register("isPrimary")} />
        </label>

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : paymentMethod ? "Save changes" : "Add payment method"}
          </Button>
        </div>
      </form>
    </Modal>
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
                <p className="mt-2 text-sm text-ink-soft">{user?.phone ?? "+91 90000 00000"}</p>
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
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<CustomerAddress | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [defaultingAddressId, setDefaultingAddressId] = useState<number | null>(null);

  const loadAddresses = async ({ quietly = false }: { quietly?: boolean } = {}) => {
    if (!quietly) {
      setIsLoading(true);
    }

    try {
      const nextAddresses = await getCustomerAddresses();
      setAddresses(nextAddresses);
    } catch (error) {
      setAddresses([]);
      toast.error(getApiErrorMessage(error, "Unable to load saved addresses right now."));
    } finally {
      if (!quietly) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadAddresses();
  }, []);

  const handleCloseModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setSelectedAddress(null);
  };

  const handleCreateAddress = () => {
    setSelectedAddress(null);
    setIsModalOpen(true);
  };

  const handleEditAddress = (address: CustomerAddress) => {
    setSelectedAddress(address);
    setIsModalOpen(true);
  };

  const handleSubmitAddress = async (values: AddressFormValues) => {
    setIsSubmitting(true);

    try {
      const payload = toAddressPayload(values);

      if (selectedAddress) {
        await updateCustomerAddress(selectedAddress.id, payload);
        toast.success("Address updated successfully.");
      } else {
        await createCustomerAddress(payload);
        toast.success("Address added successfully.");
      }

      await loadAddresses({ quietly: true });
      setIsModalOpen(false);
      setSelectedAddress(null);
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
      await updateCustomerAddress(address.id, { isDefault: true });
      await loadAddresses({ quietly: true });
      toast.success("Default address updated.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update the default address right now."));
    } finally {
      setDefaultingAddressId(null);
    }
  };

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
                    {address.isDefault ? <StatusPill label="Default" tone="info" /> : null}
                  </div>

                  <div className="rounded-[1.5rem] bg-cream px-5 py-4 text-sm leading-7 text-ink-soft">
                    <p>{addressLines.line1}</p>
                    <p>{addressLines.line2}</p>
                    {address.contactPhone ? <p>{address.contactPhone}</p> : null}
                  </div>

                  <div className="flex flex-wrap gap-3">
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
        isSubmitting={isSubmitting}
        onClose={handleCloseModal}
        onSubmit={handleSubmitAddress}
      />
    </>
  );
};

export const WalletPage = () => {
  const { user } = useAuth();
  const rows = walletTransactions.map(([date, note, amount]) => [date, note, amount]);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<CustomerPaymentMethod[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<CustomerPaymentMethod | null>(null);
  const [isSubmittingPaymentMethod, setIsSubmittingPaymentMethod] = useState(false);

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

  const handleCreatePaymentMethod = () => {
    setSelectedPaymentMethod(null);
    setIsPaymentMethodModalOpen(true);
  };

  const handleEditPaymentMethod = (paymentMethod: CustomerPaymentMethod) => {
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
      const payload: CustomerPaymentMethodPayload =
        values.type === "CARD"
          ? {
              type: "CARD",
              label: values.label?.trim() ?? "",
              holderName: values.holderName?.trim() ?? "",
              maskedEnding: values.maskedEnding.trim(),
              expiryMonth: values.expiryMonth.trim(),
              expiryYear: values.expiryYear.trim(),
              isPrimary: values.isPrimary,
            }
          : {
              type: "UPI",
              label: values.label?.trim() || undefined,
              upiId: values.upiId.trim(),
              isPrimary: values.isPrimary,
            };

      if (selectedPaymentMethod) {
        await updateCustomerPaymentMethod(selectedPaymentMethod.id, payload);
      } else {
        await createCustomerPaymentMethod(payload);
      }

      await loadPaymentMethods({ quietly: true });
      setIsPaymentMethodModalOpen(false);
      setSelectedPaymentMethod(null);
      toast.success(selectedPaymentMethod ? "Payment method updated successfully." : "Payment method added successfully.");
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          selectedPaymentMethod
            ? "Unable to update this payment method right now."
            : "Unable to add this payment method right now.",
        ),
      );
    } finally {
      setIsSubmittingPaymentMethod(false);
    }
  };

  return (
    <>
      <PageShell
        eyebrow="Wallet and payments"
        title="Credits, saved methods, and spend history."
        description="The wallet route now keeps wallet balance read-only while safely connecting saved card and UPI methods to the live authenticated backend."
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

            <SurfaceCard className="space-y-4">
              <SectionHeading
                title="Saved payment methods"
                action={
                  <Button type="button" onClick={handleCreatePaymentMethod}>
                    Add payment method
                  </Button>
                }
              />
              {isLoadingPaymentMethods ? (
                <div className="rounded-[1.5rem] bg-cream px-5 py-4 text-sm text-ink-soft">
                  Loading your saved payment methods.
                </div>
              ) : savedPaymentMethods.length ? (
                <div className="grid gap-4">
                  {savedPaymentMethods.map((method) => (
                    <div key={method.id} className="flex items-start justify-between gap-4 rounded-[1.5rem] bg-cream px-5 py-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-accent shadow-soft">
                          <CreditCard className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="font-semibold text-ink">{getPaymentMethodTitle(method)}</p>
                            {method.isPrimary ? <StatusPill label="Primary" tone="info" /> : null}
                          </div>
                          <p className="mt-1 text-sm text-ink-soft">{getPaymentMethodSubtitle(method)}</p>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={() => handleEditPaymentMethod(method)}>
                        <Edit3 className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No saved payment methods yet"
                  description="Add a masked card summary or UPI ID here so checkout stays fast, polished, and safe."
                />
              )}
            </SurfaceCard>
          </div>

          <SurfaceCard className="space-y-4">
            <SectionHeading title="Recent wallet activity" description="Shared demo ledger until wallet endpoints are surfaced page-by-page." />
            <Table columns={["Date", "Activity", "Amount"]} rows={rows} className="border-none bg-transparent shadow-none" />
          </SurfaceCard>
        </div>
      </PageShell>

      <PaymentMethodFormModal
        open={isPaymentMethodModalOpen}
        paymentMethod={selectedPaymentMethod}
        defaultHolderName={user?.fullName}
        isSubmitting={isSubmittingPaymentMethod}
        onClose={handleClosePaymentMethodModal}
        onSubmit={handleSubmitPaymentMethod}
      />
    </>
  );
};
