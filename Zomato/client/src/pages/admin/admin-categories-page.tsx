import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AdminDataTable,
  AdminLoadingState,
  ConfirmDangerModal,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SectionHeading, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createCuisine,
  createMenuCategory,
  createRestaurantCategory,
  deleteCuisine,
  deleteMenuCategory,
  deleteRestaurantCategory,
  getLookups,
  getMenuCategories,
  getRestaurants,
  updateCuisine,
  updateMenuCategory,
  updateRestaurantCategory,
  type AdminRestaurant,
  type Lookups,
  type MenuCategory,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  AddButton,
  RefreshButton,
  RowActions,
  ToggleField,
} from "./admin-shared";

export const AdminCategoriesPage = () => {
  const [lookups, setLookups] = useState<Lookups>({ cuisines: [], restaurantCategories: [] });
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLookupSaving, setIsLookupSaving] = useState(false);
  const [isLookupDeleting, setIsLookupDeleting] = useState(false);
  const [lookupModal, setLookupModal] = useState<{ kind: "cuisine" | "restaurantCategory" | "menuCategory"; id?: number } | null>(null);
  const [lookupForm, setLookupForm] = useState({ name: "", description: "", restaurantId: "", isActive: true, sortOrder: "0" });
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "cuisine" | "restaurantCategory" | "menuCategory"; id: number } | null>(null);

  const loadCoreData = async () => {
    setIsLoading(true);
    try {
      const [lookupRows, restaurantRows] = await Promise.all([getLookups(), getRestaurants()]);
      setLookups(lookupRows);
      setRestaurants(restaurantRows);
      if (!selectedRestaurantId && restaurantRows[0]) {
        setSelectedRestaurantId(String(restaurantRows[0].id));
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load categories and cuisines."));
    } finally {
      setIsLoading(false);
    }
  };

  const loadMenuCategoryRows = async (restaurantId: number) => {
    try {
      setMenuCategories(await getMenuCategories(restaurantId));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load menu categories."));
    }
  };

  useEffect(() => {
    void loadCoreData();
  }, []);

  useEffect(() => {
    const restaurantId = Number(selectedRestaurantId);
    if (!restaurantId) {
      setMenuCategories([]);
      return;
    }
    void loadMenuCategoryRows(restaurantId);
  }, [selectedRestaurantId]);

  const openLookupModal = (kind: "cuisine" | "restaurantCategory" | "menuCategory", values?: { id?: number; name?: string; description?: string | null; isActive?: boolean; sortOrder?: number; restaurantId?: number }) => {
    setLookupModal({ kind, id: values?.id });
    setLookupForm({ name: values?.name ?? "", description: values?.description ?? "", restaurantId: values?.restaurantId ? String(values.restaurantId) : selectedRestaurantId, isActive: values?.isActive ?? true, sortOrder: values?.sortOrder !== undefined ? String(values.sortOrder) : "0" });
  };

  const handleSaveLookup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lookupModal) return;
    setIsLookupSaving(true);
    try {
      if (lookupModal.kind === "cuisine") {
        if (lookupModal.id) {
          await updateCuisine(lookupModal.id, { name: lookupForm.name });
        } else {
          await createCuisine({ name: lookupForm.name });
        }
        setLookups(await getLookups());
      }

      if (lookupModal.kind === "restaurantCategory") {
        if (lookupModal.id) {
          await updateRestaurantCategory(lookupModal.id, { name: lookupForm.name, description: lookupForm.description.trim() || undefined });
        } else {
          await createRestaurantCategory({ name: lookupForm.name, description: lookupForm.description.trim() || undefined });
        }
        setLookups(await getLookups());
      }

      if (lookupModal.kind === "menuCategory") {
        const payload = { restaurantId: Number(lookupForm.restaurantId), name: lookupForm.name, description: lookupForm.description.trim() || undefined, isActive: lookupForm.isActive, sortOrder: Number(lookupForm.sortOrder || "0") };
        if (lookupModal.id) {
          await updateMenuCategory(lookupModal.id, payload);
        } else {
          await createMenuCategory(payload);
        }
        await loadMenuCategoryRows(Number(lookupForm.restaurantId));
      }

      toast.success("Category saved successfully.");
      setLookupModal(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save this category."));
    } finally {
      setIsLookupSaving(false);
    }
  };

  const handleDeleteLookup = async () => {
    if (!deleteTarget) return;
    setIsLookupDeleting(true);
    try {
      if (deleteTarget.kind === "cuisine") {
        await deleteCuisine(deleteTarget.id);
        setLookups(await getLookups());
      }
      if (deleteTarget.kind === "restaurantCategory") {
        await deleteRestaurantCategory(deleteTarget.id);
        setLookups(await getLookups());
      }
      if (deleteTarget.kind === "menuCategory") {
        await deleteMenuCategory(deleteTarget.id);
        await loadMenuCategoryRows(Number(selectedRestaurantId));
      }
      toast.success("Category deleted successfully.");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to delete this category."));
    } finally {
      setIsLookupDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Categories and cuisines" title="Global and menu-level classification management." description="Admin can manage cuisines, restaurant categories, and menu categories while keeping restaurant data tidy." action={<RefreshButton onClick={() => void loadCoreData()} />} />

      {isLoading ? <AdminLoadingState /> : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <SurfaceCard className="space-y-5">
              <SectionHeading title="Cuisines" description="Global cuisine options available across partner storefronts." action={<AddButton label="Add cuisine" onClick={() => openLookupModal("cuisine")} />} />
              <AdminDataTable rows={lookups.cuisines} getRowKey={(item) => item.id} emptyTitle="No cuisines yet" emptyDescription="Add the first cuisine lookup." columns={[{ key: "name", label: "Cuisine", render: (item) => <span className="font-semibold text-ink">{item.name}</span> }, { key: "actions", label: "Actions", render: (item) => <RowActions onEdit={() => openLookupModal("cuisine", item)} onDelete={() => setDeleteTarget({ kind: "cuisine", id: item.id })} /> }]} />
            </SurfaceCard>

            <SurfaceCard className="space-y-5">
              <SectionHeading title="Restaurant categories" description="Top-level partner classifications such as Fine Dining or Cafe." action={<AddButton label="Add category" onClick={() => openLookupModal("restaurantCategory")} />} />
              <AdminDataTable rows={lookups.restaurantCategories} getRowKey={(item) => item.id} emptyTitle="No restaurant categories yet" emptyDescription="Add your first restaurant category." columns={[{ key: "name", label: "Category", render: (item) => <div><p className="font-semibold text-ink">{item.name}</p><p className="text-xs text-ink-muted">{item.description ?? "No description"}</p></div> }, { key: "actions", label: "Actions", render: (item) => <RowActions onEdit={() => openLookupModal("restaurantCategory", item)} onDelete={() => setDeleteTarget({ kind: "restaurantCategory", id: item.id })} /> }]} />
            </SurfaceCard>
          </div>

          <SurfaceCard className="space-y-5">
            <SectionHeading title="Menu categories" description="Restaurant-level menu organization for dishes and sections." action={<div className="flex gap-3"><Select value={selectedRestaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)} className="min-w-[240px]">{restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</Select><AddButton label="Add menu category" onClick={() => openLookupModal("menuCategory")} /></div>} />
            {selectedRestaurantId ? (
              <AdminDataTable rows={menuCategories} getRowKey={(item) => item.id} emptyTitle="No menu categories yet" emptyDescription="Create categories for this restaurant's menu." columns={[{ key: "name", label: "Category", render: (item) => <div><p className="font-semibold text-ink">{item.name}</p><p className="text-xs text-ink-muted">{item.description ?? "No description"}</p></div> }, { key: "meta", label: "Sort and status", render: (item) => <div><p className="font-semibold text-ink">Sort {item.sortOrder}</p><p className="text-xs text-ink-muted">{item.isActive ? "Visible" : "Hidden"}</p></div> }, { key: "actions", label: "Actions", render: (item) => <RowActions onEdit={() => openLookupModal("menuCategory", { ...item, restaurantId: item.restaurantId })} onDelete={() => setDeleteTarget({ kind: "menuCategory", id: item.id })} /> }]} />
            ) : (
              <EmptyState title="Pick a restaurant first" description="Choose a restaurant to manage its menu categories." />
            )}
          </SurfaceCard>
        </>
      )}

      <Modal open={Boolean(lookupModal)} onClose={() => setLookupModal(null)} title={lookupModal?.kind === "cuisine" ? "Cuisine" : lookupModal?.kind === "restaurantCategory" ? "Restaurant category" : "Menu category"}>
        <form className="space-y-4" onSubmit={handleSaveLookup}>
          {lookupModal?.kind === "menuCategory" ? (
            <Select label="Restaurant" value={lookupForm.restaurantId} onChange={(event) => setLookupForm({ ...lookupForm, restaurantId: event.target.value })}>
              {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
            </Select>
          ) : null}
          <Input label="Name" value={lookupForm.name} onChange={(event) => setLookupForm({ ...lookupForm, name: event.target.value })} required />
          {lookupModal?.kind !== "cuisine" ? <Textarea label="Description" value={lookupForm.description} onChange={(event) => setLookupForm({ ...lookupForm, description: event.target.value })} /> : null}
          {lookupModal?.kind === "menuCategory" ? <><Input label="Sort order" type="number" min="0" value={lookupForm.sortOrder} onChange={(event) => setLookupForm({ ...lookupForm, sortOrder: event.target.value })} /><ToggleField label="Category is active" checked={lookupForm.isActive} onChange={(checked) => setLookupForm({ ...lookupForm, isActive: checked })} /></> : null}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setLookupModal(null)} disabled={isLookupSaving}>Cancel</Button>
            <Button type="submit" disabled={isLookupSaving}>{isLookupSaving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDangerModal open={Boolean(deleteTarget)} title="Delete category" description="This permanently deletes the selected category entry and removes it from connected data where supported." confirmLabel="Delete" isSubmitting={isLookupDeleting} onClose={() => setDeleteTarget(null)} onConfirm={() => void handleDeleteLookup()} />
    </div>
  );
};
