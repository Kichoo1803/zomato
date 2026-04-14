import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AdminDataTable,
  AdminDetailsGrid,
  AdminLoadingState,
  AdminToolbar,
  ConfirmDangerModal,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import {
  createDeliveryPartner,
  disableDeliveryPartner,
  getDeliveryPartners,
  updateDeliveryPartner,
  type AdminDeliveryPartner,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  AddButton,
  PAGE_SIZE,
  RefreshButton,
  RowActions,
  ToggleField,
  VEHICLE_OPTIONS,
  getToneForStatus,
  matchesSearch,
  paginate,
  toLabel,
} from "./admin-shared";

export const AdminDeliveryPartnersPage = () => {
  const [partners, setPartners] = useState<AdminDeliveryPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [verificationFilter, setVerificationFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [detailsPartner, setDetailsPartner] = useState<AdminDeliveryPartner | null>(null);
  const [editingPartner, setEditingPartner] = useState<AdminDeliveryPartner | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminDeliveryPartner | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({
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
  });

  const loadPartners = async () => {
    setIsLoading(true);
    try {
      setPartners(await getDeliveryPartners());
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load delivery partners."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPartners();
  }, []);

  const openCreateModal = () => {
    setEditingPartner(null);
    setForm({
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
    });
    setIsModalOpen(true);
  };

  const openEditModal = (partner: AdminDeliveryPartner) => {
    setEditingPartner(partner);
    setForm({
      fullName: partner.user.fullName,
      email: partner.user.email,
      phone: partner.user.phone ?? "",
      password: "",
      profileImage: partner.user.profileImage ?? "",
      vehicleType: partner.vehicleType,
      vehicleNumber: partner.vehicleNumber ?? "",
      licenseNumber: partner.licenseNumber ?? "",
      availabilityStatus: partner.availabilityStatus,
      isVerified: partner.isVerified,
    });
    setIsModalOpen(true);
  };

  const filteredPartners = partners.filter((partner) => {
    const haystack = `${partner.user.fullName} ${partner.user.email} ${partner.vehicleNumber ?? ""} ${partner.licenseNumber ?? ""}`;
    if (search && !matchesSearch(haystack, search)) {
      return false;
    }
    if (statusFilter !== "ALL" && partner.availabilityStatus !== statusFilter) {
      return false;
    }
    if (verificationFilter === "VERIFIED" && !partner.isVerified) {
      return false;
    }
    if (verificationFilter === "UNVERIFIED" && partner.isVerified) {
      return false;
    }
    return true;
  });

  const pagedPartners = paginate(filteredPartners, page);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingPartner && !form.password.trim()) {
      toast.error("A password is required when creating a delivery partner.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone.trim() || undefined,
        password: form.password.trim() || undefined,
        profileImage: form.profileImage.trim() || undefined,
        vehicleType: form.vehicleType,
        vehicleNumber: form.vehicleNumber.trim() || undefined,
        licenseNumber: form.licenseNumber.trim() || undefined,
        availabilityStatus: form.availabilityStatus,
        isVerified: form.isVerified,
      };

      if (editingPartner) {
        await updateDeliveryPartner(editingPartner.id, payload);
        toast.success("Delivery partner updated successfully.");
      } else {
        await createDeliveryPartner({ ...payload, password: form.password });
        toast.success("Delivery partner created successfully.");
      }

      setIsModalOpen(false);
      await loadPartners();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save this delivery partner."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisablePartner = async () => {
    if (!deleteTarget) {
      return;
    }
    setIsDeleting(true);
    try {
      await disableDeliveryPartner(deleteTarget.id);
      toast.success("Delivery partner disabled successfully.");
      setDeleteTarget(null);
      await loadPartners();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to disable this delivery partner."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Delivery network"
        title="Rider verification and fleet readiness."
        description="Manage rider accounts, vehicle details, verification, and live availability in one place."
        action={<div className="flex gap-3"><RefreshButton onClick={() => void loadPartners()} /><AddButton label="Add partner" onClick={openCreateModal} /></div>}
      />

      <AdminToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by rider, email, vehicle, or license"
        filters={
          <>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-w-[180px]">
              <option value="ALL">All availability states</option>
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
              <option value="BUSY">Busy</option>
            </Select>
            <Select value={verificationFilter} onChange={(event) => setVerificationFilter(event.target.value)} className="min-w-[180px]">
              <option value="ALL">All verification states</option>
              <option value="VERIFIED">Verified</option>
              <option value="UNVERIFIED">Unverified</option>
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
            emptyDescription="Adjust your filters or add a new delivery partner."
            columns={[
              { key: "partner", label: "Partner", render: (partner) => <div><p className="font-semibold text-ink">{partner.user.fullName}</p><p className="text-xs text-ink-muted">{partner.user.email}</p><p className="text-xs text-ink-muted">{partner.user.phone ?? "No phone available"}</p></div> },
              { key: "vehicle", label: "Vehicle", render: (partner) => <div><p className="font-semibold text-ink">{toLabel(partner.vehicleType)}</p><p className="text-xs text-ink-muted">{partner.vehicleNumber ?? "Vehicle number unavailable"}</p></div> },
              { key: "status", label: "Status", render: (partner) => <div className="space-y-2"><StatusPill label={toLabel(partner.availabilityStatus)} tone={getToneForStatus(partner.availabilityStatus)} /><StatusPill label={partner.isVerified ? "Verified" : "Pending verification"} tone={getToneForStatus(partner.isVerified)} /></div> },
              { key: "performance", label: "Performance", render: (partner) => <div><p className="font-semibold text-ink">{partner.totalDeliveries} deliveries</p><p className="text-xs text-ink-muted">{partner.avgRating.toFixed(2)} average rating</p></div> },
              { key: "actions", label: "Actions", render: (partner) => <RowActions onView={() => setDetailsPartner(partner)} onEdit={() => openEditModal(partner)} onDelete={() => setDeleteTarget(partner)} deleteLabel="Disable" /> },
            ]}
          />
          {filteredPartners.length > PAGE_SIZE ? <Pagination page={pagedPartners.currentPage} totalPages={pagedPartners.totalPages} onPageChange={setPage} /> : null}
        </>
      )}

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPartner ? "Edit delivery partner" : "Add delivery partner"} className="max-w-3xl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Full name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
            <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
            <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <Input label={editingPartner ? "New password (optional)" : "Password"} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editingPartner} />
            <Input label="Profile image URL" value={form.profileImage} onChange={(event) => setForm({ ...form, profileImage: event.target.value })} />
            <Select label="Vehicle type" value={form.vehicleType} onChange={(event) => setForm({ ...form, vehicleType: event.target.value })}>
              {VEHICLE_OPTIONS.map((vehicle) => <option key={vehicle} value={vehicle}>{toLabel(vehicle)}</option>)}
            </Select>
            <Input label="Vehicle number" value={form.vehicleNumber} onChange={(event) => setForm({ ...form, vehicleNumber: event.target.value })} />
            <Input label="License number" value={form.licenseNumber} onChange={(event) => setForm({ ...form, licenseNumber: event.target.value })} />
            <Select label="Availability" value={form.availabilityStatus} onChange={(event) => setForm({ ...form, availabilityStatus: event.target.value })}>
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
              <option value="BUSY">Busy</option>
            </Select>
          </div>
          <ToggleField label="Verified partner" checked={form.isVerified} onChange={(checked) => setForm({ ...form, isVerified: checked })} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : editingPartner ? "Save changes" : "Create partner"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(detailsPartner)} onClose={() => setDetailsPartner(null)} title={detailsPartner?.user.fullName} className="max-w-3xl">
        {detailsPartner ? (
          <div className="space-y-5">
            <AdminDetailsGrid items={[
              { label: "Email", value: detailsPartner.user.email },
              { label: "Phone", value: detailsPartner.user.phone ?? "No phone available" },
              { label: "Vehicle", value: `${toLabel(detailsPartner.vehicleType)} • ${detailsPartner.vehicleNumber ?? "No number"}` },
              { label: "License", value: detailsPartner.licenseNumber ?? "No license number recorded" },
              { label: "Deliveries", value: detailsPartner.totalDeliveries.toString() },
              { label: "Average rating", value: detailsPartner.avgRating.toFixed(2) },
            ]} />
            <SurfaceCard className="space-y-4">
              <SectionHeading title="Documents" description="Verification paperwork currently on file." />
              {detailsPartner.documents.length ? (
                <div className="space-y-3">
                  {detailsPartner.documents.map((document) => <div key={document.id} className="flex items-center justify-between rounded-[1.5rem] bg-cream px-4 py-4"><div><p className="font-semibold text-ink">{document.name}</p><p className="text-xs text-ink-muted">{document.fileUrl}</p></div><StatusPill label={toLabel(document.status)} tone={getToneForStatus(document.status)} /></div>)}
                </div>
              ) : (
                <EmptyState title="No documents uploaded" description="This partner has not submitted any documents yet." />
              )}
            </SurfaceCard>
          </div>
        ) : null}
      </Modal>

      <ConfirmDangerModal
        open={Boolean(deleteTarget)}
        title="Disable delivery partner"
        description="This safely disables the rider account and moves them offline while preserving order history."
        confirmLabel="Disable partner"
        isSubmitting={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDisablePartner()}
      />
    </div>
  );
};
