import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdminDataTable,
  AdminDetailsGrid,
  AdminLoadingState,
  AdminToolbar,
} from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/auth";
import { getDistrictOptions, mergeRegionOptions } from "@/lib/india-regions";
import {
  getOperationsOwners,
  getOperationsRegions,
  updateOperationsAssignment,
  type OperationsOwner,
} from "@/lib/ops";
import {
  PAGE_SIZE,
  RefreshButton,
  RowActions,
  formatDateTime,
  getToneForStatus,
  paginate,
} from "@/pages/admin/admin-shared";
import { OperationsAssignmentModal } from "./ops-shared";

export const OpsRestaurantOwnersPage = () => {
  const [owners, setOwners] = useState<OperationsOwner[]>([]);
  const [regionOptions, setRegionOptions] = useState<{ states: string[]; districtsByState: Record<string, string[]> } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [assignmentFilter, setAssignmentFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [detailsOwner, setDetailsOwner] = useState<OperationsOwner | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<OperationsOwner | null>(null);

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
        getOperationsRegions({
          state: stateFilter || undefined,
        }),
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
  const pagedOwners = paginate(owners, page);

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

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Restaurant owners"
        title="Owner coverage by state and district."
        description="Filter restaurant owners through the India region hierarchy, review linked restaurants, and update operational assignments safely."
        action={<RefreshButton onClick={() => void loadOwners()} />}
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
            emptyDescription="Broaden the filters or add new owner assignments from the operations workflow."
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
