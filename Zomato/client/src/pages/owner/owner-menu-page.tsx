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
  createOwnerMenuItem,
  deleteOwnerMenuItem,
  getOwnerMenuCategories,
  getOwnerMenuItems,
  getOwnerRestaurants,
  updateOwnerMenuItem,
  type OwnerMenuCategory,
  type OwnerMenuItem,
  type OwnerRestaurantSummary,
} from "@/lib/owner";
import {
  AddButton,
  FOOD_TYPES,
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
  categoryId: "",
  name: "",
  description: "",
  image: "",
  price: "",
  discountPrice: "",
  foodType: "VEG",
  isAvailable: true,
  isRecommended: false,
  preparationTime: "20",
  calories: "",
  spiceLevel: "",
});

export const OwnerMenuPage = () => {
  const [items, setItems] = useState<OwnerMenuItem[]>([]);
  const [restaurants, setRestaurants] = useState<OwnerRestaurantSummary[]>([]);
  const [menuCategories, setMenuCategories] = useState<OwnerMenuCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [restaurantFilter, setRestaurantFilter] = useState("ALL");
  const [availabilityFilter, setAvailabilityFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [editingItem, setEditingItem] = useState<OwnerMenuItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OwnerMenuItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [itemRows, restaurantRows] = await Promise.all([
        getOwnerMenuItems(),
        getOwnerRestaurants({ view: "summary" }),
      ]);
      setItems(itemRows);
      setRestaurants(restaurantRows);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load your menu items."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const selectedRestaurantId = Number(form.restaurantId);
    if (!selectedRestaurantId) {
      setMenuCategories([]);
      return;
    }

    void (async () => {
      try {
        setMenuCategories(await getOwnerMenuCategories(selectedRestaurantId));
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Unable to load menu categories."));
      }
    })();
  }, [form.restaurantId]);

  const openCreateModal = () => {
    setEditingItem(null);
    setForm(emptyForm(restaurants[0] ? String(restaurants[0].id) : ""));
    setIsModalOpen(true);
  };

  const openEditModal = (item: OwnerMenuItem) => {
    setEditingItem(item);
    setForm({
      restaurantId: String(item.restaurantId),
      categoryId: String(item.categoryId),
      name: item.name,
      description: item.description ?? "",
      image: item.image ?? "",
      price: String(item.price),
      discountPrice: item.discountPrice ? String(item.discountPrice) : "",
      foodType: item.foodType,
      isAvailable: item.isAvailable,
      isRecommended: item.isRecommended,
      preparationTime: String(item.preparationTime),
      calories: item.calories ? String(item.calories) : "",
      spiceLevel: item.spiceLevel ? String(item.spiceLevel) : "",
    });
    setIsModalOpen(true);
  };

  const filteredItems = items.filter((item) => {
    const haystack = `${item.name} ${item.restaurant.name} ${item.category.name} ${item.description ?? ""}`;

    return (
      (!search || matchesSearch(haystack, search)) &&
      (restaurantFilter === "ALL" || String(item.restaurantId) === restaurantFilter) &&
      (availabilityFilter === "ALL" ||
        (availabilityFilter === "AVAILABLE" ? item.isAvailable : !item.isAvailable))
    );
  });

  const pagedItems = paginate(filteredItems, page);

  const handleToggleAvailability = async (item: OwnerMenuItem) => {
    try {
      await updateOwnerMenuItem(item.id, { isAvailable: !item.isAvailable });
      toast.success(`Dish marked as ${!item.isAvailable ? "available" : "unavailable"}.`);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update this dish."));
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.restaurantId || !form.categoryId) {
      toast.error("Choose both one of your restaurants and a menu category.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        restaurantId: Number(form.restaurantId),
        categoryId: Number(form.categoryId),
        name: form.name,
        description: form.description.trim() || undefined,
        image: form.image.trim() || undefined,
        price: Number(form.price || "0"),
        discountPrice: form.discountPrice ? Number(form.discountPrice) : undefined,
        foodType: form.foodType,
        isAvailable: form.isAvailable,
        isRecommended: form.isRecommended,
        preparationTime: Number(form.preparationTime || "20"),
        calories: form.calories ? Number(form.calories) : undefined,
        spiceLevel: form.spiceLevel ? Number(form.spiceLevel) : undefined,
      };

      if (editingItem) {
        await updateOwnerMenuItem(editingItem.id, {
          categoryId: payload.categoryId,
          name: payload.name,
          description: payload.description,
          image: payload.image,
          price: payload.price,
          discountPrice: payload.discountPrice,
          foodType: payload.foodType,
          isAvailable: payload.isAvailable,
          isRecommended: payload.isRecommended,
          preparationTime: payload.preparationTime,
          calories: payload.calories,
          spiceLevel: payload.spiceLevel,
        });
        toast.success("Menu item updated successfully.");
      } else {
        await createOwnerMenuItem(payload);
        toast.success("Menu item created successfully.");
      }

      setIsModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save this menu item."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteOwnerMenuItem(deleteTarget.id);
      toast.success("Menu item deleted successfully.");
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to delete this menu item."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Owner menu"
        title="Your menu visibility and merchandising."
        description="List, create, edit, price, and retire dishes for only your own restaurants while keeping category assignment and availability inside the current owner flow."
        action={
          <div className="flex gap-3">
            <RefreshButton onClick={() => void loadData()} />
            <AddButton label="Add dish" onClick={openCreateModal} />
          </div>
        }
      />

      <AdminToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by dish, category, restaurant, or description"
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
              value={availabilityFilter}
              onChange={(event) => {
                setAvailabilityFilter(event.target.value);
                setPage(1);
              }}
              className="min-w-[180px]"
            >
              <option value="ALL">All availability</option>
              <option value="AVAILABLE">Available</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </Select>
          </>
        }
      />

      {isLoading ? (
        <AdminLoadingState />
      ) : (
        <>
          <AdminDataTable
            rows={pagedItems.items}
            getRowKey={(item) => item.id}
            emptyTitle="No menu items found"
            emptyDescription="Your restaurant dishes will appear here once you add them."
            columns={[
              {
                key: "dish",
                label: "Dish",
                render: (item) => (
                  <div className="flex items-start gap-3">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-14 w-14 rounded-2xl object-cover" />
                    ) : null}
                    <div>
                      <p className="font-semibold text-ink">{item.name}</p>
                      <p className="text-xs text-ink-muted">{item.restaurant.name}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: "category",
                label: "Category",
                render: (item) => (
                  <div>
                    <p className="font-semibold text-ink">{item.category.name}</p>
                    <p className="text-xs text-ink-muted">{toLabel(item.foodType)}</p>
                  </div>
                ),
              },
              {
                key: "pricing",
                label: "Pricing",
                render: (item) => (
                  <div>
                    <p className="font-semibold text-ink">{formatCurrency(item.price)}</p>
                    <p className="text-xs text-ink-muted">
                      {item.discountPrice ? `Promo ${formatCurrency(item.discountPrice)}` : "No discount"}
                    </p>
                  </div>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (item) => (
                  <div className="space-y-2">
                    <StatusPill label={item.isAvailable ? "Available" : "Unavailable"} tone={getToneForStatus(item.isAvailable)} />
                    {item.isRecommended ? <StatusPill label="Recommended" tone="info" /> : null}
                  </div>
                ),
              },
              {
                key: "actions",
                label: "Actions",
                render: (item) => (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={() => void handleToggleAvailability(item)}>
                      {item.isAvailable ? "Mark unavailable" : "Mark available"}
                    </Button>
                    <RowActions onEdit={() => openEditModal(item)} onDelete={() => setDeleteTarget(item)} />
                  </div>
                ),
              },
            ]}
          />
          {filteredItems.length > PAGE_SIZE ? (
            <Pagination page={pagedItems.currentPage} totalPages={pagedItems.totalPages} onPageChange={setPage} />
          ) : null}
        </>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Edit dish" : "Add dish"}
        className="max-w-3xl"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Restaurant"
              value={form.restaurantId}
              onChange={(event) => setForm({ ...form, restaurantId: event.target.value, categoryId: "" })}
              disabled={Boolean(editingItem)}
              required
            >
              <option value="">Select restaurant</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </Select>
            <Select
              label="Menu category"
              value={form.categoryId}
              onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
              required
            >
              <option value="">Select category</option>
              {menuCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Input label="Dish name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <Select label="Food type" value={form.foodType} onChange={(event) => setForm({ ...form, foodType: event.target.value })}>
              {FOOD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {toLabel(type)}
                </option>
              ))}
            </Select>
            <Input label="Price" type="number" min="1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
            <Input
              label="Discount price"
              type="number"
              min="1"
              value={form.discountPrice}
              onChange={(event) => setForm({ ...form, discountPrice: event.target.value })}
            />
            <Input
              label="Preparation time (mins)"
              type="number"
              min="5"
              value={form.preparationTime}
              onChange={(event) => setForm({ ...form, preparationTime: event.target.value })}
            />
            <Input label="Calories" type="number" min="0" value={form.calories} onChange={(event) => setForm({ ...form, calories: event.target.value })} />
            <Input
              label="Spice level"
              type="number"
              min="1"
              max="5"
              value={form.spiceLevel}
              onChange={(event) => setForm({ ...form, spiceLevel: event.target.value })}
            />
          </div>
          <Input label="Image URL" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} />
          <Textarea label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <div className="grid gap-4 md:grid-cols-2">
            <ToggleField label="Available for orders" checked={form.isAvailable} onChange={(checked) => setForm({ ...form, isAvailable: checked })} />
            <ToggleField label="Recommended item" checked={form.isRecommended} onChange={(checked) => setForm({ ...form, isRecommended: checked })} />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingItem ? "Save changes" : "Create dish"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDangerModal
        open={Boolean(deleteTarget)}
        title="Delete dish"
        description="This permanently removes the menu item from your restaurant. Existing order history will remain intact."
        confirmLabel="Delete dish"
        isSubmitting={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteItem()}
      />
    </div>
  );
};
