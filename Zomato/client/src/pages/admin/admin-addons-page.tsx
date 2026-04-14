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
import { SectionHeading, StatusPill } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createAddon,
  deleteAddon,
  getAddons,
  getCombos,
  getMenuItems,
  getRestaurants,
  updateAddon,
  type AdminAddon,
  type AdminCombo,
  type AdminMenuItem,
  type AdminRestaurant,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  ADDON_TYPES,
  AddButton,
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

type AddonFormState = {
  restaurantId: string;
  parentType: "MENU_ITEM" | "COMBO";
  parentId: string;
  name: string;
  description: string;
  addonType: string;
  price: string;
  isActive: boolean;
};

const emptyForm = (restaurantId = ""): AddonFormState => ({
  restaurantId,
  parentType: "MENU_ITEM",
  parentId: "",
  name: "",
  description: "",
  addonType: "EXTRA",
  price: "",
  isActive: true,
});

export const AdminAddonsPage = () => {
  const [addons, setAddons] = useState<AdminAddon[]>([]);
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([]);
  const [menuItems, setMenuItems] = useState<AdminMenuItem[]>([]);
  const [combos, setCombos] = useState<AdminCombo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [restaurantFilter, setRestaurantFilter] = useState("ALL");
  const [parentFilter, setParentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [editingAddon, setEditingAddon] = useState<AdminAddon | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAddon | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState<AddonFormState>(emptyForm());

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [addonRows, restaurantRows, menuItemRows, comboRows] = await Promise.all([
        getAddons(),
        getRestaurants(),
        getMenuItems(),
        getCombos(),
      ]);
      setAddons(addonRows);
      setRestaurants(restaurantRows);
      setMenuItems(menuItemRows);
      setCombos(comboRows);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load addons."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const availableMenuItems = useMemo(
    () => menuItems.filter((item) => String(item.restaurantId) === form.restaurantId),
    [form.restaurantId, menuItems],
  );

  const availableCombos = useMemo(
    () => combos.filter((combo) => String(combo.restaurantId) === form.restaurantId),
    [combos, form.restaurantId],
  );

  const openCreateModal = () => {
    setEditingAddon(null);
    setForm(emptyForm(restaurants[0] ? String(restaurants[0].id) : ""));
    setIsModalOpen(true);
  };

  const openEditModal = (addon: AdminAddon) => {
    setEditingAddon(addon);
    setForm({
      restaurantId: String(addon.restaurantId),
      parentType: addon.comboId ? "COMBO" : "MENU_ITEM",
      parentId: String(addon.comboId ?? addon.menuItemId ?? ""),
      name: addon.name,
      description: addon.description ?? "",
      addonType: addon.addonType,
      price: String(addon.price),
      isActive: addon.isActive,
    });
    setIsModalOpen(true);
  };

  const filteredAddons = addons.filter((addon) => {
    const haystack = `${addon.name} ${addon.restaurant.name} ${addon.menuItem?.name ?? ""} ${addon.combo?.name ?? ""}`;

    return (
      (!search || matchesSearch(haystack, search)) &&
      (restaurantFilter === "ALL" || String(addon.restaurantId) === restaurantFilter) &&
      (parentFilter === "ALL" ||
        (parentFilter === "MENU_ITEM" && Boolean(addon.menuItemId)) ||
        (parentFilter === "COMBO" && Boolean(addon.comboId))) &&
      (statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && addon.isActive) ||
        (statusFilter === "INACTIVE" && !addon.isActive))
    );
  });

  const pagedAddons = paginate(filteredAddons, page);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.restaurantId || !form.parentId) {
      toast.error("Choose a restaurant and assign the addon to a dish or combo.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name,
        description: form.description.trim() || undefined,
        addonType: form.addonType,
        price: Number(form.price || "0"),
        isActive: form.isActive,
        ...(form.parentType === "MENU_ITEM"
          ? { menuItemId: Number(form.parentId) }
          : { comboId: Number(form.parentId) }),
      };

      if (editingAddon) {
        await updateAddon(editingAddon.id, payload);
        toast.success("Addon updated successfully.");
      } else {
        await createAddon(payload);
        toast.success("Addon created successfully.");
      }

      setIsModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save this addon."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAddon = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAddon(deleteTarget.id);
      toast.success("Addon deleted successfully.");
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to delete this addon."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Addons"
        title="Richer upsells across dishes and combos."
        description="Manage extras, upgrades, dips, drinks, sides, and dessert upsells without touching existing dish inventory."
        action={
          <div className="flex gap-3">
            <RefreshButton onClick={() => void loadData()} />
            <AddButton label="Add addon" onClick={openCreateModal} />
          </div>
        }
      />

      <AdminToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by addon, restaurant, dish, or combo"
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
              <option value="ALL">All restaurants</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </Select>
            <Select
              value={parentFilter}
              onChange={(event) => {
                setParentFilter(event.target.value);
                setPage(1);
              }}
              className="min-w-[180px]"
            >
              <option value="ALL">All parents</option>
              <option value="MENU_ITEM">Dish addons</option>
              <option value="COMBO">Combo addons</option>
            </Select>
            <Select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="min-w-[180px]"
            >
              <option value="ALL">All statuses</option>
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
            rows={pagedAddons.items}
            getRowKey={(addon) => addon.id}
            emptyTitle="No addons found"
            emptyDescription="Create a new addon or relax the active filters."
            columns={[
              {
                key: "addon",
                label: "Addon",
                render: (addon) => (
                  <div>
                    <p className="font-semibold text-ink">{addon.name}</p>
                    <p className="text-xs text-ink-muted">{addon.restaurant.name}</p>
                  </div>
                ),
              },
              {
                key: "parent",
                label: "Assigned to",
                render: (addon) => (
                  <div>
                    <p className="font-semibold text-ink">{addon.combo?.name ?? addon.menuItem?.name ?? "Unassigned"}</p>
                    <p className="text-xs text-ink-muted">
                      {addon.combo ? "Combo addon" : "Dish addon"}
                    </p>
                  </div>
                ),
              },
              {
                key: "type",
                label: "Type",
                render: (addon) => (
                  <div>
                    <p className="font-semibold text-ink">{toLabel(addon.addonType)}</p>
                    <p className="text-xs text-ink-muted">{formatCurrency(addon.price)}</p>
                  </div>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (addon) => (
                  <StatusPill
                    label={addon.isActive ? "Active" : "Inactive"}
                    tone={getToneForStatus(addon.isActive)}
                  />
                ),
              },
              {
                key: "actions",
                label: "Actions",
                render: (addon) => (
                  <RowActions onEdit={() => openEditModal(addon)} onDelete={() => setDeleteTarget(addon)} />
                ),
              },
            ]}
          />
          {filteredAddons.length > PAGE_SIZE ? (
            <Pagination
              page={pagedAddons.currentPage}
              totalPages={pagedAddons.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAddon ? "Edit addon" : "Add addon"}
        className="max-w-3xl"
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
                  parentId: "",
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
            <Select
              label="Parent type"
              value={form.parentType}
              onChange={(event) =>
                setForm({
                  ...form,
                  parentType: event.target.value as "MENU_ITEM" | "COMBO",
                  parentId: "",
                })
              }
            >
              <option value="MENU_ITEM">Dish addon</option>
              <option value="COMBO">Combo addon</option>
            </Select>
            <Select
              label={form.parentType === "MENU_ITEM" ? "Dish" : "Combo"}
              value={form.parentId}
              onChange={(event) => setForm({ ...form, parentId: event.target.value })}
              required
            >
              <option value="">
                {form.parentType === "MENU_ITEM" ? "Select dish" : "Select combo"}
              </option>
              {(form.parentType === "MENU_ITEM" ? availableMenuItems : availableCombos).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
            <Input
              label="Addon name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
            <Select
              label="Addon type"
              value={form.addonType}
              onChange={(event) => setForm({ ...form, addonType: event.target.value })}
            >
              {ADDON_TYPES.map((addonType) => (
                <option key={addonType} value={addonType}>
                  {toLabel(addonType)}
                </option>
              ))}
            </Select>
            <Input
              label="Price"
              type="number"
              min="0"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
              required
            />
          </div>

          <Textarea
            label="Description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />

          <ToggleField
            label="Addon is active"
            checked={form.isActive}
            onChange={(checked) => setForm({ ...form, isActive: checked })}
          />

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
              {isSubmitting ? "Saving..." : editingAddon ? "Save changes" : "Create addon"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDangerModal
        open={Boolean(deleteTarget)}
        title="Delete addon"
        description="This permanently removes the addon from its assigned dish or combo."
        confirmLabel="Delete addon"
        isSubmitting={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteAddon()}
      />
    </div>
  );
};
