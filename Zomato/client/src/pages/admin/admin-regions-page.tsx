import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminDataTable, AdminLoadingState, AdminToolbar } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading, StatusPill } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createRegionAdmin,
  getRegionsAdmin,
  getUsers,
  updateRegionAdmin,
  type AdminRegion,
  type AdminUser,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  getDistrictOptions,
  getIndianStateOptions,
  isValidIndianPincode,
  mergeRegionOptions,
} from "@/lib/india-regions";
import { buildRegionCode, normalizeRegionCode } from "@/lib/regions";
import {
  AddButton,
  PAGE_SIZE,
  RefreshButton,
  RowActions,
  ToggleField,
  matchesSearch,
  paginate,
  getToneForStatus,
} from "./admin-shared";

type RegionFormState = {
  name: string;
  districtName: string;
  stateName: string;
  code: string;
  slug: string;
  notes: string;
  primaryPincode: string;
  additionalPincodes: string;
  isActive: boolean;
  managerUserId: string;
};

type RegionFormErrors = Partial<Record<keyof RegionFormState, string>>;

const emptyForm: RegionFormState = {
  name: "",
  districtName: "",
  stateName: "",
  code: "",
  slug: "",
  notes: "",
  primaryPincode: "",
  additionalPincodes: "",
  isActive: true,
  managerUserId: "",
};

const parsePincodeList = (value: string) =>
  [...new Set(value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean))];

const formatAdditionalPincodes = (values: string[]) => values.join(", ");

const normalizePincodeInput = (value: string) => value.replace(/\D/g, "").slice(0, 6);

const getRegionalManagerOptionLabel = (manager: AdminUser) => {
  const assignedRegionLabel = [manager.opsDistrict, manager.opsState].filter(Boolean).join(", ");

  if (!assignedRegionLabel) {
    return manager.fullName;
  }

  return `${manager.fullName} (${assignedRegionLabel})`;
};

export const AdminRegionsPage = () => {
  const [regions, setRegions] = useState<AdminRegion[]>([]);
  const [regionalManagers, setRegionalManagers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [assignmentFilter, setAssignmentFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<AdminRegion | null>(null);
  const [form, setForm] = useState<RegionFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<RegionFormErrors>({});
  const [hasCustomCode, setHasCustomCode] = useState(false);

  const baseStateOptions = useMemo(() => getIndianStateOptions(), []);
  const displayRegionOptions = useMemo(
    () =>
      mergeRegionOptions(
        form.stateName
          ? {
              states: [form.stateName],
              districtsByState: form.districtName
                ? {
                    [form.stateName]: [form.districtName],
                  }
                : {},
            }
          : undefined,
      ),
    [form.stateName, form.districtName],
  );
  const stateOptions = displayRegionOptions.states;
  const districtOptions = useMemo(
    () => getDistrictOptions(form.stateName, displayRegionOptions),
    [displayRegionOptions, form.stateName],
  );
  const validDistrictOptions = useMemo(() => getDistrictOptions(form.stateName), [form.stateName]);
  const regionalManagerOptions = useMemo(
    () =>
      [...regionalManagers].sort((left, right) => left.fullName.localeCompare(right.fullName, "en-IN")),
    [regionalManagers],
  );

  const loadRegions = async () => {
    setIsLoading(true);

    try {
      setRegions(
        await getRegionsAdmin({
          search: search || undefined,
          isActive: statusFilter === "ALL" ? undefined : statusFilter === "ACTIVE",
          assignmentStatus:
            assignmentFilter === "ALL"
              ? undefined
              : (assignmentFilter as "ASSIGNED" | "UNASSIGNED"),
        }),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load regions."));
    } finally {
      setIsLoading(false);
    }
  };

  const loadRegionalManagers = async () => {
    try {
      setRegionalManagers(await getUsers({ role: "REGIONAL_MANAGER" }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load regional managers."));
    }
  };

  useEffect(() => {
    void loadRegions();
  }, [search, statusFilter, assignmentFilter]);

  useEffect(() => {
    void loadRegionalManagers();
  }, []);

  useEffect(() => {
    if (hasCustomCode) {
      return;
    }

    const generatedCode = buildRegionCode(form.stateName, form.districtName);

    setForm((currentForm) =>
      currentForm.code === generatedCode
        ? currentForm
        : {
            ...currentForm,
            code: generatedCode,
          },
    );
  }, [form.stateName, form.districtName, hasCustomCode]);

  const openCreateModal = () => {
    setEditingRegion(null);
    setForm(emptyForm);
    setFormErrors({});
    setHasCustomCode(false);
    setIsModalOpen(true);
  };

  const openEditModal = (region: AdminRegion) => {
    const normalizedCode = normalizeRegionCode(region.code);
    const generatedCode = buildRegionCode(region.stateName, region.districtName);

    setEditingRegion(region);
    setForm({
      name: region.name,
      districtName: region.districtName,
      stateName: region.stateName,
      code: normalizedCode || generatedCode,
      slug: region.slug,
      notes: region.notes ?? "",
      primaryPincode: region.primaryPincode ?? "",
      additionalPincodes: formatAdditionalPincodes(region.additionalPincodes),
      isActive: region.isActive,
      managerUserId: region.managerUserId ? String(region.managerUserId) : "",
    });
    setFormErrors({});
    setHasCustomCode(Boolean((normalizedCode || generatedCode) && (normalizedCode || generatedCode) !== generatedCode));
    setIsModalOpen(true);
  };

  const filteredRegions = useMemo(() => {
    if (!search.trim()) {
      return regions;
    }

    return regions.filter((region) =>
      matchesSearch(
        [
          region.name,
          region.districtName,
          region.stateName,
          region.primaryPincode ?? "",
          region.additionalPincodes.join(" "),
          region.code,
          region.slug,
        ].join(" "),
        search,
      ),
    );
  }, [regions, search]);

  const pagedRegions = paginate(filteredRegions, page);

  const handleFieldChange = <K extends keyof RegionFormState>(key: K, value: RegionFormState[K]) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));

    setFormErrors((currentErrors) => ({
      ...currentErrors,
      [key]: undefined,
    }));
  };

  const handleStateChange = (nextState: string) => {
    const nextDistrictOptions = getDistrictOptions(nextState);

    setForm((currentForm) => ({
      ...currentForm,
      stateName: nextState,
      districtName: nextDistrictOptions.includes(currentForm.districtName) ? currentForm.districtName : "",
    }));

    setFormErrors((currentErrors) => ({
      ...currentErrors,
      stateName: undefined,
      districtName: undefined,
    }));
  };

  const handleCodeChange = (value: string) => {
    const normalizedCode = normalizeRegionCode(value);
    const generatedCode = buildRegionCode(form.stateName, form.districtName);

    handleFieldChange("code", normalizedCode);
    setHasCustomCode(Boolean(normalizedCode && normalizedCode !== generatedCode));
  };

  const validateForm = () => {
    const nextErrors: RegionFormErrors = {};
    const additionalPincodeList = parsePincodeList(form.additionalPincodes);

    if (!form.stateName) {
      nextErrors.stateName = "Select a state or union territory.";
    } else if (!baseStateOptions.includes(form.stateName)) {
      nextErrors.stateName = "Select a valid Indian state or union territory.";
    }

    if (!form.districtName) {
      nextErrors.districtName = "Select a district.";
    } else if (!validDistrictOptions.includes(form.districtName)) {
      nextErrors.districtName = "Select a district that belongs to the chosen state.";
    }

    if (form.primaryPincode && !isValidIndianPincode(form.primaryPincode)) {
      nextErrors.primaryPincode = "Enter a valid 6-digit Indian PIN code.";
    }

    if (additionalPincodeList.some((value) => !isValidIndianPincode(value))) {
      nextErrors.additionalPincodes = "Additional PIN codes must use a valid 6-digit Indian format.";
    } else if (new Set(additionalPincodeList).size !== additionalPincodeList.length) {
      nextErrors.additionalPincodes = "Additional PIN codes must be unique.";
    }

    setFormErrors(nextErrors);
    return {
      isValid: Object.keys(nextErrors).length === 0,
      additionalPincodeList,
    };
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { isValid, additionalPincodeList } = validateForm();

    if (!isValid) {
      toast.error("Please fix the highlighted region details and try again.");
      return;
    }

    setIsSubmitting(true);

    const normalizedCode = normalizeRegionCode(form.code);
    const generatedCode = buildRegionCode(form.stateName, form.districtName);

    const payload = {
      name: form.name.trim() || undefined,
      districtName: form.districtName.trim(),
      stateName: form.stateName.trim(),
      code: normalizedCode || generatedCode || undefined,
      slug: form.slug.trim() || undefined,
      notes: form.notes.trim() || undefined,
      primaryPincode: form.primaryPincode.trim() || undefined,
      additionalPincodes: additionalPincodeList,
      isActive: form.isActive,
      managerUserId: form.managerUserId ? Number(form.managerUserId) : null,
    };

    try {
      if (editingRegion) {
        await updateRegionAdmin(editingRegion.id, payload);
        toast.success("Region updated successfully.");
      } else {
        await createRegionAdmin(payload);
        toast.success("Region created successfully.");
      }

      setIsModalOpen(false);
      await Promise.all([loadRegions(), loadRegionalManagers()]);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save this region."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Regions"
        title="District-level region ownership for the operations network."
        description="Create and maintain district regions, review coverage, and directly assign regional managers when an admin needs to adjust ownership quickly."
        action={
          <div className="flex gap-3">
            <RefreshButton onClick={() => void Promise.all([loadRegions(), loadRegionalManagers()])} />
            <AddButton label="Add region" onClick={openCreateModal} />
          </div>
        }
      />

      <AdminToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by region name, district, state, PIN code, code, or slug"
        filters={
          <>
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
            <Select
              value={assignmentFilter}
              onChange={(event) => {
                setAssignmentFilter(event.target.value);
                setPage(1);
              }}
              className="min-w-[180px]"
            >
              <option value="ALL">All assignments</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="UNASSIGNED">Unassigned</option>
            </Select>
          </>
        }
      />

      {isLoading ? (
        <AdminLoadingState rows={6} />
      ) : (
        <>
          <AdminDataTable
            rows={pagedRegions.items}
            getRowKey={(region) => region.id}
            emptyTitle="No regions match these filters"
            emptyDescription="Try a broader search or create a new district region."
            columns={[
              {
                key: "region",
                label: "Region",
                render: (region) => (
                  <div>
                    <p className="font-semibold text-ink">{region.name}</p>
                    <p className="text-xs text-ink-muted">{region.code}</p>
                    <p className="text-xs text-ink-muted">{region.slug}</p>
                  </div>
                ),
              },
              {
                key: "location",
                label: "District / State / PIN",
                render: (region) => (
                  <div>
                    <p className="font-semibold text-ink">{region.districtName}</p>
                    <p className="text-xs text-ink-muted">{region.stateName}</p>
                    <p className="text-xs text-ink-muted">
                      {region.primaryPincode
                        ? `Primary PIN ${region.primaryPincode}`
                        : region.additionalPincodes.length
                          ? `${region.additionalPincodes[0]}${region.additionalPincodes.length > 1 ? ` +${region.additionalPincodes.length - 1} more` : ""}`
                          : "No PIN coverage set"}
                    </p>
                  </div>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (region) => (
                  <div className="space-y-2">
                    <StatusPill
                      label={region.isActive ? "Active" : "Inactive"}
                      tone={getToneForStatus(region.isActive)}
                    />
                    <StatusPill
                      label={region.manager ? "Assigned" : "Unassigned"}
                      tone={getToneForStatus(region.manager ? "APPROVED" : "PENDING")}
                    />
                  </div>
                ),
              },
              {
                key: "assignment",
                label: "Assignment",
                render: (region) =>
                  region.manager ? (
                    <div>
                      <p className="font-semibold text-ink">{region.manager.fullName}</p>
                      <p className="text-xs text-ink-muted">{region.manager.email}</p>
                      <p className="text-xs text-ink-muted">Assigned to this district</p>
                    </div>
                  ) : (
                    <span className="text-sm text-ink-muted">No manager assigned yet</span>
                  ),
              },
              {
                key: "coverage",
                label: "Coverage",
                render: (region) => (
                  <div className="space-y-1 text-sm">
                    <p className="text-ink">
                      {region.counts.restaurantsCount} restaurant
                      {region.counts.restaurantsCount === 1 ? "" : "s"}
                    </p>
                    <p className="text-ink-soft">
                      {region.counts.deliveryPartnersCount} delivery partner
                      {region.counts.deliveryPartnersCount === 1 ? "" : "s"}
                    </p>
                    <p className="text-ink-muted">
                      {region.counts.usersCount} user
                      {region.counts.usersCount === 1 ? "" : "s"}
                    </p>
                  </div>
                ),
              },
              {
                key: "actions",
                label: "Actions",
                render: (region) => <RowActions onEdit={() => openEditModal(region)} />,
              },
            ]}
          />
          {filteredRegions.length > PAGE_SIZE ? (
            <Pagination
              page={pagedRegions.currentPage}
              totalPages={pagedRegions.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRegion ? "Edit region" : "Add region"}
        className="max-w-4xl"
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Region name"
              value={form.name}
              onChange={(event) => handleFieldChange("name", event.target.value)}
              placeholder="Defaults to district, state"
            />
            <Select
              label="State / Union territory"
              value={form.stateName}
              onChange={(event) => handleStateChange(event.target.value)}
              error={formErrors.stateName}
              required
            >
              <option value="">Select a state or union territory</option>
              {stateOptions.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
            <Select
              label="District"
              value={form.districtName}
              onChange={(event) => handleFieldChange("districtName", event.target.value)}
              error={formErrors.districtName}
              disabled={!form.stateName}
              required
            >
              <option value="">
                {form.stateName ? "Select a district" : "Choose a state first"}
              </option>
              {districtOptions.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </Select>
            <Input
              label="Primary PIN code"
              value={form.primaryPincode}
              onChange={(event) => handleFieldChange("primaryPincode", normalizePincodeInput(event.target.value))}
              error={formErrors.primaryPincode}
              placeholder="600001"
              inputMode="numeric"
              maxLength={6}
            />
            <Input
              label="Code"
              value={form.code}
              onChange={(event) => handleCodeChange(event.target.value)}
              error={formErrors.code}
              placeholder="Optional custom code"
            />
            <Input
              label="Slug"
              value={form.slug}
              onChange={(event) => handleFieldChange("slug", event.target.value.toLowerCase())}
              error={formErrors.slug}
              placeholder="optional-custom-slug"
            />
            <Select
              label="Regional manager"
              value={form.managerUserId}
              onChange={(event) => handleFieldChange("managerUserId", event.target.value)}
            >
              <option value="">No manager assigned</option>
              {regionalManagerOptions.map((manager) => (
                <option
                  key={manager.id}
                  value={String(manager.id)}
                  disabled={!manager.isActive && form.managerUserId !== String(manager.id)}
                >
                  {getRegionalManagerOptionLabel(manager)}
                  {!manager.isActive ? " (Inactive)" : ""}
                </option>
              ))}
            </Select>
          </div>
          <Textarea
            label="Additional PIN codes"
            value={form.additionalPincodes}
            onChange={(event) => handleFieldChange("additionalPincodes", event.target.value)}
            error={formErrors.additionalPincodes}
            placeholder="Add comma-separated or one-per-line PIN codes for extra coverage."
          />
          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(event) => handleFieldChange("notes", event.target.value)}
            error={formErrors.notes}
            placeholder="Optional notes for region operations or ownership context."
          />
          <ToggleField
            label="Region is active"
            checked={form.isActive}
            onChange={(checked) => handleFieldChange("isActive", checked)}
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
              {isSubmitting ? "Saving..." : editingRegion ? "Save changes" : "Create region"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
