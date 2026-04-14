import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Edit3, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/page-shell";
import type { UserRole } from "@/types/auth";

export const PAGE_SIZE = 6;
export const ROLE_OPTIONS: UserRole[] = ["CUSTOMER", "RESTAURANT_OWNER", "DELIVERY_PARTNER", "OPERATIONS_MANAGER", "ADMIN"];
export const VEHICLE_OPTIONS = ["BIKE", "CYCLE", "SCOOTER", "CAR"];
export const FOOD_TYPES = ["VEG", "NON_VEG", "EGG"];
export const ADDON_TYPES = ["EXTRA", "UPGRADE", "DIP", "DRINK", "SIDE", "DESSERT"];
export const ORDER_STATUS_OPTIONS = [
  "PLACED",
  "CONFIRMED",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "LOOKING_FOR_DELIVERY_PARTNER",
  "DELIVERY_PARTNER_ASSIGNED",
  "PICKED_UP",
  "ON_THE_WAY",
  "DELAYED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "PAYMENT_FAILED",
  "REFUNDED",
];
export const DISCOUNT_TYPES = ["PERCENTAGE", "FLAT"];
export const OFFER_SCOPES = ["PLATFORM", "RESTAURANT"];
export const NOTIFICATION_TYPES = ["ORDER", "OFFER", "SYSTEM", "PAYMENT"];

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

export const formatDate = (value?: string | null) => {
  if (!value) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(value));
};

export const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export const toLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character: string) => character.toUpperCase());

export const matchesSearch = (value: string, search: string) =>
  value.toLowerCase().includes(search.trim().toLowerCase());

export const paginate = <T,>(items: T[], page: number) => {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;

  return {
    totalPages,
    currentPage,
    items: items.slice(start, start + PAGE_SIZE),
  };
};

export const getToneForStatus = (value?: string | boolean | null) => {
  if (typeof value === "boolean") {
    return value ? "success" : "warning";
  }

  const normalized = value?.toUpperCase() ?? "";
  if (
    normalized.includes("ACTIVE") ||
    normalized.includes("DELIVERED") ||
    normalized.includes("ONLINE") ||
    normalized.includes("APPROVED") ||
    normalized.includes("VERIFIED") ||
    normalized.includes("PAID") ||
    normalized.includes("READY_FOR_PICKUP")
  ) {
    return "success" as const;
  }

  if (
    normalized.includes("PENDING") ||
    normalized.includes("PLACED") ||
    normalized.includes("CONFIRMED") ||
    normalized.includes("PREPARING") ||
    normalized.includes("LOOKING_FOR_DELIVERY_PARTNER") ||
    normalized.includes("DELIVERY_PARTNER_ASSIGNED") ||
    normalized.includes("PICKED_UP") ||
    normalized.includes("ON_THE_WAY") ||
    normalized.includes("OUT_FOR_DELIVERY") ||
    normalized.includes("BUSY") ||
    normalized.includes("DELAYED")
  ) {
    return "info" as const;
  }

  if (
    normalized.includes("INACTIVE") ||
    normalized.includes("OFFLINE") ||
    normalized.includes("CANCELLED") ||
    normalized.includes("FAILED") ||
    normalized.includes("REFUNDED") ||
    normalized.includes("REJECTED")
  ) {
    return "warning" as const;
  }

  return "neutral" as const;
};

export const ToggleField = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => {
  return (
    <label className="flex items-center justify-between rounded-[1.5rem] border border-accent/10 bg-cream-soft/60 px-4 py-3">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-[rgb(139,30,36)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
};

export const ChipSelector = ({
  label,
  selectedIds,
  options,
  onToggle,
}: {
  label: string;
  selectedIds: number[];
  options: Array<{ id: number; name: string }>;
  onToggle: (id: number) => void;
}) => {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selectedIds.includes(option.id);

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onToggle(option.id)}
              className={
                isSelected
                  ? "rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-soft"
                  : "rounded-full border border-accent/15 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft shadow-soft"
              }
            >
              {option.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const QuickLinkCard = ({
  title,
  description,
  to,
}: {
  title: string;
  description: string;
  to: string;
}) => {
  return (
    <Link
      to={to}
      className="rounded-[1.75rem] border border-accent/10 bg-white/80 p-5 shadow-soft transition hover:-translate-y-0.5"
    >
      <p className="font-display text-3xl font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm leading-7 text-ink-soft">{description}</p>
    </Link>
  );
};

export const RowActions = ({
  onView,
  onEdit,
  onDelete,
  deleteLabel = "Delete",
}: {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      {onView ? (
        <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={onView}>
          <Eye className="mr-2 h-4 w-4" />
          View
        </Button>
      ) : null}
      {onEdit ? (
        <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={onEdit}>
          <Edit3 className="mr-2 h-4 w-4" />
          Edit
        </Button>
      ) : null}
      {onDelete ? (
        <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          {deleteLabel}
        </Button>
      ) : null}
    </div>
  );
};

export const RefreshButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <Button type="button" variant="secondary" onClick={onClick}>
      <RefreshCw className="mr-2 h-4 w-4" />
      Refresh
    </Button>
  );
};

export const AddButton = ({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) => {
  return (
    <Button type="button" onClick={onClick}>
      <Plus className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
};

export const InlineStatus = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">{label}</p>
      <div className="mt-2">{value}</div>
    </div>
  );
};

export const StatusGroup = ({ values }: { values: string[] }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <StatusPill key={value} label={value} tone="info" />
      ))}
    </div>
  );
};
