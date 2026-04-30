import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getDistrictOptions,
  getSingleRegionSelection,
  resolveRegionOptions,
  type RegionOptions,
} from "@/lib/india-regions";

type AssignmentTarget = {
  id: number;
  fullName: string;
  opsState?: string | null;
  opsDistrict?: string | null;
  opsNotes?: string | null;
};

export const OperationsAssignmentModal = ({
  open,
  target,
  regionOptions,
  restrictToAssignedRegion,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  target: AssignmentTarget | null;
  regionOptions?: RegionOptions | null;
  restrictToAssignedRegion?: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: { state?: string; district?: string; notes?: string }) => void;
}) => {
  const [form, setForm] = useState({
    state: "",
    district: "",
    notes: "",
  });

  useEffect(() => {
    if (!target) {
      setForm({ state: "", district: "", notes: "" });
      return;
    }

    setForm({
      state: target.opsState ?? "",
      district: target.opsDistrict ?? "",
      notes: target.opsNotes ?? "",
    });
  }, [target]);

  const exactRegionSelection = getSingleRegionSelection(regionOptions);
  const selectableOptions = resolveRegionOptions(regionOptions, {
    includeIndiaDefaults: !restrictToAssignedRegion,
  });
  const assignedState = restrictToAssignedRegion ? exactRegionSelection.state : "";
  const assignedDistrict = restrictToAssignedRegion ? exactRegionSelection.district : "";
  const districtOptions = getDistrictOptions(form.state, regionOptions, {
    includeIndiaDefaults: !restrictToAssignedRegion,
  });

  useEffect(() => {
    if (!restrictToAssignedRegion || !assignedState) {
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      state: assignedState,
      district: assignedDistrict,
    }));
  }, [assignedDistrict, assignedState, restrictToAssignedRegion]);

  return (
    <Modal open={open} onClose={onClose} title={target ? `Assign ${target.fullName}` : "Update assignment"} className="max-w-2xl">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            state: form.state || undefined,
            district: form.district || undefined,
            notes: form.notes,
          });
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="State"
            value={form.state}
            onChange={(event) =>
              setForm({
                ...form,
                state: event.target.value,
                district: "",
              })
            }
            disabled={Boolean(restrictToAssignedRegion && assignedState)}
          >
            {restrictToAssignedRegion && assignedState ? null : <option value="">Select state</option>}
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
            disabled={!form.state || Boolean(restrictToAssignedRegion && assignedDistrict)}
          >
            {restrictToAssignedRegion && assignedDistrict ? null : (
              <option value="">{form.state ? "Select district" : "Choose a state first"}</option>
            )}
            {districtOptions.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </Select>
        </div>
        <Textarea
          label="Operational notes"
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          placeholder="Capture assignment remarks, escalation context, or coordination notes."
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save assignment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export const RegionalScopeEmptyState = ({
  title = "No region assigned",
  description = "No region assigned. Contact admin.",
}: {
  title?: string;
  description?: string;
}) => <EmptyState title={title} description={description} />;
