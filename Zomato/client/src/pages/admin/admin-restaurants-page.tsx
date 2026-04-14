import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AdminDataTable,
  AdminDetailsGrid,
  AdminLoadingState,
  AdminToolbar,
  ConfirmDangerModal,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveRestaurant,
  createRestaurant,
  getLookups,
  getRestaurants,
  getUsers,
  updateRestaurant,
  type AdminRestaurant,
  type AdminUser,
  type Lookups,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  AddButton,
  ChipSelector,
  PAGE_SIZE,
  RefreshButton,
  RowActions,
  ToggleField,
  formatCurrency,
  getToneForStatus,
  matchesSearch,
  paginate,
} from "./admin-shared";

export const AdminRestaurantsPage = () => {
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [lookups, setLookups] = useState<Lookups>({ cuisines: [], restaurantCategories: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [detailsRestaurant, setDetailsRestaurant] = useState<AdminRestaurant | null>(null);
  const [editingRestaurant, setEditingRestaurant] = useState<AdminRestaurant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRestaurant | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({
    ownerId: "",
    name: "",
    description: "",
    email: "",
    phone: "",
    coverImage: "",
    logoImage: "",
    openingTime: "",
    closingTime: "",
    addressLine: "",
    area: "",
    city: "",
    state: "Karnataka",
    pincode: "560001",
    costForTwo: "",
    avgDeliveryTime: "30",
    preparationTime: "20",
    latitude: "",
    longitude: "",
    isVegOnly: false,
    isActive: true,
    isFeatured: false,
    categoryIds: [] as number[],
    cuisineIds: [] as number[],
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [restaurantRows, userRows, lookupRows] = await Promise.all([getRestaurants(), getUsers(), getLookups()]);
      setRestaurants(restaurantRows);
      setUsers(userRows);
      setLookups(lookupRows);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load restaurants."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const ownerOptions = users.filter((user) => user.role === "RESTAURANT_OWNER");

  const openCreateModal = () => {
    setEditingRestaurant(null);
    setForm({
      ownerId: ownerOptions[0] ? String(ownerOptions[0].id) : "",
      name: "",
      description: "",
      email: "",
      phone: "",
      coverImage: "",
      logoImage: "",
      openingTime: "",
      closingTime: "",
      addressLine: "",
      area: "",
      city: "",
      state: "Karnataka",
      pincode: "560001",
      costForTwo: "",
      avgDeliveryTime: "30",
      preparationTime: "20",
      latitude: "",
      longitude: "",
      isVegOnly: false,
      isActive: true,
      isFeatured: false,
      categoryIds: [],
      cuisineIds: [],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (restaurant: AdminRestaurant) => {
    setEditingRestaurant(restaurant);
    setForm({
      ownerId: String(restaurant.ownerId),
      name: restaurant.name,
      description: restaurant.description ?? "",
      email: restaurant.owner.email,
      phone: restaurant.owner.phone ?? "",
      coverImage: restaurant.coverImage ?? "",
      logoImage: "",
      openingTime: "",
      closingTime: "",
      addressLine: restaurant.addressLine ?? "",
      area: restaurant.area ?? "",
      city: restaurant.city,
      state: restaurant.state,
      pincode: restaurant.pincode,
      costForTwo: String(restaurant.costForTwo),
      avgDeliveryTime: String(restaurant.avgDeliveryTime),
      preparationTime: String(restaurant.preparationTime),
      latitude: restaurant.latitude != null ? String(restaurant.latitude) : "",
      longitude: restaurant.longitude != null ? String(restaurant.longitude) : "",
      isVegOnly: restaurant.isVegOnly,
      isActive: restaurant.isActive,
      isFeatured: restaurant.isFeatured,
      categoryIds: restaurant.categoryMappings.map((mapping) => mapping.category.id),
      cuisineIds: restaurant.cuisineMappings.map((mapping) => mapping.cuisine.id),
    });
    setIsModalOpen(true);
  };

  const toggleSelection = (key: "categoryIds" | "cuisineIds", id: number) => {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(id) ? current[key].filter((value) => value !== id) : [...current[key], id],
    }));
  };

  const filteredRestaurants = restaurants.filter((restaurant) => {
    const haystack = `${restaurant.name} ${restaurant.city} ${restaurant.area ?? ""} ${restaurant.owner.fullName}`;
    return (!search || matchesSearch(haystack, search)) && (statusFilter === "ALL" || (statusFilter === "ACTIVE" ? restaurant.isActive : !restaurant.isActive));
  });

  const pagedRestaurants = paginate(filteredRestaurants, page);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.ownerId) {
      toast.error("Please choose a restaurant owner.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ownerId: Number(form.ownerId),
        name: form.name,
        description: form.description.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        coverImage: form.coverImage.trim() || undefined,
        logoImage: form.logoImage.trim() || undefined,
        openingTime: form.openingTime.trim() || undefined,
        closingTime: form.closingTime.trim() || undefined,
        addressLine: form.addressLine.trim() || undefined,
        area: form.area.trim() || undefined,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        costForTwo: Number(form.costForTwo || "0"),
        avgDeliveryTime: Number(form.avgDeliveryTime || "30"),
        preparationTime: Number(form.preparationTime || "20"),
        latitude: form.latitude.trim() ? Number(form.latitude) : undefined,
        longitude: form.longitude.trim() ? Number(form.longitude) : undefined,
        isVegOnly: form.isVegOnly,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        categoryIds: form.categoryIds,
        cuisineIds: form.cuisineIds,
      };

      if (editingRestaurant) {
        await updateRestaurant(editingRestaurant.id, payload);
        toast.success("Restaurant updated successfully.");
      } else {
        await createRestaurant(payload);
        toast.success("Restaurant created successfully.");
      }

      setIsModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save this restaurant."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveRestaurant = async () => {
    if (!deleteTarget) {
      return;
    }
    setIsDeleting(true);
    try {
      await archiveRestaurant(deleteTarget.id);
      toast.success("Restaurant archived successfully.");
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to archive this restaurant."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Restaurants"
        title="Partner coverage and restaurant quality."
        description="Manage storefronts, featured placements, cuisines, and partner assignment from one admin surface."
        action={<div className="flex gap-3"><RefreshButton onClick={() => void loadData()} /><AddButton label="Add restaurant" onClick={openCreateModal} /></div>}
      />

      <AdminToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by restaurant, area, city, or owner"
        filters={
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-w-[180px]">
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        }
      />

      {isLoading ? (
        <AdminLoadingState />
      ) : (
        <>
          <AdminDataTable
            rows={pagedRestaurants.items}
            getRowKey={(restaurant) => restaurant.id}
            emptyTitle="No restaurants found"
            emptyDescription="Adjust your filters or add a new partner restaurant."
            columns={[
              { key: "restaurant", label: "Restaurant", render: (restaurant) => <div><p className="font-semibold text-ink">{restaurant.name}</p><p className="text-xs text-ink-muted">{restaurant.area ?? "Primary area unavailable"}, {restaurant.city}</p></div> },
              { key: "owner", label: "Owner", render: (restaurant) => <div><p className="font-semibold text-ink">{restaurant.owner.fullName}</p><p className="text-xs text-ink-muted">{restaurant.owner.email}</p></div> },
              { key: "status", label: "Status", render: (restaurant) => <div className="space-y-2"><StatusPill label={restaurant.isActive ? "Active" : "Inactive"} tone={getToneForStatus(restaurant.isActive)} />{restaurant.isFeatured ? <StatusPill label="Featured" tone="info" /> : null}</div> },
              { key: "metrics", label: "Metrics", render: (restaurant) => <div><p className="font-semibold text-ink">{restaurant.avgRating.toFixed(1)} rating</p><p className="text-xs text-ink-muted">{restaurant._count.orders} orders • {restaurant._count.menuItems} dishes</p></div> },
              { key: "actions", label: "Actions", render: (restaurant) => <RowActions onView={() => setDetailsRestaurant(restaurant)} onEdit={() => openEditModal(restaurant)} onDelete={() => setDeleteTarget(restaurant)} deleteLabel="Archive" /> },
            ]}
          />
          {filteredRestaurants.length > PAGE_SIZE ? <Pagination page={pagedRestaurants.currentPage} totalPages={pagedRestaurants.totalPages} onPageChange={setPage} /> : null}
        </>
      )}

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRestaurant ? "Edit restaurant" : "Add restaurant"} className="max-w-4xl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Select label="Owner" value={form.ownerId} onChange={(event) => setForm({ ...form, ownerId: event.target.value })} required>
              <option value="">Select owner</option>
              {ownerOptions.map((owner) => <option key={owner.id} value={owner.id}>{owner.fullName}</option>)}
            </Select>
            <Input label="Restaurant name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <Input label="Contact email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <Input label="Opening time" value={form.openingTime} onChange={(event) => setForm({ ...form, openingTime: event.target.value })} placeholder="12:00" />
            <Input label="Closing time" value={form.closingTime} onChange={(event) => setForm({ ...form, closingTime: event.target.value })} placeholder="23:00" />
            <Input label="Area" value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} />
            <Input label="City" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} required />
            <Input label="State" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} />
            <Input label="Pincode" value={form.pincode} onChange={(event) => setForm({ ...form, pincode: event.target.value })} />
            <Input label="Cost for two" type="number" min="0" value={form.costForTwo} onChange={(event) => setForm({ ...form, costForTwo: event.target.value })} />
            <Input label="Average delivery time" type="number" min="10" value={form.avgDeliveryTime} onChange={(event) => setForm({ ...form, avgDeliveryTime: event.target.value })} />
            <Input label="Preparation time" type="number" min="5" value={form.preparationTime} onChange={(event) => setForm({ ...form, preparationTime: event.target.value })} />
            <Input label="Latitude" type="number" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} placeholder="12.9716" />
            <Input label="Longitude" type="number" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} placeholder="77.5946" />
          </div>
          <Input label="Address line" value={form.addressLine} onChange={(event) => setForm({ ...form, addressLine: event.target.value })} />
          <Input label="Cover image URL" value={form.coverImage} onChange={(event) => setForm({ ...form, coverImage: event.target.value })} />
          <Input label="Logo image URL" value={form.logoImage} onChange={(event) => setForm({ ...form, logoImage: event.target.value })} />
          <Textarea label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <div className="grid gap-4 md:grid-cols-3">
            <ToggleField label="Vegetarian only" checked={form.isVegOnly} onChange={(checked) => setForm({ ...form, isVegOnly: checked })} />
            <ToggleField label="Currently active" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} />
            <ToggleField label="Featured placement" checked={form.isFeatured} onChange={(checked) => setForm({ ...form, isFeatured: checked })} />
          </div>
          <ChipSelector label="Restaurant categories" selectedIds={form.categoryIds} options={lookups.restaurantCategories} onToggle={(id) => toggleSelection("categoryIds", id)} />
          <ChipSelector label="Cuisines" selectedIds={form.cuisineIds} options={lookups.cuisines} onToggle={(id) => toggleSelection("cuisineIds", id)} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : editingRestaurant ? "Save changes" : "Create restaurant"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(detailsRestaurant)} onClose={() => setDetailsRestaurant(null)} title={detailsRestaurant?.name} className="max-w-3xl">
        {detailsRestaurant ? (
          <div className="space-y-5">
            <AdminDetailsGrid items={[
              { label: "Owner", value: `${detailsRestaurant.owner.fullName} (${detailsRestaurant.owner.email})` },
              { label: "Location", value: `${detailsRestaurant.area ?? "Area not available"}, ${detailsRestaurant.city}` },
              { label: "Address line", value: detailsRestaurant.addressLine ?? "Not available" },
              { label: "Rating", value: `${detailsRestaurant.avgRating.toFixed(1)} from ${detailsRestaurant.totalReviews} reviews` },
              { label: "Cost for two", value: formatCurrency(detailsRestaurant.costForTwo) },
              { label: "Delivery ETA", value: `${detailsRestaurant.avgDeliveryTime} minutes` },
              { label: "Preparation time", value: `${detailsRestaurant.preparationTime} minutes` },
              {
                label: "Coordinates",
                value:
                  detailsRestaurant.latitude != null && detailsRestaurant.longitude != null
                    ? `${detailsRestaurant.latitude.toFixed(4)}, ${detailsRestaurant.longitude.toFixed(4)}`
                    : "Auto-detected when possible",
              },
              { label: "Inventory", value: `${detailsRestaurant._count.menuItems} dishes • ${detailsRestaurant._count.orders} orders` },
            ]} />
            <SurfaceCard className="space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Categories and cuisines</p>
              <div className="flex flex-wrap gap-2">
                {detailsRestaurant.categoryMappings.map((item) => <StatusPill key={`category-${item.category.id}`} label={item.category.name} tone="info" />)}
                {detailsRestaurant.cuisineMappings.map((item) => <StatusPill key={`cuisine-${item.cuisine.id}`} label={item.cuisine.name} tone="neutral" />)}
              </div>
            </SurfaceCard>
          </div>
        ) : null}
      </Modal>

      <ConfirmDangerModal
        open={Boolean(deleteTarget)}
        title="Archive restaurant"
        description="This safe delete marks the restaurant inactive so historic orders and reviews remain intact."
        confirmLabel="Archive restaurant"
        isSubmitting={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleArchiveRestaurant()}
      />
    </div>
  );
};
