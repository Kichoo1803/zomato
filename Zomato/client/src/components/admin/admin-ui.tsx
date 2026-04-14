import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";

export type AdminTableColumn<T> = {
  key: string;
  label: string;
  className?: string;
  render: (item: T) => ReactNode;
};

type AdminDataTableProps<T> = {
  columns: AdminTableColumn<T>[];
  rows: T[];
  getRowKey: (item: T) => string | number;
  emptyTitle: string;
  emptyDescription: string;
};

type AdminToolbarProps = {
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  filters?: ReactNode;
  action?: ReactNode;
};

type AdminDetailsGridProps = {
  items: Array<{
    label: string;
    value: ReactNode;
  }>;
  className?: string;
};

type ConfirmDangerModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export const AdminToolbar = ({
  searchValue,
  searchPlaceholder,
  onSearchChange,
  filters,
  action,
}: AdminToolbarProps) => {
  return (
    <div className="flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/70 p-4 shadow-soft lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
        <div className="w-full max-w-xl">
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
        {filters ? <div className="flex flex-1 flex-wrap gap-3">{filters}</div> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
    </div>
  );
};

export const AdminDataTable = <T,>({
  columns,
  rows,
  getRowKey,
  emptyTitle,
  emptyDescription,
}: AdminDataTableProps<T>) => {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-soft">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-accent/10">
          <thead className="bg-cream-soft/80">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.28em] text-ink-muted",
                    column.className,
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-accent/10">
            {rows.map((row) => (
              <tr key={getRowKey(row)} className="align-top">
                {columns.map((column) => (
                  <td key={column.key} className={cn("px-5 py-4 text-sm text-ink-soft", column.className)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const AdminDetailsGrid = ({ items, className }: AdminDetailsGridProps) => {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="rounded-[1.5rem] bg-cream px-5 py-4">
          <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">{item.label}</p>
          <div className="mt-2 text-sm leading-7 text-ink">{item.value}</div>
        </div>
      ))}
    </div>
  );
};

export const AdminLoadingState = ({ rows = 5 }: { rows?: number }) => {
  return (
    <div className="space-y-3 rounded-[2rem] border border-white/70 bg-white/80 p-4 shadow-soft">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
};

export const ConfirmDangerModal = ({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  isSubmitting,
  onClose,
  onConfirm,
}: ConfirmDangerModalProps) => {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm leading-7 text-ink-soft">{description}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="button" onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting ? "Working..." : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
};
