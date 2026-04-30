import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AddButton, RefreshButton, formatDateTime } from "@/pages/admin/admin-shared";
import { AdminDataTable, AdminLoadingState, AdminToolbar } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageLoadErrorState } from "@/components/ui/page-load-error-state";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { getApiErrorMessage } from "@/lib/auth";
import {
  getDistrictOptions,
  getSingleRegionSelection,
  resolveRegionOptions,
} from "@/lib/india-regions";
import {
  createOperationsRegionNote,
  getOperationsCommunications,
  getOperationsRegions,
  type OperationsRegionsSummary,
  updateOperationsRegionNote,
  type OperationsCommunications,
  type OperationsRegionNote,
} from "@/lib/ops";

export const OpsCommunicationsPage = () => {
  const { user } = useAuth();
  const [communications, setCommunications] = useState<OperationsCommunications | null>(null);
  const [regionOptions, setRegionOptions] = useState<{ states: string[]; districtsByState: Record<string, string[]> } | null>(null);
  const [scopeMessage, setScopeMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [editingNote, setEditingNote] = useState<OperationsRegionNote | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    state: "",
    district: "",
    title: "",
    message: "",
  });
  const isRegionalManager = user?.role === "REGIONAL_MANAGER";

  const loadCommunications = async () => {
    setIsLoading(true);
    try {
      const [communicationsData, regions] = await Promise.all([
        getOperationsCommunications({
          search: search || undefined,
          state: stateFilter || undefined,
          district: districtFilter || undefined,
        }),
        getOperationsRegions({
          state: stateFilter || undefined,
        }),
      ]);
      setCommunications(communicationsData);
      setRegionOptions(regions.regionOptions);
      setScopeMessage((regions as OperationsRegionsSummary).scopeMessage ?? null);
      setErrorMessage(null);
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load operations communications.");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCommunications();
  }, [search, stateFilter, districtFilter]);

  const selectableOptions = useMemo(
    () =>
      resolveRegionOptions(regionOptions, {
        includeIndiaDefaults: !isRegionalManager,
      }),
    [isRegionalManager, regionOptions],
  );
  const districtOptions = useMemo(
    () =>
      getDistrictOptions(form.state || stateFilter, regionOptions, {
        includeIndiaDefaults: !isRegionalManager,
      }),
    [form.state, isRegionalManager, regionOptions, stateFilter],
  );

  useEffect(() => {
    if (!isRegionalManager || !regionOptions) {
      return;
    }

    const assignedRegion = getSingleRegionSelection(regionOptions);

    if (stateFilter !== assignedRegion.state) {
      setStateFilter(assignedRegion.state);
    }

    if (districtFilter !== assignedRegion.district) {
      setDistrictFilter(assignedRegion.district);
    }
  }, [districtFilter, isRegionalManager, regionOptions, stateFilter]);

  const openCreateModal = () => {
    setEditingNote(null);
    setForm({
      state: stateFilter,
      district: districtFilter,
      title: "",
      message: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (note: OperationsRegionNote) => {
    setEditingNote(note);
    setForm({
      state: note.state,
      district: note.district ?? "",
      title: note.title,
      message: note.message,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      if (editingNote) {
        await updateOperationsRegionNote(editingNote.id, {
          state: form.state,
          district: form.district || undefined,
          title: form.title,
          message: form.message,
        });
        toast.success("Region note updated successfully.");
      } else {
        await createOperationsRegionNote({
          state: form.state,
          district: form.district || undefined,
          title: form.title,
          message: form.message,
        });
        toast.success("Region note created successfully.");
      }
      setIsModalOpen(false);
      await loadCommunications();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save this region note."));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !communications) {
    return isLoading ? (
      <AdminLoadingState rows={6} />
    ) : (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Communications"
          title="Region notes and assignment context in one place."
          description="Keep India region coordination practical with scoped region notes, owner notes, partner notes, and assignment remarks."
          action={
            <div className="flex gap-3">
              <RefreshButton onClick={() => void loadCommunications()} />
              <AddButton label="Add region note" onClick={openCreateModal} />
            </div>
          }
        />
        <PageLoadErrorState
          title="Unable to load operations communications"
          description={errorMessage ?? "Regional notes and communications could not be loaded right now."}
          onRetry={() => void loadCommunications()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Communications"
        title="Region notes and assignment context in one place."
        description="Keep India region coordination practical with scoped region notes, owner notes, partner notes, and assignment remarks."
        action={
          <div className="flex gap-3">
            <RefreshButton onClick={() => void loadCommunications()} />
            {scopeMessage ? null : <AddButton label="Add region note" onClick={openCreateModal} />}
          </div>
        }
      />

      {isRegionalManager && scopeMessage ? (
        <SurfaceCard>
          <EmptyState title="No region assigned" description={scopeMessage} />
        </SurfaceCard>
      ) : null}

      {isRegionalManager && scopeMessage ? null : (
        <>

      <AdminToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search notes, owners, partners, or messages"
        filters={
          <>
            <Select
              value={stateFilter}
              onChange={(event) => { setStateFilter(event.target.value); setDistrictFilter(""); }}
              className="min-w-[180px]"
              disabled={isRegionalManager}
            >
              {isRegionalManager ? null : <option value="">All states</option>}
              {selectableOptions.states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
            <Select
              value={districtFilter}
              onChange={(event) => setDistrictFilter(event.target.value)}
              className="min-w-[180px]"
              disabled={!stateFilter || isRegionalManager}
            >
              {isRegionalManager ? null : (
                <option value="">{stateFilter ? "All districts" : "Choose a state first"}</option>
              )}
              {getDistrictOptions(stateFilter, regionOptions, {
                includeIndiaDefaults: !isRegionalManager,
              }).map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </Select>
          </>
        }
      />

      <SurfaceCard className="space-y-5">
        <SectionHeading title="Region notes" description="The smallest safe coordination layer for state and district operations." />
        <AdminDataTable
          rows={communications.regionNotes}
          getRowKey={(note) => note.id}
          emptyTitle="No region notes found"
          emptyDescription="Add a state or district note to capture escalations and coordination updates."
          columns={[
            {
              key: "note",
              label: "Note",
              render: (note) => (
                <div>
                  <p className="font-semibold text-ink">{note.title}</p>
                  <p className="mt-2 text-sm leading-7 text-ink-soft">{note.message}</p>
                </div>
              ),
            },
            {
              key: "region",
              label: "Region",
              render: (note) => (
                <p className="font-semibold text-ink">
                  {[note.state, note.district].filter(Boolean).join(" • ")}
                </p>
              ),
            },
            {
              key: "updated",
              label: "Updated",
              render: (note) => (
                <div>
                  <p className="font-semibold text-ink">{note.updatedBy?.fullName ?? "Operations"}</p>
                  <p className="text-xs text-ink-muted">{formatDateTime(note.updatedAt)}</p>
                </div>
              ),
            },
            {
              key: "actions",
              label: "Actions",
              render: (note) => (
                <Button variant="secondary" onClick={() => openEditModal(note)}>
                  Edit note
                </Button>
              ),
            },
          ]}
        />
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard className="space-y-5">
          <SectionHeading title="Owner notes" description="Assignment remarks and owner-specific coordination context." />
          {communications.ownerNotes.length ? (
            <div className="space-y-3">
              {communications.ownerNotes.map((owner) => (
                <div key={owner.id} className="rounded-[1.5rem] bg-cream px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{owner.fullName}</p>
                      <p className="text-xs text-ink-muted">{[owner.opsState, owner.opsDistrict].filter(Boolean).join(" • ") || "Unassigned"}</p>
                    </div>
                    <StatusPill label="Owner note" tone="info" />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-soft">{owner.opsNotes}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No owner notes found" description="Owner assignment notes will appear here once the operations team starts saving remarks." />
          )}
        </SurfaceCard>

        <SurfaceCard className="space-y-5">
          <SectionHeading title="Partner notes" description="Delivery assignment remarks and rider-specific coordination context." />
          {communications.partnerNotes.length ? (
            <div className="space-y-3">
              {communications.partnerNotes.map((partner) => (
                <div key={partner.id} className="rounded-[1.5rem] bg-cream px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{partner.fullName}</p>
                      <p className="text-xs text-ink-muted">{[partner.opsState, partner.opsDistrict].filter(Boolean).join(" • ") || "Unassigned"}</p>
                    </div>
                    <StatusPill label={partner.deliveryProfile.availabilityStatus} tone="info" />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-soft">{partner.opsNotes}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No partner notes found" description="Partner assignment notes will appear here once the operations team starts saving remarks." />
          )}
        </SurfaceCard>
      </div>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingNote ? "Edit region note" : "Add region note"} className="max-w-3xl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="State"
              value={form.state}
              onChange={(event) => setForm({ ...form, state: event.target.value, district: "" })}
              required
              disabled={isRegionalManager}
            >
              {isRegionalManager ? null : <option value="">Select state</option>}
              {selectableOptions.states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
            <Select
              label="District"
              value={form.district}
              onChange={(event) => setForm({ ...form, district: event.target.value })}
              disabled={!form.state || isRegionalManager}
            >
              {isRegionalManager ? null : (
                <option value="">{form.state ? "Optional district" : "Choose a state first"}</option>
              )}
              {districtOptions.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </Select>
          </div>
          <Input label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <Textarea label="Message" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} required />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : editingNote ? "Save note" : "Create note"}
            </Button>
          </div>
        </form>
      </Modal>
        </>
      )}
    </div>
  );
};
