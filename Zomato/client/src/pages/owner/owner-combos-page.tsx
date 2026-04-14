import { useEffect, useMemo, useState } from "react";
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
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/auth";
import {
  createOwnerCombo,
  deleteOwnerCombo,
  getOwnerCombos,
  getOwnerMenuItems,
  getOwnerRestaurants,
  updateOwnerCombo,
  type OwnerCombo,
  type OwnerMenuItem,
  type OwnerRestaurant,
} from "@/lib/owner";
import {
  AddButton,
  PAGE_SIZE,
  RefreshButton,
  RowActions,
  ToggleField,
  formatCurrency,
  getToneForStatus,
  matchesSearch,
  paginate,
} from "@/pages/admin/admin-shared";

type ComboFormState = {
  restaurantId: string;
  name: string;
  description: string;
  image: string;
  basePrice: string;
  offerPrice: string;
  categoryTag: string;
  isAvailable: boolean;
  isActive: boolean;
  items: Array<{
    menuItemId: number;
    quantity: string;
  }>;
};

const emptyForm = (restaurantId = ""): ComboFormState => ({
  restaurantId,
  name: "",
  description: "",
  image: "",
  basePrice: "",
  offerPrice: "",
  categoryTag: "",
  isAvailable: true,
  isActive: true,
  items: [],
});

export const OwnerCombosPage = () => {
  const [combos, setCombos] = useState<OwnerCombo[]>([]);
  const [restaurants, setRestaurants] = useState<OwnerRestaurant[]>([]);
  const [menuItems, setMenuItems] = useState<OwnerMenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [restaurantFilter, setRestaurantFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [editingCombo, setEditingCombo] = useState<OwnerCombo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OwnerCombo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState<ComboFormState>(emptyForm());

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [comboRows, restaurantRows, menuItemRows] = await Promise.all([
        getOwnerCombos(),
        getOwnerRestaurants(),
        getOwnerMenuItems(),
      ]);
      setCombos(comboRows);
      setRestaurants(restaurantRows);
      setMenuItems(menuItemRows);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load your combos."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const restaurantMenuItems = useMemo(
    () => menuItems.filter((item) => String(item.restaurantId) === form.restaurantId),
    [form.restaurantId, menuItems],
  );

  const selectedItems = useMemo(
    () =>
      form.items
        .map((item) => ({
          ...item,
          menuItem: restaurantMenuItems.find((menuItem) => menuItem.id === item.menuItemId),
        }))
        .filter((item) => item.menuItem),
    [form.items, restaurantMenuItems],
  );

  const openCreateModal = () => {
    setEditingCombo(null);
    setForm(emptyForm(restaurants[0] ? String(restaurants[0].id) : ""));
    setIsModalOpen(true);
  };

  const openEditModal = (combo: OwnerCombo) => {
    setEditingCombo(combo);
    setForm({
      restaurantId: String(combo.restaurantId),
      name: combo.name,
      description: combo.description ?? "",
      image: combo.image ?? "",
      basePrice: String(combo.basePrice),
      offerPrice: combo.offerPrice ? String(combo.offerPrice) : "",
      categoryTag: combo.categoryTag ?? "",
      isAvailable: combo.isAvailable,
      isActive: combo.isActive,
      items: combo.items.map((item) => ({
        menuItemId: item.menuItem.id,
        quantity: String(item.quantity),
      })),
    });
    setIsModalOpen(true);
  };

  const toggleComboItem = (menuItemId: number) => {
    setForm((current) => {
      const exists = current.items.some((item) => item.menuItemId === menuItemId);
      if (exists) {
        return {
          ...current,
          items: current.items.filter((item) => item.menuItemId !== menuItemId),
        };
      }

      return {
        ...current,
        items: [...current.items, { menuItemId, quantity: "1" }],
      };
    });
  };

  const updateComboItemQuantity = (menuItemId: number, quantity: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.menuItemId === menuItemId ? { ...item, quantity } : item,
      ),
    }));
  };

  const filteredCombos = combos.filter((combo) => {
    const haystack = `${combo.name} ${combo.restaurant.name} ${combo.description ?? ""} ${combo.categoryTag ?? ""}`;

    return (
      (!search || matchesSearch(haystack, search)) &&
      (restaurantFilter === "ALL" || String(combo.restaurantId) === restaurantFilter) &&
      (statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && combo.isActive) ||
        (statusFilter === "INACTIVE" && !combo.isActive) ||
        (statusFilter === "AVAILABLE" && combo.isAvailable) ||
        (statusFilter === "UNAVAILABLE" && !combo.isAvailable))
    );
  });

  const pagedCombos = paginate(filteredCombos, page);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.restaurantId) {
      toast.error("Choose one of your restaurants.");
      return;
    }

    if (!form.items.length) {
      toast.error("Select at least one included menu item.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        restaurantId: Number(form.restaurantId),
        name: form.name,
        description: form.description.trim() || undefined,
        image: form.image.trim() || undefined,
        basePrice: Number(form.basePrice || "0"),
        offerPrice: form.offerPrice ? Number(form.offerPrice) : undefined,
        categoryTag: form.categoryTag.trim() || undefined,
        isAvailable: form.isAvailable,
        isActive: form.isActive,
        items: form.items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: Number(item.quantity || "1"),
        })),
      };

      if (editingCombo) {
        await updateOwnerCombo(editingCombo.id, payload);
        toast.success("Combo updated successfully.");
      } else {
        await createOwnerCombo(payload);
        toast.success("Combo created successfully.");
      }

      setIsModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save this combo."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCombo = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteOwnerCombo(deleteTarget.id);
      toast.success("Combo deleted successfully.");
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to delete this combo."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Owner combos"
        title="Combo offers for your restaurants."
        description="Bundle your own dishes into meal deals, combo pricing, and limited availability offers."
        action={
          <div className="flex gap-3">
            <RefreshButton onClick={() => void loadData()} />
            <AddButton label="Add combo" onClick={openCreateModal} />
          </div>
        }
      />

      <AdminToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by combo, restaurant, or tag"
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
              className="min-w-[200px]"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
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
            rows={pagedCombos.items}
            getRowKey={(combo) => combo.id}
            emptyTitle="No combo offers found"
            emptyDescription="Create your first combo offer to surface richer upsells on the customer menu."
            columns={[
              {
                key: "combo",
                label: "Combo",
                render: (combo) => (
                  <div className="flex items-start gap-3">
                    {combo.image ? (
                      <img
                        src={combo.image}
                        alt={combo.name}
                        className="h-14 w-14 rounded-2xl object-cover"
                      />
                    ) : null}
                    <div>
                      <p className="font-semibold text-ink">{combo.name}</p>
                      <p className="text-xs text-ink-muted">{combo.restaurant.name}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: "bundle",
                label: "Bundle",
                render: (combo) => (
                  <div>
                    <p className="font-semibold text-ink">{combo.items.length} included items</p>
                    <p className="text-xs text-ink-muted">
                      {combo.items.map((item) => item.menuItem.name).join(", ")}
                    </p>
                  </div>
                ),
              },
              {
                key: "pricing",
                label: "Pricing",
                render: (combo) => (
                  <div>
                    <p className="font-semibold text-ink">{formatCurrency(combo.basePrice)}</p>
                    <p className="text-xs text-ink-muted">
                      {combo.offerPrice ? `Offer ${formatCurrency(combo.offerPrice)}` : "No offer price"}
                    </p>
                  </div>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (combo) => (
                  <div className="space-y-2">
                    <StatusPill
                      label={combo.isActive ? "Active" : "Inactive"}
                      tone={getToneForStatus(combo.isActive)}
                    />
                    <StatusPill
                      label={combo.isAvailable ? "Available" : "Unavailable"}
                      tone={getToneForStatus(combo.isAvailable)}
                    />
                  </div>
                ),
              },
              {
                key: "actions",
                label: "Actions",
                render: (combo) => (
                  <RowActions onEdit={() => openEditModal(combo)} onDelete={() => setDeleteTarget(combo)} />
                ),
              },
            ]}
          />
          {filteredCombos.length > PAGE_SIZE ? (
            <Pagination
              page={pagedCombos.currentPage}
              totalPages={pagedCombos.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCombo ? "Edit combo" : "Add combo"}
        className="max-w-4xl"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Restaurant"
              value={form.restaurantId}
              onChange={(event) =>
                setForm({
                  ...form,
                  restaurantId: event.target.value,
                  items: form.items.filter((item) =>
                    menuItems.some(
                      (menuItem) =>
                        menuItem.id === item.menuItemId &&
                        String(menuItem.restaurantId) === event.target.value,
                    ),
                  ),
                })
              }
              required
            >
              <option value="">Select restaurant</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </Select>
            <Input
              label="Combo name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
            <Input
              label="Base price"
              type="number"
              min="0"
              value={form.basePrice}
              onChange={(event) => setForm({ ...form, basePrice: event.target.value })}
              required
            />
            <Input
              label="Offer price"
              type="number"
              min="0"
              value={form.offerPrice}
              onChange={(event) => setForm({ ...form, offerPrice: event.target.value })}
            />
            <Input
              label="Category tag"
              value={form.categoryTag}
              onChange={(event) => setForm({ ...form, categoryTag: event.target.value })}
            />
            <Input
              label="Image URL"
              value={form.image}
              onChange={(event) => setForm({ ...form, image: event.target.value })}
            />
          </div>

          <Textarea
            label="Description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />

          <SurfaceCard className="space-y-4">
            <SectionHeading
              title="Included items"
              description="Choose dishes from the selected restaurant and set the combo quantities."
            />
            <div className="flex flex-wrap gap-2">
              {restaurantMenuItems.map((item) => {
                const isSelected = form.items.some((comboItem) => comboItem.menuItemId === item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleComboItem(item.id)}
                    className={
                      isSelected
                        ? "rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-soft"
                        : "rounded-full border border-accent/15 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft shadow-soft"
                    }
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>

            {selectedItems.length ? (
              <div className="grid gap-3">
                {selectedItems.map((item) => (
                  <div
                    key={item.menuItemId}
                    className="grid gap-3 rounded-[1.5rem] bg-cream px-4 py-4 md:grid-cols-[1fr_140px]"
                  >
                    <div>
                      <p className="font-semibold text-ink">{item.menuItem?.name}</p>
                      <p className="text-xs text-ink-muted">
                        {item.menuItem?.category.name} • {formatCurrency(item.menuItem?.price ?? 0)}
                      </p>
                    </div>
                    <Input
                      label="Quantity"
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) => updateComboItemQuantity(item.menuItemId, event.target.value)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-accent/15 bg-white/50 px-4 py-5 text-sm text-ink-soft">
                Select at least one menu item to define the combo bundle.
              </div>
            )}
          </SurfaceCard>

          <div className="grid gap-4 md:grid-cols-2">
            <ToggleField
              label="Available for ordering"
              checked={form.isAvailable}
              onChange={(checked) => setForm({ ...form, isAvailable: checked })}
            />
            <ToggleField
              label="Active on your menu"
              checked={form.isActive}
              onChange={(checked) => setForm({ ...form, isActive: checked })}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingCombo ? "Save changes" : "Create combo"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDangerModal
        open={Boolean(deleteTarget)}
        title="Delete combo"
        description="This permanently removes the combo and its bundled item mapping from your restaurant."
        confirmLabel="Delete combo"
        isSubmitting={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteCombo()}
      />
    </div>
  );
};
