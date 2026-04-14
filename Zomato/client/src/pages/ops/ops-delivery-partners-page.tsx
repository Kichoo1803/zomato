import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdminDataTable,
  AdminDetailsGrid,
  AdminLoadingState,
  AdminToolbar,
} from "@/components/admin/admin-ui";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading, StatusPill } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/auth";
import { getDistrictOptions, mergeRegionOptions } from "@/lib/india-regions";
import {
  getOperationsDeliveryPartners,
  getOperationsRegions,
  updateOperationsAssignment,
  type OperationsDeliveryPartner,
} from "@/lib/ops";
import {
  PAGE_SIZE,
  RefreshButton,
  RowActions,
  formatDateTime,
  getToneForStatus,
  paginate,
  toLabel,
} from "@/pages/admin/admin-shared";
import { OperationsAssignmentModal } from "./ops-shared";

export const OpsDeliveryPartnersPage = () => {
  const [partners, setPartners] = useState<OperationsDeliveryPartner[]>([]);
  const [regionOptions, setRegionOptions] = useState<{ states: string[]; districtsByState: Record<string, string[]> } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("ALL");
  const [assignmentFilter, setAssignmentFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [detailsPartner, setDetailsPartner] = useState<OperationsDeliveryPartner | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<OperationsDeliveryPartner | null>(null);

  const loadPartners = async () => {
    setIsLoading(true);
    try {
      const [partnerRows, regions] = await Promise.all([
        getOperationsDeliveryPartners({
          search: search || undefined,
          state: stateFilter || undefined,
          district: districtFilter || undefined,
          availabilityStatus: availabilityFilter === "ALL" ? undefined : availabilityFilter,
          assignmentStatus: assignmentFilter === "ALL" ? undefined : assignmentFilter,
        }),
        getOperationsRegions({
          state: stateFilter || undefined,
        }),
      ]);
      setPartners(partnerRows);
      setRegionOptions(regions.regionOptions);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load delivery partners."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPartners();
  }, [search, stateFilter, districtFilter, availabilityFilter, assignmentFilter]);

  const mergedOptions = useMemo(() => mergeRegionOptions(regionOptions), [regionOptions]);
  const districtOptions = useMemo(() => getDistrictOptions(stateFilter, regionOptions), [regionOptions, stateFilter]);
  const pagedPartners = paginate(partners, page);

  const handleSaveAssignment = async (payload: { state?: string; district?: string; notes?: string }) => {
    if (!assignmentTarget) {
      return;
    }

    setIsSaving(true);
    try {
      await updateOperationsAssignment(assignmentTarget.id, payload);
      toast.success("Delivery partner assignment updated successfully.");
      setAssignmentTarget(null);
      await loadPartners();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update this delivery partner assignment."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Delivery partners"
        title="Rider coverage by state and district."
        description="Review availability, assignment readiness, and operational notes for delivery partners inside the India operations flow."
        action={<RefreshButton onClick={() => void loadPartners()} />}
      />

      <AdminToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by rider, email, phone, vehicle, or license"
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
            <Select value={availabilityFilter} onChange={(event) => { setAvailabilityFilter(event.target.value); setPage(1); }} className="min-w-[180px]">
              <option value="ALL">All availability</option>
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
              <option value="BUSY">Busy</option>
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
            rows={pagedPartners.items}
            getRowKey={(partner) => partner.id}
            emptyTitle="No delivery partners found"
            emptyDescription="Broaden the filters or add assignments from the operations queue."
            columns={[
              {
                key: "partner",
                label: "Partner",
                render: (partner) => (
                  <div>
                    <p className="font-semibold text-ink">{partner.fullName}</p>
                    <p className="text-xs text-ink-muted">{partner.email}</p>
                    <p className="text-xs text-ink-muted">{partner.phone ?? "No phone available"}</p>
                  </div>
                ),
              },
              {
                key: "vehicle",
                label: "Vehicle",
                render: (partner) => (
                  <div>
                    <p className="font-semibold text-ink">{toLabel(partner.deliveryProfile.vehicleType)}</p>
                    <p className="text-xs text-ink-muted">{partner.deliveryProfile.vehicleNumber ?? "Vehicle number unavailable"}</p>
                  </div>
                ),
              },
              {
                key: "status",
                label: "Availability",
                render: (partner) => (
                  <div className="space-y-2">
                    <StatusPill label={toLabel(partner.deliveryProfile.availabilityStatus)} tone={getToneForStatus(partner.deliveryProfile.availabilityStatus)} />
                    <StatusPill label={partner.deliveryProfile.isVerified ? "Verified" : "Pending verification"} tone={getToneForStatus(partner.deliveryProfile.isVerified)} />
                  </div>
                ),
              },
              {
                key: "region",
                label: "Region",
                render: (partner) => (
                  <div className="space-y-2">
                    <p className="font-semibold text-ink">
                      {[partner.opsState, partner.opsDistrict].filter(Boolean).join(" • ") || "Not assigned"}
                    </p>
                    <StatusPill label={partner.assignmentStatus.replace(/_/g, " ")} tone={getToneForStatus(partner.assignmentStatus)} />
                  </div>
                ),
              },
              {
                key: "actions",
                label: "Actions",
                render: (partner) => (
                  <RowActions
                    onView={() => setDetailsPartner(partner)}
                    onEdit={() => setAssignmentTarget(partner)}
                    deleteLabel="Assign"
                  />
                ),
              },
            ]}
          />
          {partners.length > PAGE_SIZE ? (
            <Pagination page={pagedPartners.currentPage} totalPages={pagedPartners.totalPages} onPageChange={setPage} />
          ) : null}
        </>
      )}

      <Modal open={Boolean(detailsPartner)} onClose={() => setDetailsPartner(null)} title={detailsPartner?.fullName} className="max-w-3xl">
        {detailsPartner ? (
          <AdminDetailsGrid
            items={[
              { label: "Email", value: detailsPartner.email },
              { label: "Phone", value: detailsPartner.phone ?? "No phone available" },
              { label: "Vehicle", value: `${toLabel(detailsPartner.deliveryProfile.vehicleType)} • ${detailsPartner.deliveryProfile.vehicleNumber ?? "No number"}` },
              { label: "License", value: detailsPartner.deliveryProfile.licenseNumber ?? "No license number recorded" },
              { label: "Region", value: [detailsPartner.opsState, detailsPartner.opsDistrict].filter(Boolean).join(" • ") || "Not assigned" },
              { label: "Operational note", value: detailsPartner.opsNotes ?? "No assignment note recorded yet." },
              { label: "Deliveries", value: detailsPartner.deliveryProfile.totalDeliveries.toString() },
              { label: "Last login", value: formatDateTime(detailsPartner.lastLoginAt) },
            ]}
          />
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
