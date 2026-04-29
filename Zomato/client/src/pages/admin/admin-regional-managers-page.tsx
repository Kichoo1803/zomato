import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdminDataTable,
  AdminLoadingState,
  AdminToolbar,
  ConfirmDangerModal,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { IndianPhoneInput } from "@/components/ui/indian-phone-input";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading, StatusPill } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createRegionAdmin,
  createUser,
  disableUser,
  getRegionsAdmin,
  getUsers,
  updateRegionAdmin,
  updateUser,
  type AdminRegion,
  type AdminUser,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import { getDistrictOptions, getIndianStateOptions, mergeRegionOptions } from "@/lib/india-regions";
import {
  AddButton,
  PAGE_SIZE,
  RefreshButton,
  RowActions,
  ToggleField,
  formatDateTime,
  getToneForStatus,
  matchesSearch,
  paginate,
} from "./admin-shared";

type RegionalManagerFormState = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  profileImage: string;
  opsNotes: string;
  isActive: boolean;
  managedRegionIds: number[];
};

type RegionOption = {
  id: number;
  label: string;
  managerLabel: string;
  isAssignedToCurrentManager: boolean;
  isSelectable: boolean;
};

const emptyForm: RegionalManagerFormState = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  profileImage: "",
  opsNotes: "",
  isActive: true,
  managedRegionIds: [],
};

const formatRegionLabel = (region: AdminRegion) => `${region.districtName}, ${region.stateName}`;
const getRegionAssignmentKey = (stateName: string, districtName: string) =>
  `${stateName.trim().toLowerCase()}::${districtName.trim().toLowerCase()}`;
const getRegionManagerLabel = (region: AdminRegion, currentManagerId: number | null) =>
  region.managerUserId == null
    ? "Unassigned"
    : region.managerUserId === currentManagerId
      ? "Assigned to this manager"
      : `Assigned to ${region.manager?.fullName ?? "another manager"}`;
const getRegionConflictMessage = (region: AdminRegion, currentManagerId: number | null) =>
  region.managerUserId != null && region.managerUserId !== currentManagerId
    ? `${formatRegionLabel(region)} is already assigned to ${region.manager?.fullName ?? "another manager"}.`
    : getRegionManagerLabel(region, currentManagerId);
const isRegionSelectableByManager = (region: AdminRegion, currentManagerId: number | null) =>
  region.managerUserId == null || region.managerUserId === currentManagerId;
const sortRegionsByCoverage = (regions: AdminRegion[]) =>
  [...regions].sort((left, right) => {
    if (left.stateName !== right.stateName) {
      return left.stateName.localeCompare(right.stateName, "en-IN");
    }

    if (left.districtName !== right.districtName) {
      return left.districtName.localeCompare(right.districtName, "en-IN");
    }

    return left.name.localeCompare(right.name, "en-IN");
  });

const getCurrentAssignedRegion = (regions: AdminRegion[], preferredRegionId?: number | null) =>
  (preferredRegionId ? regions.find((region) => region.id === preferredRegionId) : null) ?? regions[0] ?? null;

export const AdminRegionalManagersPage = () => {
  const [regionalManagers, setRegionalManagers] = useState<AdminUser[]>([]);
  const [regions, setRegions] = useState<AdminRegion[]>([]);
  const [assignableRegions, setAssignableRegions] = useState<AdminRegion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAssignableRegions, setIsLoadingAssignableRegions] = useState(false);
  const [isAssigningRegion, setIsAssigningRegion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [assignmentFilter, setAssignmentFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [regionSearch, setRegionSearch] = useState("");
  const [assignmentState, setAssignmentState] = useState("");
  const [assignmentDistrict, setAssignmentDistrict] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const [form, setForm] = useState<RegionalManagerFormState>(emptyForm);

  const loadRegionalManagers = async () => {
    setIsLoading(true);

    try {
      const [managerRows, regionRows] = await Promise.all([
        getUsers({ role: "REGIONAL_MANAGER" }),
        getRegionsAdmin(),
      ]);

      setRegionalManagers(
        [...managerRows].sort((left, right) => left.fullName.localeCompare(right.fullName, "en-IN")),
      );
      setRegions(regionRows);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load regional managers."));
    } finally {
      setIsLoading(false);
    }
  };

  const loadAssignableRegions = async () => {
    setIsLoadingAssignableRegions(true);

    try {
      setAssignableRegions(await getRegionsAdmin({ isActive: true }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load active regions."));
    } finally {
      setIsLoadingAssignableRegions(false);
    }
  };

  useEffect(() => {
    void loadRegionalManagers();
  }, []);

  const assignedRegionsByManager = useMemo(() => {
    const nextMap = new Map<number, AdminRegion[]>();

    [...regions]
      .sort((left, right) => {
        if (left.stateName !== right.stateName) {
          return left.stateName.localeCompare(right.stateName, "en-IN");
        }

        if (left.districtName !== right.districtName) {
          return left.districtName.localeCompare(right.districtName, "en-IN");
        }

        return left.name.localeCompare(right.name, "en-IN");
      })
      .forEach((region) => {
        if (!region.managerUserId) {
          return;
        }

        const bucket = nextMap.get(region.managerUserId) ?? [];
        bucket.push(region);
        nextMap.set(region.managerUserId, bucket);
      });

    return nextMap;
  }, [regions]);

  const regionLookup = useMemo(() => {
    const nextLookup = new Map<number, AdminRegion>();

    [...regions, ...assignableRegions].forEach((region) => {
      nextLookup.set(region.id, region);
    });

    return nextLookup;
  }, [assignableRegions, regions]);

  const regionByArea = useMemo(() => {
    const nextLookup = new Map<string, AdminRegion>();

    [...regions, ...assignableRegions].forEach((region) => {
      const key = getRegionAssignmentKey(region.stateName, region.districtName);
      const existingRegion = nextLookup.get(key);

      if (!existingRegion || (!existingRegion.isActive && region.isActive)) {
        nextLookup.set(key, region);
      }
    });

    return nextLookup;
  }, [assignableRegions, regions]);

  const baseStateOptions = useMemo(() => getIndianStateOptions(), []);

  const assignmentRegionOptions = useMemo(
    () =>
      mergeRegionOptions({
        states: assignableRegions.map((region) => region.stateName),
        districtsByState: assignableRegions.reduce<Record<string, string[]>>((lookup, region) => {
          const bucket = lookup[region.stateName] ?? [];
          bucket.push(region.districtName);
          lookup[region.stateName] = bucket;
          return lookup;
        }, {}),
      }),
    [assignableRegions],
  );

  const assignmentStateOptions = useMemo(
    () =>
      [...new Set([...baseStateOptions, ...assignmentRegionOptions.states])].sort((left, right) =>
        left.localeCompare(right, "en-IN"),
      ),
    [assignmentRegionOptions.states, baseStateOptions],
  );
  const assignmentDistrictOptions = useMemo(
    () => getDistrictOptions(assignmentState, assignmentRegionOptions),
    [assignmentRegionOptions, assignmentState],
  );

  const assignableRegionByArea = useMemo(() => {
    const currentManagerId = editingManager?.id ?? null;
    const nextLookup = new Map<string, AdminRegion>();

    [...assignableRegions]
      .sort((left, right) => {
        const leftRank =
          left.managerUserId === currentManagerId ? 0 : left.managerUserId == null ? 1 : 2;
        const rightRank =
          right.managerUserId === currentManagerId ? 0 : right.managerUserId == null ? 1 : 2;

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        return left.name.localeCompare(right.name, "en-IN");
      })
      .forEach((region) => {
        const key = getRegionAssignmentKey(region.stateName, region.districtName);

        if (!nextLookup.has(key)) {
          nextLookup.set(key, region);
        }
      });

    return nextLookup;
  }, [assignableRegions, editingManager?.id]);

  const selectedRegion = useMemo(
    () => {
      const [selectedRegionId] = [...new Set(form.managedRegionIds)];

      return selectedRegionId ? regionLookup.get(selectedRegionId) ?? null : null;
    },
    [form.managedRegionIds, regionLookup],
  );

  const filteredRegionOptions = useMemo(() => {
    const normalizedRegionSearch = regionSearch.trim().toLowerCase();
    const currentManagerId = editingManager?.id ?? null;
    const normalizedAssignmentState = assignmentState.trim().toLowerCase();
    const normalizedAssignmentDistrict = assignmentDistrict.trim().toLowerCase();

    return assignableRegions
      .filter((region) => {
        if (
          normalizedAssignmentState &&
          region.stateName.trim().toLowerCase() !== normalizedAssignmentState
        ) {
          return false;
        }

        if (
          normalizedAssignmentDistrict &&
          region.districtName.trim().toLowerCase() !== normalizedAssignmentDistrict
        ) {
          return false;
        }

        if (!normalizedRegionSearch) {
          return true;
        }

        return matchesSearch(
          [region.name, region.districtName, region.stateName, region.code, region.primaryPincode ?? ""].join(" "),
          normalizedRegionSearch,
        );
      })
      .sort((left, right) => {
        const leftRank = isRegionSelectableByManager(left, currentManagerId)
          ? left.managerUserId === currentManagerId
            ? 0
            : 1
          : 2;
        const rightRank = isRegionSelectableByManager(right, currentManagerId)
          ? right.managerUserId === currentManagerId
            ? 0
            : 1
          : 2;

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        if (left.stateName !== right.stateName) {
          return left.stateName.localeCompare(right.stateName, "en-IN");
        }

        if (left.districtName !== right.districtName) {
          return left.districtName.localeCompare(right.districtName, "en-IN");
        }

        return left.name.localeCompare(right.name, "en-IN");
      })
      .map(
        (region): RegionOption => ({
          id: region.id,
          label: formatRegionLabel(region),
          managerLabel: getRegionManagerLabel(region, currentManagerId),
          isAssignedToCurrentManager: region.managerUserId === currentManagerId,
          isSelectable: isRegionSelectableByManager(region, currentManagerId),
        }),
      );
  }, [assignableRegions, assignmentDistrict, assignmentState, editingManager?.id, regionSearch]);

  const filteredManagers = useMemo(
    () =>
      regionalManagers.filter((manager) => {
        const assignedRegion = getCurrentAssignedRegion(
          assignedRegionsByManager.get(manager.id) ?? [],
          manager.regionId,
        );
        const haystack = [
          manager.fullName,
          manager.email,
          manager.phone ?? "",
          manager.opsNotes ?? "",
          manager.opsDistrict ?? "",
          manager.opsState ?? "",
          assignedRegion ? formatRegionLabel(assignedRegion) : "",
        ].join(" ");

        if (search.trim() && !matchesSearch(haystack, search)) {
          return false;
        }

        if (statusFilter === "ACTIVE" && !manager.isActive) {
          return false;
        }

        if (statusFilter === "INACTIVE" && manager.isActive) {
          return false;
        }

        if (assignmentFilter === "ASSIGNED" && !assignedRegion) {
          return false;
        }

        if (assignmentFilter === "UNASSIGNED" && assignedRegion) {
          return false;
        }

        return true;
      }),
    [assignedRegionsByManager, assignmentFilter, regionalManagers, search, statusFilter],
  );

  const pagedManagers = paginate(filteredManagers, page);

  const openCreateModal = () => {
    setEditingManager(null);
    setForm(emptyForm);
    setRegionSearch("");
    setAssignmentState("");
    setAssignmentDistrict("");
    setAssignmentMessage(null);
    setIsModalOpen(true);
    void loadAssignableRegions();
  };

  const openEditModal = (manager: AdminUser) => {
    const assignedRegion = getCurrentAssignedRegion(
      assignedRegionsByManager.get(manager.id) ?? [],
      manager.regionId,
    );

    setEditingManager(manager);
    setForm({
      fullName: manager.fullName,
      email: manager.email,
      phone: manager.phone ?? "",
      password: "",
      profileImage: manager.profileImage ?? "",
      opsNotes: manager.opsNotes ?? "",
      isActive: manager.isActive,
      managedRegionIds: assignedRegion ? [assignedRegion.id] : [],
    });
    setRegionSearch("");
    setAssignmentState("");
    setAssignmentDistrict("");
    setAssignmentMessage(null);
    setIsModalOpen(true);
    void loadAssignableRegions();
  };

  const toggleRegionSelection = (regionId: number) => {
    setAssignmentMessage(null);
    setForm((currentForm) => ({
      ...currentForm,
      managedRegionIds: currentForm.managedRegionIds.includes(regionId)
        ? []
        : [regionId],
    }));
  };

  const handleAssignmentStateChange = (nextState: string) => {
    const nextDistrictOptions = getDistrictOptions(nextState, assignmentRegionOptions);

    setAssignmentState(nextState);
    setAssignmentDistrict((currentDistrict) =>
      nextDistrictOptions.includes(currentDistrict) ? currentDistrict : "",
    );
    setAssignmentMessage(null);
  };

  const upsertRegionLocally = (region: AdminRegion) => {
    setRegions((currentRegions) =>
      sortRegionsByCoverage([
        ...currentRegions.filter((currentRegion) => currentRegion.id !== region.id),
        region,
      ]),
    );

    setAssignableRegions((currentRegions) =>
      region.isActive
        ? sortRegionsByCoverage([
            ...currentRegions.filter((currentRegion) => currentRegion.id !== region.id),
            region,
          ])
        : currentRegions.filter((currentRegion) => currentRegion.id !== region.id),
    );
  };

  const handleAssignRegion = async () => {
    const currentManagerId = editingManager?.id ?? null;

    if (!assignmentState) {
      setAssignmentMessage("Select a state first.");
      return;
    }

    if (!assignmentDistrict) {
      setAssignmentMessage("Select a district to assign.");
      return;
    }

    const regionKey = getRegionAssignmentKey(assignmentState, assignmentDistrict);
    const existingActiveRegion = assignableRegionByArea.get(regionKey);

    if (existingActiveRegion && !isRegionSelectableByManager(existingActiveRegion, currentManagerId)) {
      setAssignmentMessage(getRegionConflictMessage(existingActiveRegion, currentManagerId));
      return;
    }

    if (existingActiveRegion && form.managedRegionIds.includes(existingActiveRegion.id)) {
      setAssignmentMessage(`${assignmentDistrict}, ${assignmentState} is already assigned here.`);
      return;
    }

    setIsAssigningRegion(true);
    setAssignmentMessage(null);

    try {
      let matchedRegion = existingActiveRegion ?? null;
      let createdRegion = false;

      if (!matchedRegion) {
        const existingRegion = regionByArea.get(regionKey);

        if (existingRegion) {
          if (!isRegionSelectableByManager(existingRegion, currentManagerId)) {
            setAssignmentMessage(getRegionConflictMessage(existingRegion, currentManagerId));
            return;
          }

          matchedRegion = existingRegion.isActive
            ? existingRegion
            : await updateRegionAdmin(existingRegion.id, {
                isActive: true,
              });
        } else {
          matchedRegion = await createRegionAdmin({
            stateName: assignmentState,
            districtName: assignmentDistrict,
            name: `${assignmentDistrict}, ${assignmentState}`,
            isActive: true,
          });
          createdRegion = true;
        }

        upsertRegionLocally(matchedRegion);
      }

      if (form.managedRegionIds.includes(matchedRegion.id)) {
        setAssignmentMessage(`${assignmentDistrict}, ${assignmentState} is already assigned here.`);
        return;
      }

      const previousRegion = selectedRegion;
      setForm((currentForm) => ({
        ...currentForm,
        managedRegionIds: [matchedRegion.id],
      }));
      setAssignmentDistrict("");
      toast.success(
        createdRegion
          ? `${formatRegionLabel(matchedRegion)} was created and set as this manager's region.`
          : previousRegion && previousRegion.id !== matchedRegion.id
            ? `${formatRegionLabel(matchedRegion)} is now this manager's region.`
            : `${formatRegionLabel(matchedRegion)} was assigned to this manager.`,
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to assign this region right now."));
    } finally {
      setIsAssigningRegion(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingManager && !form.password.trim()) {
      toast.error("A password is required when creating a regional manager.");
      return;
    }

    if (!form.isActive && form.managedRegionIds.length) {
      toast.error("Inactive regional manager accounts cannot keep assigned regions.");
      return;
    }

    setIsSubmitting(true);

    const assignedRegionIds = [...new Set(form.managedRegionIds)].slice(0, 1);
    const payload = {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      password: form.password.trim() || undefined,
      role: "REGIONAL_MANAGER" as const,
      assignedRegionIds,
      profileImage: form.profileImage.trim() || undefined,
      opsNotes: form.opsNotes.trim() || undefined,
      isActive: form.isActive,
    };

    try {
      if (editingManager) {
        await updateUser(editingManager.id, payload);
        toast.success("Regional manager updated successfully.");
      } else {
        await createUser({
          ...payload,
          password: form.password,
        });
        toast.success("Regional manager created successfully.");
      }

      setIsModalOpen(false);
      await loadRegionalManagers();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save this regional manager."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisableManager = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);

    try {
      await disableUser(deleteTarget.id);
      toast.success("Regional manager disabled successfully.");
      setDeleteTarget(null);
      await loadRegionalManagers();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to disable this regional manager."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Regional managers"
        title="Regional manager coverage and district ownership."
        description="Create regional manager accounts, update their details, and manage region mappings from one admin workflow without duplicating the region editor."
        action={
          <div className="flex gap-3">
            <RefreshButton onClick={() => void loadRegionalManagers()} />
            <AddButton label="Add regional manager" onClick={openCreateModal} />
          </div>
        }
      />

      <AdminToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by manager, email, phone, primary scope, or assigned region"
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
              <option value="ASSIGNED">Assigned region</option>
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
            rows={pagedManagers.items}
            getRowKey={(manager) => manager.id}
            emptyTitle="No regional managers match these filters"
            emptyDescription="Broaden the search or create a new regional manager account."
            columns={[
              {
                key: "manager",
                label: "Regional manager",
                render: (manager) => (
                  <div>
                    <p className="font-semibold text-ink">{manager.fullName}</p>
                    <p className="text-xs text-ink-muted">{manager.email}</p>
                    <p className="text-xs text-ink-muted">{manager.phone ?? "No phone on file"}</p>
                  </div>
                ),
              },
              {
                key: "scope",
                label: "Primary scope",
                render: (manager) => (
                  <div>
                    <p className="font-semibold text-ink">
                      {[manager.opsDistrict, manager.opsState].filter(Boolean).join(" • ") || "No primary scope"}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {manager.opsNotes?.trim() || "No regional note recorded"}
                    </p>
                  </div>
                ),
              },
              {
                key: "regions",
                label: "Assigned region",
                render: (manager) => {
                  const assignedRegion = getCurrentAssignedRegion(
                    assignedRegionsByManager.get(manager.id) ?? [],
                    manager.regionId,
                  );

                  return assignedRegion ? (
                    <span className="inline-flex rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink">
                      {formatRegionLabel(assignedRegion)}
                    </span>
                  ) : (
                    <span className="text-sm text-ink-muted">No region assigned</span>
                  );
                },
              },
              {
                key: "status",
                label: "Status",
                render: (manager) => {
                  const assignedRegion = getCurrentAssignedRegion(
                    assignedRegionsByManager.get(manager.id) ?? [],
                    manager.regionId,
                  );

                  return (
                    <div className="space-y-2">
                      <StatusPill
                        label={manager.isActive ? "Active" : "Inactive"}
                        tone={getToneForStatus(manager.isActive)}
                      />
                      <StatusPill
                        label={assignedRegion ? "Assigned" : "Unassigned"}
                        tone={getToneForStatus(assignedRegion ? "APPROVED" : "PENDING")}
                      />
                    </div>
                  );
                },
              },
              {
                key: "activity",
                label: "Last login",
                render: (manager) => formatDateTime(manager.lastLoginAt),
              },
              {
                key: "actions",
                label: "Actions",
                render: (manager) => (
                  <RowActions
                    onEdit={() => openEditModal(manager)}
                    onDelete={() => setDeleteTarget(manager)}
                    deleteLabel="Disable"
                  />
                ),
              },
            ]}
          />
          {filteredManagers.length > PAGE_SIZE ? (
            <Pagination
              page={pagedManagers.currentPage}
              totalPages={pagedManagers.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingManager ? "Edit regional manager" : "Add regional manager"}
        className="max-w-4xl"
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Full name"
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
            <IndianPhoneInput
              label="Phone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
            <Input
              label={editingManager ? "New password (optional)" : "Password"}
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required={!editingManager}
            />
          </div>

          <Input
            label="Profile image URL"
            value={form.profileImage}
            onChange={(event) => setForm({ ...form, profileImage: event.target.value })}
          />

          <Textarea
            label="Operational notes"
            value={form.opsNotes}
            onChange={(event) => setForm({ ...form, opsNotes: event.target.value })}
            placeholder="Capture regional onboarding context, escalations, or handoff notes."
          />

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink">Assigned region / area</p>
              {selectedRegion ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toggleRegionSelection(selectedRegion.id)}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-soft"
                  >
                    <span>{formatRegionLabel(selectedRegion)}</span>
                    <span className="rounded-full border border-white/30 px-2 py-0.5 text-[10px] tracking-[0.12em]">
                      Remove
                    </span>
                  </button>
                </div>
              ) : (
                <p className="text-sm text-ink-muted">
                  No region assigned yet. Use State and District to add an active region below.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                <Select
                  label="State / Union territory"
                  value={assignmentState}
                  onChange={(event) => handleAssignmentStateChange(event.target.value)}
                >
                  <option value="">Select a state or union territory</option>
                  {assignmentStateOptions.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </Select>
                <Select
                  label="District"
                  value={assignmentDistrict}
                  onChange={(event) => {
                    setAssignmentDistrict(event.target.value);
                    setAssignmentMessage(null);
                  }}
                  disabled={!assignmentState}
                >
                  <option value="">
                    {assignmentState ? "Select a district" : "Choose a state first"}
                  </option>
                  {assignmentDistrictOptions.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  onClick={handleAssignRegion}
                  className="md:mb-0.5"
                  disabled={!assignmentState || !assignmentDistrict || isAssigningRegion}
                >
                  {isAssigningRegion ? "Assigning..." : "Assign"}
                </Button>
              </div>

              {isLoadingAssignableRegions ? (
                <p className="text-sm text-ink-muted">Loading active regions...</p>
              ) : !assignableRegions.length ? (
                <p className="text-sm text-ink-muted">
                  No active regions found yet. Select a state and district to create and assign one.
                </p>
              ) : null}

              {assignmentMessage ? (
                <p className="text-sm text-ink-muted">{assignmentMessage}</p>
              ) : null}

              <Input
                label="Search regions / areas"
                value={regionSearch}
                onChange={(event) => setRegionSearch(event.target.value)}
                placeholder="Search by district, state, region name, code, or PIN"
              />

              {filteredRegionOptions.length ? (
                <div className="space-y-3 rounded-[1.5rem] border border-accent/10 bg-cream-soft/60 p-4">
                  {filteredRegionOptions.map((region) => {
                    const isSelected = selectedRegion?.id === region.id;
                    const isDisabled = !region.isSelectable;

                    return (
                      <button
                        key={region.id}
                        type="button"
                        onClick={() => {
                          if (!isDisabled) {
                            toggleRegionSelection(region.id);
                          }
                        }}
                        disabled={isDisabled}
                        className={
                          isSelected
                            ? "flex w-full items-start justify-between rounded-[1.5rem] border border-accent bg-accent px-4 py-4 text-left text-white shadow-soft"
                            : isDisabled
                              ? "flex w-full items-start justify-between rounded-[1.5rem] border border-accent/10 bg-cream px-4 py-4 text-left text-ink-soft shadow-soft opacity-70"
                              : "flex w-full items-start justify-between rounded-[1.5rem] border border-accent/10 bg-white px-4 py-4 text-left text-ink shadow-soft"
                        }
                      >
                        <div>
                          <p className="font-semibold">{region.label}</p>
                          <p
                            className={
                              isSelected
                                ? "mt-1 text-xs text-white/80"
                                : isDisabled
                                  ? "mt-1 text-xs text-ink-soft"
                                  : "mt-1 text-xs text-ink-muted"
                            }
                          >
                            {region.managerLabel}
                          </p>
                        </div>
                        <span
                          className={
                            isSelected
                              ? "rounded-full border border-white/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                              : isDisabled
                                ? "rounded-full border border-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft"
                                : "rounded-full border border-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft"
                          }
                        >
                          {isSelected
                            ? "Selected"
                            : isDisabled
                              ? "Unavailable"
                              : region.isAssignedToCurrentManager
                                ? "Assigned"
                                : "Select"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : assignableRegions.length ? (
                <p className="text-sm text-ink-muted">
                  No active regions match this search or location filter. Try a different district, state, or PIN.
                </p>
              ) : null}
            </div>
          </div>

          <ToggleField
            label="Account is active"
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
              {isSubmitting ? "Saving..." : editingManager ? "Save changes" : "Create regional manager"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDangerModal
        open={Boolean(deleteTarget)}
        title="Disable regional manager"
        description="This is a safe soft-disable. The account will be disabled and any assigned regions will be released without deleting region records."
        confirmLabel="Disable manager"
        isSubmitting={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDisableManager()}
      />
    </div>
  );
};
