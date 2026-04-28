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
  createUser,
  disableUser,
  getRegionsAdmin,
  getUsers,
  updateUser,
  type AdminRegion,
  type AdminUser,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  AddButton,
  ChipSelector,
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

export const AdminRegionalManagersPage = () => {
  const [regionalManagers, setRegionalManagers] = useState<AdminUser[]>([]);
  const [regions, setRegions] = useState<AdminRegion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [assignmentFilter, setAssignmentFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
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

  const selectableRegions = useMemo(
    () =>
      [...regions]
        .filter((region) => region.isActive)
        .sort((left, right) => {
          if (left.stateName !== right.stateName) {
            return left.stateName.localeCompare(right.stateName, "en-IN");
          }

          if (left.districtName !== right.districtName) {
            return left.districtName.localeCompare(right.districtName, "en-IN");
          }

          return left.name.localeCompare(right.name, "en-IN");
        }),
    [regions],
  );

  const filteredManagers = useMemo(
    () =>
      regionalManagers.filter((manager) => {
        const assignedRegions = assignedRegionsByManager.get(manager.id) ?? [];
        const haystack = [
          manager.fullName,
          manager.email,
          manager.phone ?? "",
          manager.opsNotes ?? "",
          manager.opsDistrict ?? "",
          manager.opsState ?? "",
          assignedRegions.map(formatRegionLabel).join(" "),
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

        if (assignmentFilter === "ASSIGNED" && !assignedRegions.length) {
          return false;
        }

        if (assignmentFilter === "UNASSIGNED" && assignedRegions.length) {
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
    setIsModalOpen(true);
  };

  const openEditModal = (manager: AdminUser) => {
    setEditingManager(manager);
    setForm({
      fullName: manager.fullName,
      email: manager.email,
      phone: manager.phone ?? "",
      password: "",
      profileImage: manager.profileImage ?? "",
      opsNotes: manager.opsNotes ?? "",
      isActive: manager.isActive,
      managedRegionIds: (assignedRegionsByManager.get(manager.id) ?? []).map((region) => region.id),
    });
    setIsModalOpen(true);
  };

  const toggleRegionSelection = (regionId: number) => {
    setForm((currentForm) => ({
      ...currentForm,
      managedRegionIds: currentForm.managedRegionIds.includes(regionId)
        ? currentForm.managedRegionIds.filter((id) => id !== regionId)
        : [...currentForm.managedRegionIds, regionId],
    }));
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

    const payload = {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      password: form.password.trim() || undefined,
      role: "REGIONAL_MANAGER" as const,
      managedRegionIds: form.managedRegionIds,
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
              <option value="ASSIGNED">Assigned regions</option>
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
                label: "Assigned regions",
                render: (manager) => {
                  const assignedRegions = assignedRegionsByManager.get(manager.id) ?? [];

                  return assignedRegions.length ? (
                    <div className="space-y-2">
                      <p className="font-semibold text-ink">
                        {assignedRegions.length} region{assignedRegions.length === 1 ? "" : "s"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {assignedRegions.slice(0, 3).map((region) => (
                          <span
                            key={region.id}
                            className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink"
                          >
                            {formatRegionLabel(region)}
                          </span>
                        ))}
                        {assignedRegions.length > 3 ? (
                          <span className="rounded-full border border-accent/10 px-3 py-1 text-xs font-semibold text-ink-soft">
                            +{assignedRegions.length - 3} more
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-ink-muted">No regions assigned</span>
                  );
                },
              },
              {
                key: "status",
                label: "Status",
                render: (manager) => {
                  const assignedRegions = assignedRegionsByManager.get(manager.id) ?? [];

                  return (
                    <div className="space-y-2">
                      <StatusPill
                        label={manager.isActive ? "Active" : "Inactive"}
                        tone={getToneForStatus(manager.isActive)}
                      />
                      <StatusPill
                        label={assignedRegions.length ? "Assigned" : "Unassigned"}
                        tone={getToneForStatus(assignedRegions.length ? "APPROVED" : "PENDING")}
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

          <ChipSelector
            label="Assigned regions"
            selectedIds={form.managedRegionIds}
            options={selectableRegions.map((region) => ({
              id: region.id,
              name: formatRegionLabel(region),
            }))}
            onToggle={toggleRegionSelection}
          />

          {!selectableRegions.length ? (
            <p className="text-sm text-ink-muted">
              No active regions are available yet. Create regions first, then come back to map them here.
            </p>
          ) : null}

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
