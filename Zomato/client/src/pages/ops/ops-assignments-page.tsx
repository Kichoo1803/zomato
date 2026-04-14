import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminDataTable, AdminLoadingState, AdminToolbar } from "@/components/admin/admin-ui";
import { DashboardStatCard } from "@/components/ui/dashboard-stat-card";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/auth";
import { getDistrictOptions, mergeRegionOptions } from "@/lib/india-regions";
import {
  getOperationsDeliveryPartners,
  getOperationsOwners,
  getOperationsRegions,
  updateOperationsAssignment,
  type OperationsDeliveryPartner,
  type OperationsOwner,
} from "@/lib/ops";
import {
  PAGE_SIZE,
  RefreshButton,
  RowActions,
  getToneForStatus,
  paginate,
  toLabel,
} from "@/pages/admin/admin-shared";
import { OperationsAssignmentModal } from "./ops-shared";

type AssignmentTarget =
  | (OperationsOwner & { targetType: "OWNER" })
  | (OperationsDeliveryPartner & { targetType: "PARTNER" });

export const OpsAssignmentsPage = () => {
  const [owners, setOwners] = useState<OperationsOwner[]>([]);
  const [partners, setPartners] = useState<OperationsDeliveryPartner[]>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getOperationsRegions>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("UNASSIGNED");
  const [ownerPage, setOwnerPage] = useState(1);
  const [partnerPage, setPartnerPage] = useState(1);
  const [assignmentTarget, setAssignmentTarget] = useState<AssignmentTarget | null>(null);

  const loadAssignments = async () => {
    setIsLoading(true);
    try {
      const [ownerRows, partnerRows, regions] = await Promise.all([
        getOperationsOwners({
          search: search || undefined,
          state: stateFilter || undefined,
          district: districtFilter || undefined,
          assignmentStatus: assignmentFilter === "ALL" ? undefined : assignmentFilter,
        }),
        getOperationsDeliveryPartners({
          search: search || undefined,
          state: stateFilter || undefined,
          district: districtFilter || undefined,
          assignmentStatus: assignmentFilter === "ALL" ? undefined : assignmentFilter,
        }),
        getOperationsRegions({
          state: stateFilter || undefined,
          district: districtFilter || undefined,
        }),
      ]);
      setOwners(ownerRows);
      setPartners(partnerRows);
      setSummary(regions);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load the assignments view."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAssignments();
  }, [search, stateFilter, districtFilter, assignmentFilter]);

  const regionOptions = useMemo(() => mergeRegionOptions(summary?.regionOptions), [summary?.regionOptions]);
  const districtOptions = useMemo(
    () => getDistrictOptions(stateFilter, summary?.regionOptions),
    [summary?.regionOptions, stateFilter],
  );
  const pagedOwners = paginate(owners, ownerPage);
  const pagedPartners = paginate(partners, partnerPage);

  const handleSaveAssignment = async (payload: { state?: string; district?: string; notes?: string }) => {
    if (!assignmentTarget) {
      return;
    }

    setIsSaving(true);
    try {
      await updateOperationsAssignment(assignmentTarget.id, payload);
      toast.success("Assignment updated successfully.");
      setAssignmentTarget(null);
      await loadAssignments();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update this assignment."));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !summary) {
    return <AdminLoadingState rows={6} />;
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Assignments"
        title="Fix region mapping gaps without leaving operations."
        description="Map owners and delivery partners into the right India state and district hierarchy, and keep assignment remarks close to the workflow."
        action={<RefreshButton onClick={() => void loadAssignments()} />}
      />

      <AdminToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setOwnerPage(1);
          setPartnerPage(1);
        }}
        searchPlaceholder="Search owners, riders, restaurants, vehicles, or notes"
        filters={
          <>
            <Select value={stateFilter} onChange={(event) => { setStateFilter(event.target.value); setDistrictFilter(""); }} className="min-w-[180px]">
              <option value="">All states</option>
              {regionOptions.states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
            <Select value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)} className="min-w-[180px]" disabled={!stateFilter}>
              <option value="">{stateFilter ? "All districts" : "Choose a state first"}</option>
              {districtOptions.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </Select>
            <Select value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)} className="min-w-[180px]">
              <option value="ALL">All assignment states</option>
              <option value="UNASSIGNED">Unassigned</option>
              <option value="PARTIAL">District pending</option>
              <option value="ASSIGNED">Fully assigned</option>
            </Select>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <DashboardStatCard label="Unassigned owners" value={summary.stats.unassignedOwnersCount.toString()} hint="Need region mapping" />
        <DashboardStatCard label="Unassigned partners" value={summary.stats.unassignedPartnersCount.toString()} hint="Need region mapping" />
        <DashboardStatCard label="Fully assigned" value={summary.stats.fullyAssignedCount.toString()} hint="State + district completed" />
        <DashboardStatCard label="Tracked regions" value={summary.stats.districtsCount.toString()} hint="District entries in the current view" />
      </div>

      <SurfaceCard className="space-y-5">
        <SectionHeading title="Restaurant owner assignments" description="Owners grouped through the same regional coordination workflow." />
        <AdminDataTable
          rows={pagedOwners.items}
          getRowKey={(owner) => owner.id}
          emptyTitle="No owner assignment gaps"
          emptyDescription="Owner assignments in this view already match the selected filters."
          columns={[
            {
              key: "owner",
              label: "Owner",
              render: (owner) => (
                <div>
                  <p className="font-semibold text-ink">{owner.fullName}</p>
                  <p className="text-xs text-ink-muted">{owner.email}</p>
                </div>
              ),
            },
            {
              key: "restaurants",
              label: "Restaurants",
              render: (owner) => (
                <p className="text-sm text-ink-soft">
                  {owner.restaurants.slice(0, 2).map((restaurant) => restaurant.name).join(", ") || "No linked restaurants"}
                </p>
              ),
            },
            {
              key: "assignment",
              label: "Assignment",
              render: (owner) => (
                <div className="space-y-2">
                  <p className="font-semibold text-ink">
                    {[owner.opsState, owner.opsDistrict].filter(Boolean).join(" • ") || "Not assigned"}
                  </p>
                  <StatusPill label={toLabel(owner.assignmentStatus)} tone={getToneForStatus(owner.assignmentStatus)} />
                </div>
              ),
            },
            {
              key: "actions",
              label: "Actions",
              render: (owner) => (
                <RowActions onEdit={() => setAssignmentTarget({ ...owner, targetType: "OWNER" })} deleteLabel="Assign" />
              ),
            },
          ]}
        />
        {owners.length > PAGE_SIZE ? (
          <Pagination page={pagedOwners.currentPage} totalPages={pagedOwners.totalPages} onPageChange={setOwnerPage} />
        ) : null}
      </SurfaceCard>

      <SurfaceCard className="space-y-5">
        <SectionHeading title="Delivery partner assignments" description="Rider coverage can be fixed from the same region queue." />
        <AdminDataTable
          rows={pagedPartners.items}
          getRowKey={(partner) => partner.id}
          emptyTitle="No partner assignment gaps"
          emptyDescription="Delivery partner assignments in this view already match the selected filters."
          columns={[
            {
              key: "partner",
              label: "Partner",
              render: (partner) => (
                <div>
                  <p className="font-semibold text-ink">{partner.fullName}</p>
                  <p className="text-xs text-ink-muted">{partner.email}</p>
                </div>
              ),
            },
            {
              key: "vehicle",
              label: "Vehicle",
              render: (partner) => (
                <div>
                  <p className="font-semibold text-ink">{toLabel(partner.deliveryProfile.vehicleType)}</p>
                  <p className="text-xs text-ink-muted">{partner.deliveryProfile.vehicleNumber ?? "No number available"}</p>
                </div>
              ),
            },
            {
              key: "assignment",
              label: "Assignment",
              render: (partner) => (
                <div className="space-y-2">
                  <p className="font-semibold text-ink">
                    {[partner.opsState, partner.opsDistrict].filter(Boolean).join(" • ") || "Not assigned"}
                  </p>
                  <StatusPill label={toLabel(partner.assignmentStatus)} tone={getToneForStatus(partner.assignmentStatus)} />
                </div>
              ),
            },
            {
              key: "actions",
              label: "Actions",
              render: (partner) => (
                <RowActions onEdit={() => setAssignmentTarget({ ...partner, targetType: "PARTNER" })} deleteLabel="Assign" />
              ),
            },
          ]}
        />
        {partners.length > PAGE_SIZE ? (
          <Pagination page={pagedPartners.currentPage} totalPages={pagedPartners.totalPages} onPageChange={setPartnerPage} />
        ) : null}
      </SurfaceCard>

      <OperationsAssignmentModal
        open={Boolean(assignmentTarget)}
        target={assignmentTarget}
        regionOptions={summary.regionOptions}
        isSubmitting={isSaving}
        onClose={() => setAssignmentTarget(null)}
        onSubmit={(payload) => void handleSaveAssignment(payload)}
      />
    </div>
  );
};
