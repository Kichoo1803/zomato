import { useEffect, useState, type FormEvent } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createEvent,
  deleteEvent,
  getEvents,
  getRegionsAdmin,
  getRestaurants,
  updateEvent,
  type AdminEvent,
  type AdminRegion,
  type AdminRestaurant,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  AddButton,
  PAGE_SIZE,
  RefreshButton,
  RowActions,
  formatDateTime,
  getToneForStatus,
  matchesSearch,
  paginate,
  toLabel,
} from "./admin-shared";

type AssignmentType = "ALL" | "RESTAURANT" | "REGION";
type EventStatusValue = AdminEvent["status"];

type EventFormState = {
  title: string;
  description: string;
  assignmentType: AssignmentType;
  restaurantId: string;
  regionId: string;
  imageUrl: string;
  startsAt: string;
  endsAt: string;
  discountLabel: string;
  status: EventStatusValue;
};

const EVENT_STATUS_OPTIONS: EventStatusValue[] = ["ACTIVE", "INACTIVE", "EXPIRED"];

const emptyForm: EventFormState = {
  title: "",
  description: "",
  assignmentType: "ALL",
  restaurantId: "",
  regionId: "",
  imageUrl: "",
  startsAt: "",
  endsAt: "",
  discountLabel: "",
  status: "ACTIVE",
};

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};

const getAssignmentType = (event: AdminEvent): AssignmentType =>
  event.restaurantId ? "RESTAURANT" : event.regionId ? "REGION" : "ALL";

const getAssignmentLabel = (event: AdminEvent) => {
  if (event.restaurant) {
    return event.restaurant.name;
  }

  if (event.region) {
    return `${event.region.name} • ${event.region.stateName}`;
  }

  return "All restaurants";
};

const getFormStatusValue = (event: AdminEvent): EventStatusValue => {
  if (event.status === "EXPIRED" && new Date(event.endsAt).getTime() < Date.now()) {
    return "ACTIVE";
  }

  return event.status;
};

export const AdminEventsPage = () => {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([]);
  const [regions, setRegions] = useState<AdminRegion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingEventId, setTogglingEventId] = useState<number | null>(null);
  const [form, setForm] = useState<EventFormState>(emptyForm);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [eventRows, restaurantRows, regionRows] = await Promise.all([
        getEvents(),
        getRestaurants(),
        getRegionsAdmin(),
      ]);
      setEvents(eventRows);
      setRestaurants(restaurantRows);
      setRegions(regionRows);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load events right now."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openCreateModal = () => {
    setEditingEvent(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (event: AdminEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description,
      assignmentType: getAssignmentType(event),
      restaurantId: event.restaurantId ? String(event.restaurantId) : "",
      regionId: event.regionId ? String(event.regionId) : "",
      imageUrl: event.imageUrl ?? "",
      startsAt: toDateTimeLocalValue(event.startsAt),
      endsAt: toDateTimeLocalValue(event.endsAt),
      discountLabel: event.discountLabel ?? "",
      status: getFormStatusValue(event),
    });
    setIsModalOpen(true);
  };

  const filteredEvents = events.filter((event) => {
    const haystack = `${event.title} ${event.description} ${event.discountLabel ?? ""} ${getAssignmentLabel(event)}`;
    const matchesAssignment =
      assignmentFilter === "ALL" ||
      (assignmentFilter === "ALL_RESTAURANTS" && event.appliesToAllRestaurants) ||
      (assignmentFilter === "RESTAURANT" && Boolean(event.restaurantId)) ||
      (assignmentFilter === "REGION" && Boolean(event.regionId));

    return (
      (!search || matchesSearch(haystack, search)) &&
      matchesAssignment &&
      (statusFilter === "ALL" || event.status === statusFilter)
    );
  });

  const pagedEvents = paginate(filteredEvents, page);

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    if (form.assignmentType === "RESTAURANT" && !form.restaurantId) {
      toast.error("Choose a restaurant for this event.");
      return;
    }

    if (form.assignmentType === "REGION" && !form.regionId) {
      toast.error("Choose a region for this event.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim() || null,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        discountLabel: form.discountLabel.trim() || null,
        status: form.status,
        ...(form.assignmentType === "RESTAURANT"
          ? {
              restaurantId: Number(form.restaurantId),
              regionId: null,
            }
          : form.assignmentType === "REGION"
            ? {
                restaurantId: null,
                regionId: Number(form.regionId),
              }
            : {
                restaurantId: null,
                regionId: null,
              }),
      };

      if (editingEvent) {
        await updateEvent(editingEvent.id, payload);
        toast.success("Event updated successfully.");
      } else {
        await createEvent(payload);
        toast.success("Event created successfully.");
      }

      setIsModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save this event."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteEvent(deleteTarget.id);
      toast.success("Event deleted successfully.");
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to delete this event."));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (event: AdminEvent) => {
    const nextStatus = event.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    setTogglingEventId(event.id);
    try {
      await updateEvent(event.id, { status: nextStatus });
      toast.success(`Event ${nextStatus === "ACTIVE" ? "activated" : "deactivated"} successfully.`);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update this event status."));
    } finally {
      setTogglingEventId(null);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Restaurant events"
        title="Campaign moments and local experiences."
        description="Create, adjust, and retire restaurant, region, or platform-wide events without disturbing the existing admin surfaces."
        action={
          <div className="flex gap-3">
            <RefreshButton onClick={() => void loadData()} />
            <AddButton label="Add event" onClick={openCreateModal} />
          </div>
        }
      />

      <AdminToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by title, event copy, or assignment"
        filters={
          <>
            <Select
              value={assignmentFilter}
              onChange={(event) => setAssignmentFilter(event.target.value)}
              className="min-w-[180px]"
            >
              <option value="ALL">All assignments</option>
              <option value="ALL_RESTAURANTS">All restaurants</option>
              <option value="RESTAURANT">Restaurant specific</option>
              <option value="REGION">Region specific</option>
            </Select>
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="min-w-[180px]"
            >
              <option value="ALL">All states</option>
              {EVENT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {toLabel(status)}
                </option>
              ))}
            </Select>
          </>
        }
      />

      {isLoading ? (
        <AdminLoadingState />
      ) : (
        <>
          <AdminDataTable
            rows={pagedEvents.items}
            getRowKey={(event) => event.id}
            emptyTitle="No events found"
            emptyDescription="Create an event or widen the filters to see more entries."
            columns={[
              {
                key: "event",
                label: "Event",
                render: (event) => (
                  <div>
                    <p className="font-semibold text-ink">{event.title}</p>
                    <p className="mt-1 text-xs text-ink-muted">{event.description}</p>
                    {event.discountLabel ? (
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                        {event.discountLabel}
                      </p>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "assignment",
                label: "Assignment",
                render: (event) => (
                  <div>
                    <p className="font-semibold text-ink">{getAssignmentLabel(event)}</p>
                    <p className="text-xs text-ink-muted">
                      {event.appliesToAllRestaurants
                        ? "Visible to every restaurant"
                        : event.restaurantId
                          ? "Restaurant event"
                          : "Regional event"}
                    </p>
                  </div>
                ),
              },
              {
                key: "schedule",
                label: "Schedule",
                render: (event) => (
                  <div>
                    <p className="text-sm text-ink-soft">{formatDateTime(event.startsAt)}</p>
                    <p className="text-xs text-ink-muted">Ends {formatDateTime(event.endsAt)}</p>
                  </div>
                ),
              },
              {
                key: "status",
                label: "State",
                render: (event) => (
                  <div className="space-y-2">
                    <StatusPill label={toLabel(event.status)} tone={getToneForStatus(event.status)} />
                    {event.imageUrl ? <StatusPill label="Image attached" tone="info" /> : null}
                  </div>
                ),
              },
              {
                key: "actions",
                label: "Actions",
                render: (event) => (
                  <div className="space-y-3">
                    {event.status !== "EXPIRED" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-3 py-2 text-xs"
                        onClick={() => void handleToggleStatus(event)}
                        disabled={togglingEventId === event.id}
                      >
                        {togglingEventId === event.id
                          ? "Saving..."
                          : event.status === "ACTIVE"
                            ? "Deactivate"
                            : "Activate"}
                      </Button>
                    ) : null}
                    <RowActions onEdit={() => openEditModal(event)} onDelete={() => setDeleteTarget(event)} />
                  </div>
                ),
              },
            ]}
          />
          {filteredEvents.length > PAGE_SIZE ? (
            <Pagination
              page={pagedEvents.currentPage}
              totalPages={pagedEvents.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEvent ? "Edit event" : "Add event"}
        className="max-w-4xl"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
            />
            <Select
              label="Assignment"
              value={form.assignmentType}
              onChange={(event) =>
                setForm({
                  ...form,
                  assignmentType: event.target.value as AssignmentType,
                  restaurantId: event.target.value === "RESTAURANT" ? form.restaurantId : "",
                  regionId: event.target.value === "REGION" ? form.regionId : "",
                })
              }
            >
              <option value="ALL">All restaurants</option>
              <option value="RESTAURANT">Specific restaurant</option>
              <option value="REGION">Specific region</option>
            </Select>
            <Input
              label="Start date and time"
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
              required
            />
            <Input
              label="End date and time"
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
              required
            />
            {form.assignmentType === "RESTAURANT" ? (
              <Select
                label="Restaurant"
                value={form.restaurantId}
                onChange={(event) => setForm({ ...form, restaurantId: event.target.value })}
                required
              >
                <option value="">Select restaurant</option>
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </Select>
            ) : null}
            {form.assignmentType === "REGION" ? (
              <Select
                label="Region"
                value={form.regionId}
                onChange={(event) => setForm({ ...form, regionId: event.target.value })}
                required
              >
                <option value="">Select region</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name} • {region.stateName}
                  </option>
                ))}
              </Select>
            ) : null}
            <Input
              label="Discount label"
              value={form.discountLabel}
              onChange={(event) => setForm({ ...form, discountLabel: event.target.value })}
              placeholder="Weekend 20% off"
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value as EventStatusValue })}
            >
              {EVENT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {toLabel(status)}
                </option>
              ))}
            </Select>
            <Input
              label="Image URL"
              value={form.imageUrl}
              onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
              placeholder="https://"
            />
          </div>
          <Textarea
            label="Description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            required
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
              {isSubmitting ? "Saving..." : editingEvent ? "Save changes" : "Create event"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDangerModal
        open={Boolean(deleteTarget)}
        title="Delete event"
        description="This permanently removes the event from restaurant and admin views."
        confirmLabel="Delete event"
        isSubmitting={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteEvent()}
      />
    </div>
  );
};
