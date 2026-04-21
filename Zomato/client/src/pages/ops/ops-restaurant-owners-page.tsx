import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AdminDataTable,
  AdminDetailsGrid,
  AdminLoadingState,
  AdminToolbar,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { getApiErrorMessage } from "@/lib/auth";
import { getDistrictOptions, mergeRegionOptions } from "@/lib/india-regions";
import {
  createOperationsOwner,
  getOperationsOwners,
  getOperationsRegions,
  updateOperationsAssignment,
  type OperationsOwner,
} from "@/lib/ops";
import {
  AddButton,
  PAGE_SIZE,
  RefreshButton,
  RowActions,
  formatDateTime,
  getToneForStatus,
  paginate,
} from "@/pages/admin/admin-shared";
import { OperationsAssignmentModal } from "./ops-shared";

export const OpsRestaurantOwnersPage = () => {
  const { user } = useAuth();
  const [owners, setOwners] = useState<OperationsOwner[]>([]);
  const [regionOptions, setRegionOptions] = useState<{ states: string[]; districtsByState: Record<string, string[]> } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [assignmentFilter, setAssignmentFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [detailsOwner, setDetailsOwner] = useState<OperationsOwner | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<OperationsOwner | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    profileImage: "",
    state: "",
    district: "",
    notes: "",
  });
  const canCreateOwners = user?.role === "ADMIN" || user?.role === "REGIONAL_MANAGER";

  const loadOwners = async () => {
    setIsLoading(true);
    try {
      const [ownerRows, regions] = await Promise.all([
        getOperationsOwners({
          search: search || undefined,
          state: stateFilter || undefined,
          district: districtFilter || undefined,
          status: statusFilter === "ALL" ? undefined : statusFilter,
          assignmentStatus: assignmentFilter === "ALL" ? undefined : assignmentFilter,
        }),
        getOperationsRegions(),
      ]);
      setOwners(ownerRows);
      setRegionOptions(regions.regionOptions);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load restaurant owners."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOwners();
  }, [search, stateFilter, districtFilter, statusFilter, assignmentFilter]);

  const mergedOptions = useMemo(() => mergeRegionOptions(regionOptions), [regionOptions]);
  const districtOptions = useMemo(() => getDistrictOptions(stateFilter, regionOptions), [regionOptions, stateFilter]);
  const createDistrictOptions = useMemo(
    () => getDistrictOptions(createForm.state, regionOptions),
    [createForm.state, regionOptions],
  );
  const pagedOwners = paginate(owners, page);

  const openCreateModal = () => {
    const nextState = stateFilter || (mergedOptions.states.length === 1 ? mergedOptions.states[0] : "");
    const nextDistrict =
      districtFilter ||
      (nextState && getDistrictOptions(nextState, regionOptions).length === 1
        ? getDistrictOptions(nextState, regionOptions)[0]
        : "");

    setCreateForm({
      fullName: "",
      email: "",
      phone: "",
      password: "",
      profileImage: "",
      state: nextState,
      district: nextDistrict,
      notes: "",
    });
    setIsCreateModalOpen(true);
  };

  const handleSaveAssignment = async (payload: { state?: string; district?: string; notes?: string }) => {
    if (!assignmentTarget) {
      return;
    }

    setIsSaving(true);
    try {
      await updateOperationsAssignment(assignmentTarget.id, payload);
      toast.success("Owner assignment updated successfully.");
      setAssignmentTarget(null);
      await loadOwners();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update this owner assignment."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateOwner = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!createForm.state || !createForm.district) {
      toast.error("Select both a state and district before creating an owner.");
      return;
    }

    setIsCreating(true);
    try {
      await createOperationsOwner({
        fullName: createForm.fullName,
        email: createForm.email,
        phone: createForm.phone.trim() || undefined,
        password: createForm.password,
        profileImage: createForm.profileImage.trim() || undefined,
        state: createForm.state,
        district: createForm.district,
        notes: createForm.notes.trim() || undefined,
      });
      toast.success("Restaurant owner created successfully.");
      setIsCreateModalOpen(false);
      await loadOwners();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to create this restaurant owner."));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Restaurant owners"
        title="Owner coverage by state and district."
        description="Filter restaurant owners through the India region hierarchy, review linked restaurants, and update operational assignments safely."
        action={
          <div className="flex gap-3">
            <RefreshButton onClick={() => void loadOwners()} />
            {canCreateOwners ? <AddButton label="Add owner" onClick={openCreateModal} /> : null}
          </div>
        }
      />

      <AdminToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by owner, email, phone, restaurant, city, or area"
        filters={
          <>
            <Select value={stateFilter} onChange={(event) => { setStateFilter(event.target.value); setDistrictFilter(""); setPage(1); }} className="min-w-[180px]">
              <option value="">All states</option>
              {mergedOptions.states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
            <Select value={districtFilter} onChange={(event) => { setDistrictFilter(event.target.value); setPage(1); }} className="min-w-[180px]" disabled={!stateFilter}>
              <option value="">{stateFilter ? "All districts" : "Choose a state first"}</option>
              {districtOptions.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </Select>
            <Select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="min-w-[180px]">
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active accounts</option>
              <option value="INACTIVE">Inactive accounts</option>
            </Select>
            <Select value={assignmentFilter} onChange={(event) => { setAssignmentFilter(event.target.value); setPage(1); }} className="min-w-[180px]">
              <option value="ALL">All assignments</option>
              <option value="ASSIGNED">Fully assigned</option>
              <option value="PARTIAL">District pending</option>
              <option value="UNASSIGNED">Unassigned</option>
            </Select>
          </>
        }
      />

      {isLoading ? (
        <AdminLoadingState />
      ) : (
        <>
          <AdminDataTable
            rows={pagedOwners.items}
            getRowKey={(owner) => owner.id}
            emptyTitle="No restaurant owners found"
            emptyDescription="Broaden the filters or add new owner registrations from the operations workflow."
            columns={[
              {
                key: "owner",
                label: "Owner",
                render: (owner) => (
                  <div>
                    <p className="font-semibold text-ink">{owner.fullName}</p>
                    <p className="text-xs text-ink-muted">{owner.email}</p>
                    <p className="text-xs text-ink-muted">{owner.phone ?? "No phone available"}</p>
                  </div>
                ),
              },
              {
                key: "restaurants",
                label: "Linked restaurants",
                render: (owner) => (
                  <div>
                    <p className="font-semibold text-ink">{owner.restaurants.length} restaurant(s)</p>
                    <p className="text-xs text-ink-muted">
                      {owner.restaurants.slice(0, 2).map((restaurant) => restaurant.name).join(", ") || "No linked restaurants"}
                    </p>
                  </div>
                ),
              },
              {
                key: "region",
                label: "Region",
                render: (owner) => (
                  <div className="space-y-2">
                    <p className="font-semibold text-ink">
                      {[owner.opsState, owner.opsDistrict].filter(Boolean).join(" • ") || "Not assigned"}
                    </p>
                    <StatusPill label={owner.assignmentStatus.replace(/_/g, " ")} tone={getToneForStatus(owner.assignmentStatus)} />
                  </div>
                ),
              },
              {
                key: "status",
                label: "Operational status",
                render: (owner) => (
                  <div className="space-y-2">
                    <StatusPill label={owner.isActive ? "Active" : "Inactive"} tone={getToneForStatus(owner.isActive)} />
                    <p className="text-xs text-ink-muted">
                      {owner.restaurants.filter((restaurant) => restaurant.isActive).length} active restaurant(s)
                    </p>
                  </div>
                ),
              },
              {
                key: "actions",
                label: "Actions",
                render: (owner) => (
                  <RowActions
                    onView={() => setDetailsOwner(owner)}
                    onEdit={() => setAssignmentTarget(owner)}
                    deleteLabel="Assign"
                  />
                ),
              },
            ]}
          />
          {owners.length > PAGE_SIZE ? (
            <Pagination page={pagedOwners.currentPage} totalPages={pagedOwners.totalPages} onPageChange={setPage} />
          ) : null}
        </>
      )}

      <Modal open={Boolean(detailsOwner)} onClose={() => setDetailsOwner(null)} title={detailsOwner?.fullName} className="max-w-4xl">
        {detailsOwner ? (
          <div className="space-y-5">
            <AdminDetailsGrid
              items={[
                { label: "Email", value: detailsOwner.email },
                { label: "Phone", value: detailsOwner.phone ?? "No phone available" },
                { label: "Region", value: [detailsOwner.opsState, detailsOwner.opsDistrict].filter(Boolean).join(" • ") || "Not assigned" },
                { label: "Assignment note", value: detailsOwner.opsNotes ?? "No operational note recorded yet." },
                { label: "Account status", value: detailsOwner.isActive ? "Active" : "Inactive" },
                { label: "Last login", value: formatDateTime(detailsOwner.lastLoginAt) },
              ]}
            />
            <SurfaceCard className="space-y-4">
              <SectionHeading title="Linked restaurants" description="Restaurant storefronts currently tied to this owner account." />
              {detailsOwner.restaurants.length ? (
                <div className="space-y-3">
                  {detailsOwner.restaurants.map((restaurant) => (
                    <div key={restaurant.id} className="rounded-[1.5rem] bg-cream px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{restaurant.name}</p>
                          <p className="text-xs text-ink-muted">
                            {[restaurant.area, restaurant.city, restaurant.state].filter(Boolean).join(", ")}
                          </p>
                        </div>
                        <StatusPill label={restaurant.isActive ? "Active" : "Inactive"} tone={getToneForStatus(restaurant.isActive)} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No linked restaurants" description="This owner does not have any restaurant records attached yet." />
              )}
            </SurfaceCard>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add restaurant owner"
        className="max-w-3xl"
      >
        <form className="space-y-4" onSubmit={handleCreateOwner}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Full name"
              value={createForm.fullName}
              onChange={(event) => setCreateForm({ ...createForm, fullName: event.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              value={createForm.email}
              onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
              required
            />
            <Input
              label="Phone"
              value={createForm.phone}
              onChange={(event) => setCreateForm({ ...createForm, phone: event.target.value })}
            />
            <Input
              label="Password"
              type="password"
              value={createForm.password}
              onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })}
              required
            />
            <Select
              label="State"
              value={createForm.state}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  state: event.target.value,
                  district: "",
                })
              }
              required
            >
              <option value="">Select state</option>
              {mergedOptions.states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
            <Select
              label="District"
              value={createForm.district}
              onChange={(event) => setCreateForm({ ...createForm, district: event.target.value })}
              disabled={!createForm.state}
              required
            >
              <option value="">{createForm.state ? "Select district" : "Choose a state first"}</option>
              {createDistrictOptions.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Profile image URL"
            value={createForm.profileImage}
            onChange={(event) => setCreateForm({ ...createForm, profileImage: event.target.value })}
          />
          <Textarea
            label="Operational notes"
            value={createForm.notes}
            onChange={(event) => setCreateForm({ ...createForm, notes: event.target.value })}
            placeholder="Capture onboarding context, launch notes, or regional handoff details."
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create owner"}
            </Button>
          </div>
        </form>
      </Modal>

      <OperationsAssignmentModal
        open={Boolean(assignmentTarget)}
        target={assignmentTarget}
        regionOptions={regionOptions}
        isSubmitting={isSaving}
        onClose={() => setAssignmentTarget(null)}
        onSubmit={(payload) => void handleSaveAssignment(payload)}
      />
    </div>
  );
};
