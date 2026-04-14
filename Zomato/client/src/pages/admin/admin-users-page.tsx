import { useEffect, useState } from "react";
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
import { createUser, disableUser, getUsers, updateUser, type AdminUser } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import type { UserRole } from "@/types/auth";
import {
  AddButton,
  PAGE_SIZE,
  ROLE_OPTIONS,
  RefreshButton,
  RowActions,
  ToggleField,
  formatCurrency,
  formatDateTime,
  getToneForStatus,
  matchesSearch,
  paginate,
  toLabel,
} from "./admin-shared";

const normalizePhoneInput = (value: string) => {
  const hasLeadingPlus = value.trimStart().startsWith("+");
  const digits = value.replace(/\D/g, "");

  if (hasLeadingPlus) {
    return digits ? `+${digits}` : "+";
  }

  return digits;
};

export const AdminUsersPage = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    role: "CUSTOMER" as UserRole,
    profileImage: "",
    walletBalance: "0",
    isActive: true,
  });

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      setUsers(await getUsers());
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load users."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setForm({
      fullName: "",
      email: "",
      phone: "",
      password: "",
      role: "CUSTOMER",
      profileImage: "",
      walletBalance: "0",
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user);
    setForm({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone ?? "",
      password: "",
      role: user.role,
      profileImage: user.profileImage ?? "",
      walletBalance: String(user.walletBalance ?? 0),
      isActive: user.isActive,
    });
    setIsModalOpen(true);
  };

  const filteredUsers = users.filter((user) => {
    const haystack = `${user.fullName} ${user.email} ${user.phone ?? ""}`;
    if (search && !matchesSearch(haystack, search)) {
      return false;
    }
    if (roleFilter !== "ALL" && user.role !== roleFilter) {
      return false;
    }
    if (statusFilter === "ACTIVE" && !user.isActive) {
      return false;
    }
    if (statusFilter === "INACTIVE" && user.isActive) {
      return false;
    }
    return true;
  });

  const pagedUsers = paginate(filteredUsers, page);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser && !form.password.trim()) {
      toast.error("A password is required when creating a user.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone.trim() || undefined,
        password: form.password.trim() || undefined,
        role: form.role,
        profileImage: form.profileImage.trim() || undefined,
        walletBalance: Number(form.walletBalance || "0"),
        isActive: form.isActive,
      };

      if (editingUser) {
        await updateUser(editingUser.id, payload);
        toast.success("User updated successfully.");
      } else {
        await createUser({ ...payload, password: form.password });
        toast.success("User created successfully.");
      }

      setIsModalOpen(false);
      await loadUsers();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save the user."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisableUser = async () => {
    if (!deleteTarget) {
      return;
    }
    setIsDeleting(true);
    try {
      await disableUser(deleteTarget.id);
      toast.success("User disabled successfully.");
      setDeleteTarget(null);
      await loadUsers();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to disable this user."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Users"
        title="Customer and operator management."
        description="Search, create, update, and safely disable platform users without leaving the existing Luxe design system."
        action={<div className="flex gap-3"><RefreshButton onClick={() => void loadUsers()} /><AddButton label="Add user" onClick={openCreateModal} /></div>}
      />

      <AdminToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, email, or phone"
        filters={
          <>
            <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="min-w-[180px]">
              <option value="ALL">All roles</option>
              {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{toLabel(role)}</option>)}
            </Select>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-w-[180px]">
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
            rows={pagedUsers.items}
            getRowKey={(user) => user.id}
            emptyTitle="No users match these filters"
            emptyDescription="Try a broader search or create a new account."
            columns={[
              { key: "user", label: "User", render: (user) => <div><p className="font-semibold text-ink">{user.fullName}</p><p className="text-xs text-ink-muted">{user.email}</p><p className="text-xs text-ink-muted">{user.phone ?? "No phone on file"}</p></div> },
              { key: "role", label: "Role", render: (user) => <StatusPill label={toLabel(user.role)} tone={getToneForStatus(user.role)} /> },
              { key: "status", label: "Status", render: (user) => <StatusPill label={user.isActive ? "Active" : "Inactive"} tone={getToneForStatus(user.isActive)} /> },
              { key: "wallet", label: "Wallet", render: (user) => <span className="font-semibold text-ink">{formatCurrency(user.walletBalance ?? 0)}</span> },
              { key: "activity", label: "Last login", render: (user) => formatDateTime(user.lastLoginAt) },
              { key: "actions", label: "Actions", render: (user) => <RowActions onEdit={() => openEditModal(user)} onDelete={() => setDeleteTarget(user)} deleteLabel="Disable" /> },
            ]}
          />
          {filteredUsers.length > PAGE_SIZE ? <Pagination page={pagedUsers.currentPage} totalPages={pagedUsers.totalPages} onPageChange={setPage} /> : null}
        </>
      )}

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? "Edit user" : "Add user"} className="max-w-3xl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Full name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
            <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
            <Input
              label="Phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: normalizePhoneInput(event.target.value) })}
            />
            <Input label={editingUser ? "New password (optional)" : "Password"} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editingUser} />
            <Select label="Role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}>
              {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{toLabel(role)}</option>)}
            </Select>
            <Input label="Wallet balance" type="number" min="0" step="1" value={form.walletBalance} onChange={(event) => setForm({ ...form, walletBalance: event.target.value })} />
          </div>
          <Input label="Profile image URL" value={form.profileImage} onChange={(event) => setForm({ ...form, profileImage: event.target.value })} />
          <ToggleField label="Account is active" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : editingUser ? "Save changes" : "Create user"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDangerModal
        open={Boolean(deleteTarget)}
        title="Disable user account"
        description="This is a safe soft-delete. The account will be disabled and existing platform records will stay intact."
        confirmLabel="Disable user"
        isSubmitting={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDisableUser()}
      />
    </div>
  );
};
