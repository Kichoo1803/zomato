import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AdminDataTable,
  AdminLoadingState,
  AdminToolbar,
  ConfirmDangerModal,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading, StatusPill } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createOffer, deleteOffer, getOffers, updateOffer, type AdminOffer } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  AddButton,
  DISCOUNT_TYPES,
  OFFER_SCOPES,
  PAGE_SIZE,
  RefreshButton,
  RowActions,
  ToggleField,
  formatCurrency,
  getToneForStatus,
  matchesSearch,
  paginate,
  toLabel,
} from "./admin-shared";

export const AdminOffersPage = () => {
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [editingOffer, setEditingOffer] = useState<AdminOffer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminOffer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({ code: "", title: "", description: "", discountType: "PERCENTAGE", discountValue: "", minOrderAmount: "0", maxDiscount: "", scope: "PLATFORM", usageLimit: "", perUserLimit: "", startDate: "", endDate: "", isActive: true });

  const loadOffers = async () => {
    setIsLoading(true);
    try {
      setOffers(await getOffers());
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load offers."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOffers();
  }, []);

  const openCreateModal = () => {
    setEditingOffer(null);
    setForm({ code: "", title: "", description: "", discountType: "PERCENTAGE", discountValue: "", minOrderAmount: "0", maxDiscount: "", scope: "PLATFORM", usageLimit: "", perUserLimit: "", startDate: "", endDate: "", isActive: true });
    setIsModalOpen(true);
  };

  const openEditModal = (offer: AdminOffer) => {
    setEditingOffer(offer);
    setForm({ code: offer.code ?? "", title: offer.title, description: offer.description ?? "", discountType: offer.discountType, discountValue: String(offer.discountValue), minOrderAmount: String(offer.minOrderAmount), maxDiscount: offer.maxDiscount ? String(offer.maxDiscount) : "", scope: offer.scope, usageLimit: offer.usageLimit ? String(offer.usageLimit) : "", perUserLimit: offer.perUserLimit ? String(offer.perUserLimit) : "", startDate: offer.startDate ? offer.startDate.slice(0, 10) : "", endDate: offer.endDate ? offer.endDate.slice(0, 10) : "", isActive: offer.isActive });
    setIsModalOpen(true);
  };

  const filteredOffers = offers.filter((offer) => {
    const haystack = `${offer.title} ${offer.code ?? ""} ${offer.description ?? ""}`;
    return (!search || matchesSearch(haystack, search)) && (scopeFilter === "ALL" || offer.scope === scopeFilter) && (statusFilter === "ALL" || (statusFilter === "ACTIVE" ? offer.isActive : !offer.isActive));
  });

  const pagedOffers = paginate(filteredOffers, page);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = { code: form.code.trim() || undefined, title: form.title, description: form.description.trim() || undefined, discountType: form.discountType, discountValue: Number(form.discountValue || "0"), minOrderAmount: Number(form.minOrderAmount || "0"), maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined, scope: form.scope, usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined, perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : undefined, startDate: form.startDate || undefined, endDate: form.endDate || undefined, isActive: form.isActive };
      if (editingOffer) {
        await updateOffer(editingOffer.id, payload);
        toast.success("Offer updated successfully.");
      } else {
        await createOffer(payload);
        toast.success("Offer created successfully.");
      }
      setIsModalOpen(false);
      await loadOffers();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save this offer."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOffer = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteOffer(deleteTarget.id);
      toast.success("Offer deleted successfully.");
      setDeleteTarget(null);
      await loadOffers();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to delete this offer."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Offers and coupons" title="Campaign performance and lifecycle." description="Create, update, filter, and retire platform or restaurant offers from one premium admin surface." action={<div className="flex gap-3"><RefreshButton onClick={() => void loadOffers()} /><AddButton label="Add offer" onClick={openCreateModal} /></div>} />

      <AdminToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by title, code, or offer copy"
        filters={
          <>
            <Select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)} className="min-w-[180px]">
              <option value="ALL">All scopes</option>
              {OFFER_SCOPES.map((scope) => <option key={scope} value={scope}>{toLabel(scope)}</option>)}
            </Select>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-w-[180px]">
              <option value="ALL">All states</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </>
        }
      />

      {isLoading ? <AdminLoadingState /> : (
        <>
          <AdminDataTable
            rows={pagedOffers.items}
            getRowKey={(offer) => offer.id}
            emptyTitle="No offers found"
            emptyDescription="Create a new coupon or broaden your filters."
            columns={[
              { key: "offer", label: "Offer", render: (offer) => <div><p className="font-semibold text-ink">{offer.title}</p><p className="text-xs text-ink-muted">{offer.code ?? "No code assigned"}</p></div> },
              { key: "discount", label: "Discount", render: (offer) => <div><p className="font-semibold text-ink">{offer.discountType === "PERCENTAGE" ? `${offer.discountValue}%` : formatCurrency(offer.discountValue)}</p><p className="text-xs text-ink-muted">Min order {formatCurrency(offer.minOrderAmount)}</p></div> },
              { key: "schedule", label: "Schedule", render: (offer) => <div><p className="text-sm text-ink-soft">{offer.startDate ? offer.startDate.slice(0, 10) : "Starts immediately"}</p><p className="text-xs text-ink-muted">{offer.endDate ? `Ends ${offer.endDate.slice(0, 10)}` : "No expiry"}</p></div> },
              { key: "status", label: "State", render: (offer) => <div className="space-y-2"><StatusPill label={offer.isActive ? "Active" : "Inactive"} tone={getToneForStatus(offer.isActive)} /><StatusPill label={toLabel(offer.scope)} tone="info" /></div> },
              { key: "actions", label: "Actions", render: (offer) => <RowActions onEdit={() => openEditModal(offer)} onDelete={() => setDeleteTarget(offer)} /> },
            ]}
          />
          {filteredOffers.length > PAGE_SIZE ? <Pagination page={pagedOffers.currentPage} totalPages={pagedOffers.totalPages} onPageChange={setPage} /> : null}
        </>
      )}

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingOffer ? "Edit offer" : "Add offer"} className="max-w-3xl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Coupon code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
            <Input label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            <Select label="Discount type" value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value })}>
              {DISCOUNT_TYPES.map((type) => <option key={type} value={type}>{toLabel(type)}</option>)}
            </Select>
            <Input label="Discount value" type="number" min="1" value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} required />
            <Input label="Minimum order amount" type="number" min="0" value={form.minOrderAmount} onChange={(event) => setForm({ ...form, minOrderAmount: event.target.value })} />
            <Input label="Maximum discount" type="number" min="0" value={form.maxDiscount} onChange={(event) => setForm({ ...form, maxDiscount: event.target.value })} />
            <Select label="Scope" value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })}>
              {OFFER_SCOPES.map((scope) => <option key={scope} value={scope}>{toLabel(scope)}</option>)}
            </Select>
            <Input label="Usage limit" type="number" min="1" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} />
            <Input label="Per-user limit" type="number" min="1" value={form.perUserLimit} onChange={(event) => setForm({ ...form, perUserLimit: event.target.value })} />
            <Input label="Start date" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
            <Input label="End date" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
          </div>
          <Textarea label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <ToggleField label="Offer is active" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : editingOffer ? "Save changes" : "Create offer"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDangerModal open={Boolean(deleteTarget)} title="Delete offer" description="This permanently deletes the offer from the platform. Existing applied discounts remain in historic orders." confirmLabel="Delete offer" isSubmitting={isDeleting} onClose={() => setDeleteTarget(null)} onConfirm={() => void handleDeleteOffer()} />
    </div>
  );
};
