import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminLoadingState } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Textarea } from "@/components/ui/textarea";
import { getLookups } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import { getOwnerRestaurants, updateOwnerRestaurant, type OwnerRestaurant } from "@/lib/owner";
import {
  ChipSelector,
  RefreshButton,
  ToggleField,
  formatCurrency,
  formatDateTime,
  getToneForStatus,
} from "@/pages/admin/admin-shared";

const emptyForm = {
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
  state: "",
  pincode: "",
  preparationTime: "20",
  latitude: "",
  longitude: "",
  isVegOnly: false,
  isActive: true,
  categoryIds: [] as number[],
  cuisineIds: [] as number[],
};

export const OwnerRestaurantPage = () => {
  const [restaurants, setRestaurants] = useState<OwnerRestaurant[]>([]);
  const [restaurantCategories, setRestaurantCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [cuisines, setCuisines] = useState<Array<{ id: number; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRestaurant, setEditingRestaurant] = useState<OwnerRestaurant | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadRestaurants = async () => {
    setIsLoading(true);
    try {
      const [restaurantRows, lookups] = await Promise.all([getOwnerRestaurants(), getLookups()]);
      setRestaurants(restaurantRows);
      setRestaurantCategories(lookups.restaurantCategories);
      setCuisines(lookups.cuisines);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load your restaurants."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRestaurants();
  }, []);

  const openEditModal = (restaurant: OwnerRestaurant) => {
    setEditingRestaurant(restaurant);
    setForm({
      name: restaurant.name,
      description: restaurant.description ?? "",
      email: restaurant.email ?? "",
      phone: restaurant.phone ?? "",
      coverImage: restaurant.coverImage ?? "",
      logoImage: restaurant.logoImage ?? "",
      openingTime: restaurant.openingTime ?? "",
      closingTime: restaurant.closingTime ?? "",
      addressLine: restaurant.addressLine ?? "",
      area: restaurant.area ?? "",
      city: restaurant.city,
      state: restaurant.state,
      pincode: restaurant.pincode,
      preparationTime: String(restaurant.preparationTime),
      latitude: restaurant.latitude != null ? String(restaurant.latitude) : "",
      longitude: restaurant.longitude != null ? String(restaurant.longitude) : "",
      isVegOnly: restaurant.isVegOnly,
      isActive: restaurant.isActive,
      categoryIds: restaurant.categoryMappings.map((item) => item.category.id),
      cuisineIds: restaurant.cuisineMappings.map((item) => item.cuisine.id),
    });
  };

  const handleCloseModal = () => {
    if (isSaving) {
      return;
    }

    setEditingRestaurant(null);
  };

  const toggleSelection = (key: "categoryIds" | "cuisineIds", id: number) => {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(id)
        ? current[key].filter((currentId) => currentId !== id)
        : [...current[key], id],
    }));
  };

  const handleSaveRestaurant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingRestaurant) {
      return;
    }

    setIsSaving(true);
    try {
      await updateOwnerRestaurant(editingRestaurant.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        coverImage: form.coverImage.trim() || undefined,
        logoImage: form.logoImage.trim() || undefined,
        openingTime: form.openingTime.trim() || undefined,
        closingTime: form.closingTime.trim() || undefined,
        addressLine: form.addressLine.trim() || undefined,
        area: form.area.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        preparationTime: Number(form.preparationTime || "20"),
        latitude: form.latitude.trim() ? Number(form.latitude) : undefined,
        longitude: form.longitude.trim() ? Number(form.longitude) : undefined,
        isVegOnly: form.isVegOnly,
        isActive: form.isActive,
        categoryIds: form.categoryIds,
        cuisineIds: form.cuisineIds,
      });
      toast.success("Restaurant profile updated successfully.");
      setEditingRestaurant(null);
      await loadRestaurants();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update restaurant settings."));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <AdminLoadingState rows={6} />;
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Restaurant profile"
        title="Your restaurant details in one place."
        description="Review restaurant info, cuisines, active hours, profile imagery, and guest signals without exposing any other partner data."
        action={<RefreshButton onClick={() => void loadRestaurants()} />}
      />

      {restaurants.length ? (
        <div className="space-y-6">
          {restaurants.map((restaurant) => (
            <SurfaceCard key={restaurant.id} className="space-y-6 overflow-hidden">
              {restaurant.coverImage ? (
                <img src={restaurant.coverImage} alt={restaurant.name} className="h-56 w-full rounded-[1.75rem] object-cover" />
              ) : null}
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-4xl font-semibold text-ink">{restaurant.name}</h2>
                    <StatusPill label={restaurant.isActive ? "Active" : "Inactive"} tone={getToneForStatus(restaurant.isActive)} />
                    {restaurant.isFeatured ? <StatusPill label="Featured" tone="info" /> : null}
                    {restaurant.isVegOnly ? <StatusPill label="Veg only" tone="success" /> : null}
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-soft">{restaurant.description ?? "Description not available yet."}</p>
                </div>
                <div className="space-y-3">
                  <Button type="button" variant="secondary" onClick={() => openEditModal(restaurant)}>
                    Update restaurant profile
                  </Button>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Rating</p>
                      <p className="mt-2 text-sm font-semibold text-ink">{restaurant.avgRating.toFixed(1)} from {restaurant.totalReviews} reviews</p>
                    </div>
                    <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Cost for two</p>
                      <p className="mt-2 text-sm font-semibold text-ink">{formatCurrency(restaurant.costForTwo)}</p>
                    </div>
                    <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Average ETA</p>
                      <p className="mt-2 text-sm font-semibold text-ink">{restaurant.avgDeliveryTime} minutes</p>
                    </div>
                    <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Menu sections</p>
                      <p className="mt-2 text-sm font-semibold text-ink">{restaurant.menuCategories.length} active sections</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
                <div className="space-y-5">
                  <div className="rounded-[1.75rem] bg-cream px-5 py-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Contact and address</p>
                    <div className="mt-4 space-y-3 text-sm leading-7 text-ink-soft">
                      <p><span className="font-semibold text-ink">Email:</span> {restaurant.email ?? "Unavailable"}</p>
                      <p><span className="font-semibold text-ink">Phone:</span> {restaurant.phone ?? "Unavailable"}</p>
                      <p>
                        <span className="font-semibold text-ink">Address:</span> {restaurant.addressLine ?? "Address not available"}, {restaurant.area ?? "Area not available"}, {restaurant.city}, {restaurant.state} {restaurant.pincode}
                      </p>
                      <p>
                        <span className="font-semibold text-ink">Hours:</span> {(restaurant.openingTime ?? "--:--")} to {(restaurant.closingTime ?? "--:--")}
                      </p>
                      <p>
                        <span className="font-semibold text-ink">Preparation time:</span> {restaurant.preparationTime} minutes
                      </p>
                      <p>
                        <span className="font-semibold text-ink">Coordinates:</span>{" "}
                        {restaurant.latitude != null && restaurant.longitude != null
                          ? `${restaurant.latitude.toFixed(4)}, ${restaurant.longitude.toFixed(4)}`
                          : "Auto-detected when available"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] bg-cream px-5 py-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Cuisines and categories</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {restaurant.categoryMappings.map((item) => (
                        <StatusPill key={`category-${item.category.id}`} label={item.category.name} tone="info" />
                      ))}
                      {restaurant.cuisineMappings.map((item) => (
                        <StatusPill key={`cuisine-${item.cuisine.id}`} label={item.cuisine.name} tone="neutral" />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.75rem] bg-cream px-5 py-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Operating hours by day</p>
                    <div className="mt-4 space-y-3">
                      {restaurant.operatingHours.map((hour) => (
                        <div key={hour.id} className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-ink">Day {hour.dayOfWeek}</span>
                          <span className="text-ink-soft">
                            {hour.isClosed ? "Closed" : `${hour.openTime ?? "--:--"} to ${hour.closeTime ?? "--:--"}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] bg-cream px-5 py-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Recent guest reviews</p>
                    <div className="mt-4 space-y-3">
                      {restaurant.reviews.slice(0, 3).map((review) => (
                        <div key={review.id} className="rounded-[1.25rem] border border-white/70 bg-white/70 px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-ink">{review.user.fullName}</p>
                              <p className="text-xs text-ink-muted">{formatDateTime(review.createdAt)}</p>
                            </div>
                            <StatusPill label={`${review.rating} / 5`} tone="info" />
                          </div>
                          <p className="mt-3 text-sm leading-7 text-ink-soft">{review.reviewText ?? "No written feedback was shared."}</p>
                        </div>
                      ))}
                      {!restaurant.reviews.length ? (
                        <p className="text-sm leading-7 text-ink-soft">Guest reviews will appear here once customers start rating completed orders.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      ) : (
        <EmptyState title="No restaurants linked yet" description="This owner account does not have any restaurants assigned at the moment." />
      )}

      <Modal
        open={Boolean(editingRestaurant)}
        onClose={handleCloseModal}
        title={editingRestaurant ? `Update ${editingRestaurant.name}` : "Update restaurant"}
        className="max-w-5xl"
      >
        <form className="space-y-5" onSubmit={handleSaveRestaurant}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Restaurant name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <Input label="Contact email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <Input label="Contact phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <Input label="Cover image URL" value={form.coverImage} onChange={(event) => setForm({ ...form, coverImage: event.target.value })} />
            <Input label="Logo image URL" value={form.logoImage} onChange={(event) => setForm({ ...form, logoImage: event.target.value })} />
            <Input label="Opening time" value={form.openingTime} onChange={(event) => setForm({ ...form, openingTime: event.target.value })} placeholder="09:00" />
            <Input label="Closing time" value={form.closingTime} onChange={(event) => setForm({ ...form, closingTime: event.target.value })} placeholder="23:00" />
            <Input label="Address line" value={form.addressLine} onChange={(event) => setForm({ ...form, addressLine: event.target.value })} />
            <Input label="Area" value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} />
            <Input label="City" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} required />
            <Input label="State" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} required />
            <Input label="Pincode" value={form.pincode} onChange={(event) => setForm({ ...form, pincode: event.target.value })} required />
            <Input label="Preparation time" type="number" min="5" value={form.preparationTime} onChange={(event) => setForm({ ...form, preparationTime: event.target.value })} required />
            <Input label="Latitude" type="number" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} placeholder="12.9716" />
            <Input label="Longitude" type="number" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} placeholder="77.5946" />
          </div>

          <Textarea label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />

          <div className="grid gap-4 md:grid-cols-2">
            <ToggleField label="Vegetarian only" checked={form.isVegOnly} onChange={(checked) => setForm({ ...form, isVegOnly: checked })} />
            <ToggleField label="Restaurant is active" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} />
          </div>

          <ChipSelector
            label="Restaurant categories"
            selectedIds={form.categoryIds}
            options={restaurantCategories}
            onToggle={(id) => toggleSelection("categoryIds", id)}
          />

          <ChipSelector
            label="Cuisine tags"
            selectedIds={form.cuisineIds}
            options={cuisines}
            onToggle={(id) => toggleSelection("cuisineIds", id)}
          />

          <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4 text-sm leading-7 text-ink-soft">
            Contact, address, cuisine tags, imagery, and preparation time stay scoped to your own restaurant. Default opening and closing times also refresh the owner-facing store schedule summary.
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save updates"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
