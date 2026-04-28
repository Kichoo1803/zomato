import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AdminDataTable,
  AdminDetailsGrid,
  AdminLoadingState,
  AdminToolbar,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { IndianPhoneInput } from "@/components/ui/indian-phone-input";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading, StatusPill } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { getApiErrorMessage } from "@/lib/auth";
import { getDistrictOptions, mergeRegionOptions } from "@/lib/india-regions";
import {
  createOperationsDeliveryPartner,
  getOperationsDeliveryPartners,
  getOperationsRegions,
  updateOperationsAssignment,
  type OperationsDeliveryPartner,
} from "@/lib/ops";
import {
  AddButton,
  PAGE_SIZE,
  RefreshButton,
  RowActions,
  ToggleField,
  VEHICLE_OPTIONS,
  formatDateTime,
  getToneForStatus,
  paginate,
  toLabel,
} from "@/pages/admin/admin-shared";
import { OperationsAssignmentModal } from "./ops-shared";

export const OpsDeliveryPartnersPage = () => {
  const { user } = useAuth();
  const [partners, setPartners] = useState<OperationsDeliveryPartner[]>([]);
  const [regionOptions, setRegionOptions] = useState<{ states: string[]; districtsByState: Record<string, string[]> } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("ALL");
  const [assignmentFilter, setAssignmentFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [detailsPartner, setDetailsPartner] = useState<OperationsDeliveryPartner | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<OperationsDeliveryPartner | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    profileImage: "",
    vehicleType: "BIKE",
    vehicleNumber: "",
    licenseNumber: "",
    availabilityStatus: "OFFLINE",
    isVerified: false,
    state: "",
    district: "",
    notes: "",
  });
  const canCreatePartners = user?.role === "ADMIN" || user?.role === "REGIONAL_MANAGER";

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
        getOperationsRegions(),
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
  const createDistrictOptions = useMemo(
    () => getDistrictOptions(createForm.state, regionOptions),
    [createForm.state, regionOptions],
  );
  const pagedPartners = paginate(partners, page);

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
      vehicleType: "BIKE",
      vehicleNumber: "",
      licenseNumber: "",
      availabilityStatus: "OFFLINE",
      isVerified: false,
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
      toast.success("Delivery partner assignment updated successfully.");
      setAssignmentTarget(null);
      await loadPartners();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update this delivery partner assignment."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePartner = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!createForm.state || !createForm.district) {
      toast.error("Select both a state and district before creating a delivery partner.");
      return;
    }

    setIsCreating(true);
    try {
      await createOperationsDeliveryPartner({
        fullName: createForm.fullName,
        email: createForm.email,
        phone: createForm.phone.trim() || undefined,
        password: createForm.password,
        profileImage: createForm.profileImage.trim() || undefined,
        vehicleType: createForm.vehicleType,
        vehicleNumber: createForm.vehicleNumber.trim() || undefined,
        licenseNumber: createForm.licenseNumber.trim() || undefined,
        availabilityStatus: createForm.availabilityStatus,
        isVerified: createForm.isVerified,
        state: createForm.state,
        district: createForm.district,
        notes: createForm.notes.trim() || undefined,
      });
      toast.success("Delivery partner created successfully.");
      setIsCreateModalOpen(false);
      await loadPartners();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to create this delivery partner."));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Delivery partners"
        title="Rider coverage by state and district."
        description="Review availability, assignment readiness, and operational notes for delivery partners inside the India operations flow."
        action={
          <div className="flex gap-3">
            <RefreshButton onClick={() => void loadPartners()} />
            {canCreatePartners ? <AddButton label="Add delivery partner" onClick={openCreateModal} /> : null}
          </div>
        }
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
            emptyDescription="Broaden the filters or add new delivery registrations from the operations workflow."
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

      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add delivery partner"
        className="max-w-3xl"
      >
        <form className="space-y-4" onSubmit={handleCreatePartner}>
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
            <IndianPhoneInput
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
            <Input
              label="Profile image URL"
              value={createForm.profileImage}
              onChange={(event) => setCreateForm({ ...createForm, profileImage: event.target.value })}
            />
            <Select
              label="Vehicle type"
              value={createForm.vehicleType}
              onChange={(event) => setCreateForm({ ...createForm, vehicleType: event.target.value })}
            >
              {VEHICLE_OPTIONS.map((vehicle) => (
                <option key={vehicle} value={vehicle}>
                  {toLabel(vehicle)}
                </option>
              ))}
            </Select>
            <Input
              label="Vehicle number"
              value={createForm.vehicleNumber}
              onChange={(event) => setCreateForm({ ...createForm, vehicleNumber: event.target.value })}
            />
            <Input
              label="License number"
              value={createForm.licenseNumber}
              onChange={(event) => setCreateForm({ ...createForm, licenseNumber: event.target.value })}
            />
            <Select
              label="Availability"
              value={createForm.availabilityStatus}
              onChange={(event) => setCreateForm({ ...createForm, availabilityStatus: event.target.value })}
            >
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
              <option value="BUSY">Busy</option>
            </Select>
          </div>
          <ToggleField
            label="Verified partner"
            checked={createForm.isVerified}
            onChange={(checked) => setCreateForm({ ...createForm, isVerified: checked })}
          />
          <Textarea
            label="Operational notes"
            value={createForm.notes}
            onChange={(event) => setCreateForm({ ...createForm, notes: event.target.value })}
            placeholder="Capture onboarding notes, local coverage context, or verification handoff details."
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
              {isCreating ? "Creating..." : "Create partner"}
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
