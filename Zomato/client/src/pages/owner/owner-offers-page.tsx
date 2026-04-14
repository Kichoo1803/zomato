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
import { getApiErrorMessage } from "@/lib/auth";
import {
  createOwnerOffer,
  deleteOwnerOffer,
  getOwnerOffers,
  getOwnerRestaurants,
  updateOwnerOffer,
  type OwnerOffer,
  type OwnerRestaurant,
} from "@/lib/owner";
import {
  AddButton,
  DISCOUNT_TYPES,
  PAGE_SIZE,
  RefreshButton,
  RowActions,
  ToggleField,
  formatCurrency,
  getToneForStatus,
  matchesSearch,
  paginate,
  toLabel,
} from "@/pages/admin/admin-shared";

const emptyForm = (restaurantId = "") => ({
  restaurantId,
  code: "",
  title: "",
  description: "",
  discountType: "PERCENTAGE",
  discountValue: "",
  minOrderAmount: "0",
  maxDiscount: "",
  usageLimit: "",
  perUserLimit: "",
  startDate: "",
  endDate: "",
  isActive: true,
});

export const OwnerOffersPage = () => {
  const [offers, setOffers] = useState<OwnerOffer[]>([]);
  const [restaurants, setRestaurants] = useState<OwnerRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [restaurantFilter, setRestaurantFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [editingOffer, setEditingOffer] = useState<OwnerOffer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OwnerOffer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [offerRows, restaurantRows] = await Promise.all([getOwnerOffers(), getOwnerRestaurants()]);
      setOffers(offerRows);
      setRestaurants(restaurantRows);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load your restaurant offers."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openCreateModal = () => {
    setEditingOffer(null);
    setForm(emptyForm(restaurants[0] ? String(restaurants[0].id) : ""));
    setIsModalOpen(true);
  };

  const openEditModal = (offer: OwnerOffer) => {
    setEditingOffer(offer);
    setForm({
      restaurantId: offer.restaurantLinks[0] ? String(offer.restaurantLinks[0].restaurant.id) : "",
      code: offer.code ?? "",
      title: offer.title,
      description: offer.description ?? "",
      discountType: offer.discountType,
      discountValue: String(offer.discountValue),
      minOrderAmount: String(offer.minOrderAmount),
      maxDiscount: offer.maxDiscount ? String(offer.maxDiscount) : "",
      usageLimit: offer.usageLimit ? String(offer.usageLimit) : "",
      perUserLimit: offer.perUserLimit ? String(offer.perUserLimit) : "",
      startDate: offer.startDate ? offer.startDate.slice(0, 10) : "",
      endDate: offer.endDate ? offer.endDate.slice(0, 10) : "",
      isActive: offer.isActive,
    });
    setIsModalOpen(true);
  };

  const filteredOffers = offers.filter((offer) => {
    const restaurantName = offer.restaurantLinks.map((link) => link.restaurant.name).join(" ");
    const haystack = `${offer.title} ${offer.code ?? ""} ${offer.description ?? ""} ${restaurantName}`;

    return (
      (!search || matchesSearch(haystack, search)) &&
      (restaurantFilter === "ALL" ||
        offer.restaurantLinks.some((link) => String(link.restaurant.id) === restaurantFilter)) &&
      (statusFilter === "ALL" || (statusFilter === "ACTIVE" ? offer.isActive : !offer.isActive))
    );
  });

  const pagedOffers = paginate(filteredOffers, page);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.restaurantId) {
      toast.error("Choose one of your restaurants for this offer.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        restaurantId: Number(form.restaurantId),
        code: form.code.trim() || undefined,
        title: form.title,
        description: form.description.trim() || undefined,
        discountType: form.discountType,
        discountValue: Number(form.discountValue || "0"),
        minOrderAmount: Number(form.minOrderAmount || "0"),
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        isActive: form.isActive,
      };

      if (editingOffer) {
        await updateOwnerOffer(editingOffer.id, payload);
        toast.success("Restaurant offer updated successfully.");
      } else {
        await createOwnerOffer(payload);
        toast.success("Restaurant offer created successfully.");
      }

      setIsModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save this restaurant offer."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOffer = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteOwnerOffer(deleteTarget.id);
      toast.success("Restaurant offer deleted successfully.");
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to delete this restaurant offer."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Owner offers"
        title="Promotions for your own restaurants."
        description="Create restaurant-scoped coupons, minimum-order offers, and time-bound campaigns without exposing platform-wide campaigns."
        action={
          <div className="flex gap-3">
            <RefreshButton onClick={() => void loadData()} />
            <AddButton label="Add offer" onClick={openCreateModal} />
          </div>
        }
      />

      <AdminToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by title, code, or restaurant"
        filters={
          <>
            <Select
              value={restaurantFilter}
              onChange={(event) => {
                setRestaurantFilter(event.target.value);
                setPage(1);
              }}
              className="min-w-[220px]"
            >
              <option value="ALL">All owned restaurants</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="min-w-[180px]"
            >
              <option value="ALL">All states</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </>
        }
      />

      {isLoading ? (
        <AdminLoadingState />
      ) : (
        <>
          <AdminDataTable
            rows={pagedOffers.items}
            getRowKey={(offer) => offer.id}
            emptyTitle="No restaurant offers found"
            emptyDescription="Create a restaurant campaign to give guests a timely reason to order."
            columns={[
              {
                key: "offer",
                label: "Offer",
                render: (offer) => (
                  <div>
                    <p className="font-semibold text-ink">{offer.title}</p>
                    <p className="text-xs text-ink-muted">{offer.code ?? "No coupon code assigned"}</p>
                  </div>
                ),
              },
              {
                key: "restaurant",
                label: "Restaurant",
                render: (offer) => (
                  <div>
                    <p className="font-semibold text-ink">{offer.restaurantLinks[0]?.restaurant.name ?? "Unlinked"}</p>
                    <p className="text-xs text-ink-muted">Restaurant scope</p>
                  </div>
                ),
              },
              {
                key: "discount",
                label: "Discount",
                render: (offer) => (
                  <div>
                    <p className="font-semibold text-ink">
                      {offer.discountType === "PERCENTAGE"
                        ? `${offer.discountValue}%`
                        : formatCurrency(offer.discountValue)}
                    </p>
                    <p className="text-xs text-ink-muted">Min order {formatCurrency(offer.minOrderAmount)}</p>
                  </div>
                ),
              },
              {
                key: "schedule",
                label: "Schedule",
                render: (offer) => (
                  <div>
                    <p className="text-sm text-ink-soft">
                      {offer.startDate ? offer.startDate.slice(0, 10) : "Starts immediately"}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {offer.endDate ? `Ends ${offer.endDate.slice(0, 10)}` : "No expiry"}
                    </p>
                  </div>
                ),
              },
              {
                key: "status",
                label: "State",
                render: (offer) => (
                  <StatusPill label={offer.isActive ? "Active" : "Inactive"} tone={getToneForStatus(offer.isActive)} />
                ),
              },
              {
                key: "actions",
                label: "Actions",
                render: (offer) => (
                  <RowActions onEdit={() => openEditModal(offer)} onDelete={() => setDeleteTarget(offer)} />
                ),
              },
            ]}
          />
          {filteredOffers.length > PAGE_SIZE ? (
            <Pagination page={pagedOffers.currentPage} totalPages={pagedOffers.totalPages} onPageChange={setPage} />
          ) : null}
        </>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingOffer ? "Edit restaurant offer" : "Add restaurant offer"}
        className="max-w-3xl"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Restaurant"
              value={form.restaurantId}
              onChange={(event) => setForm({ ...form, restaurantId: event.target.value })}
              required
            >
              <option value="">Select restaurant</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </Select>
            <Input label="Coupon code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
            <Input label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            <Select
              label="Discount type"
              value={form.discountType}
              onChange={(event) => setForm({ ...form, discountType: event.target.value })}
            >
              {DISCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {toLabel(type)}
                </option>
              ))}
            </Select>
            <Input
              label="Discount value"
              type="number"
              min="1"
              value={form.discountValue}
              onChange={(event) => setForm({ ...form, discountValue: event.target.value })}
              required
            />
            <Input
              label="Minimum order amount"
              type="number"
              min="0"
              value={form.minOrderAmount}
              onChange={(event) => setForm({ ...form, minOrderAmount: event.target.value })}
            />
            <Input
              label="Maximum discount"
              type="number"
              min="0"
              value={form.maxDiscount}
              onChange={(event) => setForm({ ...form, maxDiscount: event.target.value })}
            />
            <Input
              label="Usage limit"
              type="number"
              min="1"
              value={form.usageLimit}
              onChange={(event) => setForm({ ...form, usageLimit: event.target.value })}
            />
            <Input
              label="Per-user limit"
              type="number"
              min="1"
              value={form.perUserLimit}
              onChange={(event) => setForm({ ...form, perUserLimit: event.target.value })}
            />
            <Input
              label="Start date"
              type="date"
              value={form.startDate}
              onChange={(event) => setForm({ ...form, startDate: event.target.value })}
            />
            <Input
              label="End date"
              type="date"
              value={form.endDate}
              onChange={(event) => setForm({ ...form, endDate: event.target.value })}
            />
          </div>
          <Textarea
            label="Description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
          <ToggleField label="Offer is active" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingOffer ? "Save changes" : "Create offer"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDangerModal
        open={Boolean(deleteTarget)}
        title="Delete restaurant offer"
        description="This permanently removes the offer and its restaurant coupon mapping from your restaurant."
        confirmLabel="Delete offer"
        isSubmitting={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteOffer()}
      />
    </div>
  );
};
