import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AdminDataTable,
  AdminLoadingState,
  AdminToolbar,
  ConfirmDangerModal,
} from "@/components/admin/admin-ui";
import { EventRefundPolicySection } from "@/components/events/event-refund-policy-section";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createEventTemplate,
  createEvent,
  deleteEventTemplate,
  deleteEvent,
  getEventAttendees,
  getEventTemplates,
  getEvents,
  getRegionsAdmin,
  getRestaurants,
  markEventBookingAttended,
  updateEventBookingRefund,
  updateEventTemplate,
  updateEvent,
  type AdminEvent,
  type AdminEventAttendee,
  type AdminEventAttendeeReport,
  type AdminEventTemplate,
  type AdminRegion,
  type AdminRestaurant,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import { buildEventRefundPolicyPayload } from "@/lib/event-refund-policy";
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
type EventStatusValue = "ACTIVE" | "CANCELLED";

type EventFormState = {
  title: string;
  description: string;
  assignmentType: AssignmentType;
  restaurantId: string;
  regionId: string;
  imageUrl: string;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  bookingStartTime: string;
  bookingEndTime: string;
  discountLabel: string;
  totalSlots: string;
  slotPrice: string;
  maxTicketsPerUser: string;
  cancellationAllowed: boolean;
  refundAllowed: boolean;
  cancellationWithoutRefundAllowed: boolean;
  refundDeadline: string;
  refundPercentage: string;
  cancellationFee: string;
  refundPolicyNote: string;
  status: EventStatusValue;
};

type EventTemplateStatusValue = "ACTIVE" | "CANCELLED";

type EventTemplateFormState = {
  title: string;
  description: string;
  imageUrl: string;
  suggestedDurationMinutes: string;
  suggestedBookingWindowHours: string;
  suggestedSlotPrice: string;
  suggestedMaxSlots: string;
  suggestedMaxTicketsPerUser: string;
  suggestedOfferLabel: string;
  setupChecklist: string;
  requiredItems: string;
  status: EventTemplateStatusValue;
};

const EVENT_STATUS_OPTIONS = ["UPCOMING", "LIVE", "ENDED", "CANCELLED"] as const;
const EVENT_FORM_STATUS_OPTIONS: EventStatusValue[] = ["ACTIVE", "CANCELLED"];
const TEMPLATE_STATUS_OPTIONS: EventTemplateStatusValue[] = ["ACTIVE", "CANCELLED"];

const emptyForm: EventFormState = {
  title: "",
  description: "",
  assignmentType: "ALL",
  restaurantId: "",
  regionId: "",
  imageUrl: "",
  eventDate: "",
  eventStartTime: "",
  eventEndTime: "",
  bookingStartTime: "",
  bookingEndTime: "",
  discountLabel: "",
  totalSlots: "",
  slotPrice: "",
  maxTicketsPerUser: "",
  cancellationAllowed: true,
  refundAllowed: true,
  cancellationWithoutRefundAllowed: false,
  refundDeadline: "",
  refundPercentage: "100",
  cancellationFee: "0",
  refundPolicyNote: "",
  status: "ACTIVE",
};

const emptyTemplateForm: EventTemplateFormState = {
  title: "",
  description: "",
  imageUrl: "",
  suggestedDurationMinutes: "",
  suggestedBookingWindowHours: "",
  suggestedSlotPrice: "",
  suggestedMaxSlots: "",
  suggestedMaxTicketsPerUser: "",
  suggestedOfferLabel: "",
  setupChecklist: "",
  requiredItems: "",
  status: "ACTIVE",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};

const toDateValue = (value?: string | null) => {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
};

const toTimeValue = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const combineDateAndTime = (dateValue: string, timeValue: string) =>
  new Date(`${dateValue}T${timeValue}:00`).toISOString();

const splitLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const joinLines = (value?: string[]) => (value && value.length ? value.join("\n") : "");

const getAssignmentType = (event: AdminEvent): AssignmentType =>
  event.restaurantId ? "RESTAURANT" : event.regionId ? "REGION" : "ALL";

const getAssignmentLabel = (event: AdminEvent) => {
  if (event.restaurant) {
    return event.restaurant.name;
  }

  if (event.region) {
    return `${event.region.name} | ${event.region.stateName}`;
  }

  return "All restaurants";
};

const getFormStatusValue = (event: AdminEvent): EventStatusValue =>
  event.manualStatus === "CANCELLED" ? "CANCELLED" : "ACTIVE";

const getTemplateFormStatusValue = (template: AdminEventTemplate): EventTemplateStatusValue =>
  template.status === "CANCELLED" ? "CANCELLED" : "ACTIVE";

const canApproveRefund = (booking: AdminEventAttendee) =>
  booking.status === "CANCELLED" &&
  booking.paymentStatus !== "FREE" &&
  booking.refundStatus === "PENDING";

const canRejectRefund = (booking: AdminEventAttendee) =>
  booking.status === "CANCELLED" &&
  booking.paymentStatus !== "FREE" &&
  booking.refundStatus === "PENDING";

const canMarkRefunded = (booking: AdminEventAttendee) =>
  booking.status === "CANCELLED" &&
  booking.paymentStatus !== "FREE" &&
  booking.refundStatus === "APPROVED";

const canMarkRefundFailed = (booking: AdminEventAttendee) =>
  booking.status === "CANCELLED" &&
  booking.paymentStatus !== "FREE" &&
  booking.refundStatus === "APPROVED";

export const AdminEventsPage = () => {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [templates, setTemplates] = useState<AdminEventTemplate[]>([]);
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
  const [editingTemplate, setEditingTemplate] = useState<AdminEventTemplate | null>(null);
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<AdminEventTemplate | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isTemplateSubmitting, setIsTemplateSubmitting] = useState(false);
  const [isTemplateDeleting, setIsTemplateDeleting] = useState(false);
  const [togglingEventId, setTogglingEventId] = useState<number | null>(null);
  const [selectedAttendeeEvent, setSelectedAttendeeEvent] = useState<AdminEvent | null>(null);
  const [attendeeReport, setAttendeeReport] = useState<AdminEventAttendeeReport | null>(null);
  const [isLoadingAttendeeReport, setIsLoadingAttendeeReport] = useState(false);
  const [attendingBookingId, setAttendingBookingId] = useState<number | null>(null);
  const [refundUpdatingBookingId, setRefundUpdatingBookingId] = useState<number | null>(null);
  const [refundNotes, setRefundNotes] = useState<Record<number, string>>({});
  const [form, setForm] = useState<EventFormState>(emptyForm);
  const [templateForm, setTemplateForm] = useState<EventTemplateFormState>(emptyTemplateForm);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [eventRows, templateRows, restaurantRows, regionRows] = await Promise.all([
        getEvents(),
        getEventTemplates(),
        getRestaurants(),
        getRegionsAdmin(),
      ]);
      setEvents(eventRows);
      setTemplates(templateRows);
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

  const openCreateTemplateModal = () => {
    setEditingTemplate(null);
    setTemplateForm(emptyTemplateForm);
    setIsTemplateModalOpen(true);
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
      eventDate: toDateValue(event.startsAt),
      eventStartTime: toTimeValue(event.startsAt),
      eventEndTime: toTimeValue(event.endsAt),
      bookingStartTime: toDateTimeLocalValue(event.bookingStartTime),
      bookingEndTime: toDateTimeLocalValue(event.bookingEndTime),
      discountLabel: event.discountLabel ?? "",
      totalSlots: event.totalSlots != null ? String(event.totalSlots) : "",
      slotPrice: event.slotPrice > 0 ? String(event.slotPrice) : "",
      maxTicketsPerUser: event.maxTicketsPerUser != null ? String(event.maxTicketsPerUser) : "",
      cancellationAllowed: event.cancellationAllowed,
      refundAllowed: event.refundAllowed,
      cancellationWithoutRefundAllowed: event.cancellationWithoutRefundAllowed,
      refundDeadline: toDateTimeLocalValue(event.refundDeadline),
      refundPercentage: String(event.refundPercentage ?? 100),
      cancellationFee: String(event.cancellationFee ?? 0),
      refundPolicyNote: event.refundPolicyNote ?? "",
      status: getFormStatusValue(event),
    });
    setIsModalOpen(true);
  };

  const openEditTemplateModal = (template: AdminEventTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      title: template.title,
      description: template.description,
      imageUrl: template.imageUrl ?? "",
      suggestedDurationMinutes:
        template.suggestedDurationMinutes != null ? String(template.suggestedDurationMinutes) : "",
      suggestedBookingWindowHours:
        template.suggestedBookingWindowHours != null
          ? String(template.suggestedBookingWindowHours)
          : "",
      suggestedSlotPrice:
        template.suggestedSlotPrice != null ? String(template.suggestedSlotPrice) : "",
      suggestedMaxSlots: template.suggestedMaxSlots != null ? String(template.suggestedMaxSlots) : "",
      suggestedMaxTicketsPerUser:
        template.suggestedMaxTicketsPerUser != null
          ? String(template.suggestedMaxTicketsPerUser)
          : "",
      suggestedOfferLabel: template.suggestedOfferLabel ?? "",
      setupChecklist: joinLines(template.setupChecklist),
      requiredItems: joinLines(template.requiredItems),
      status: getTemplateFormStatusValue(template),
    });
    setIsTemplateModalOpen(true);
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

    if (!form.eventDate || !form.eventStartTime || !form.eventEndTime) {
      toast.error("Add the event date, start time, and end time.");
      return;
    }

    setIsSubmitting(true);
    try {
      const refundPolicyPayload = buildEventRefundPolicyPayload(
        {
          cancellationAllowed: form.cancellationAllowed,
          refundAllowed: form.refundAllowed,
          cancellationWithoutRefundAllowed: form.cancellationWithoutRefundAllowed,
          refundDeadline: form.refundDeadline,
          refundPercentage: form.refundPercentage,
          cancellationFee: form.cancellationFee,
          refundPolicyNote: form.refundPolicyNote,
        },
        combineDateAndTime(form.eventDate, form.eventStartTime),
      );
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim() || null,
        startsAt: combineDateAndTime(form.eventDate, form.eventStartTime),
        endsAt: combineDateAndTime(form.eventDate, form.eventEndTime),
        bookingStartTime: form.bookingStartTime ? new Date(form.bookingStartTime).toISOString() : null,
        bookingEndTime: form.bookingEndTime ? new Date(form.bookingEndTime).toISOString() : null,
        discountLabel: form.discountLabel.trim() || null,
        totalSlots: form.totalSlots.trim() ? Number(form.totalSlots) : null,
        slotPrice: form.slotPrice.trim() ? Number(form.slotPrice) : null,
        maxTicketsPerUser: form.maxTicketsPerUser.trim() ? Number(form.maxTicketsPerUser) : null,
        ...refundPolicyPayload,
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

  const openAttendeesModal = async (event: AdminEvent) => {
    setSelectedAttendeeEvent(event);
    setAttendeeReport(null);
    setIsLoadingAttendeeReport(true);

    try {
      setAttendeeReport(await getEventAttendees(event.id));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load event bookings right now."));
    } finally {
      setIsLoadingAttendeeReport(false);
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

  const handleTemplateSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    setIsTemplateSubmitting(true);
    try {
      const payload = {
        title: templateForm.title.trim(),
        description: templateForm.description.trim(),
        imageUrl: templateForm.imageUrl.trim() || null,
        suggestedDurationMinutes: templateForm.suggestedDurationMinutes.trim()
          ? Number(templateForm.suggestedDurationMinutes)
          : null,
        suggestedBookingWindowHours: templateForm.suggestedBookingWindowHours.trim()
          ? Number(templateForm.suggestedBookingWindowHours)
          : null,
        suggestedSlotPrice: templateForm.suggestedSlotPrice.trim()
          ? Number(templateForm.suggestedSlotPrice)
          : null,
        suggestedMaxSlots: templateForm.suggestedMaxSlots.trim()
          ? Number(templateForm.suggestedMaxSlots)
          : null,
        suggestedMaxTicketsPerUser: templateForm.suggestedMaxTicketsPerUser.trim()
          ? Number(templateForm.suggestedMaxTicketsPerUser)
          : null,
        suggestedOfferLabel: templateForm.suggestedOfferLabel.trim() || null,
        setupChecklist: splitLines(templateForm.setupChecklist),
        requiredItems: splitLines(templateForm.requiredItems),
        status: templateForm.status,
      };

      if (editingTemplate) {
        await updateEventTemplate(editingTemplate.id, payload);
        toast.success("Event template updated successfully.");
      } else {
        await createEventTemplate(payload);
        toast.success("Event template created successfully.");
      }

      setIsTemplateModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save this event template."));
    } finally {
      setIsTemplateSubmitting(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateTarget) {
      return;
    }

    setIsTemplateDeleting(true);
    try {
      await deleteEventTemplate(deleteTemplateTarget.id);
      toast.success("Event template deleted successfully.");
      setDeleteTemplateTarget(null);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to delete this event template."));
    } finally {
      setIsTemplateDeleting(false);
    }
  };

  const handleToggleStatus = async (event: AdminEvent) => {
    const nextStatus = event.manualStatus === "CANCELLED" ? "ACTIVE" : "CANCELLED";

    setTogglingEventId(event.id);
    try {
      await updateEvent(event.id, { status: nextStatus });
      toast.success(`Event ${nextStatus === "ACTIVE" ? "reopened" : "cancelled"} successfully.`);
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update this event status."));
    } finally {
      setTogglingEventId(null);
    }
  };

  const handleMarkAttended = async (eventId: number, bookingId: number) => {
    setAttendingBookingId(bookingId);
    try {
      await markEventBookingAttended(eventId, bookingId);
      toast.success("Booking marked as attended.");
      await Promise.all([
        loadData(),
        selectedAttendeeEvent?.id === eventId ? openAttendeesModal(selectedAttendeeEvent) : Promise.resolve(),
      ]);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to mark this booking as attended."));
    } finally {
      setAttendingBookingId(null);
    }
  };

  const handleRefundAction = async (
    eventId: number,
    bookingId: number,
    action: "APPROVE" | "REJECT" | "PROCESS" | "FAIL",
  ) => {
    setRefundUpdatingBookingId(bookingId);
    try {
      await updateEventBookingRefund(eventId, bookingId, {
        action,
        refundReason: refundNotes[bookingId]?.trim() || undefined,
      });
      toast.success(
        action === "APPROVE"
          ? "Refund approved successfully."
          : action === "REJECT"
            ? "Refund rejected successfully."
            : action === "FAIL"
              ? "Refund marked as failed successfully."
              : "Refund marked as refunded successfully.",
      );
      await Promise.all([
        loadData(),
        selectedAttendeeEvent?.id === eventId ? openAttendeesModal(selectedAttendeeEvent) : Promise.resolve(),
      ]);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update this refund right now."));
    } finally {
      setRefundUpdatingBookingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Restaurant events"
        title="Slot-based event campaigns and premium experiences."
        description="Create events with seat limits, booking windows, pricing, and check-in visibility without disturbing the rest of the admin dashboard."
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
                label: "Event time",
                render: (event) => (
                  <div>
                    <p className="text-sm text-ink-soft">{formatDateTime(event.startsAt)}</p>
                    <p className="text-xs text-ink-muted">Ends {formatDateTime(event.endsAt)}</p>
                  </div>
                ),
              },
              {
                key: "capacity",
                label: "Slots and revenue",
                render: (event) => (
                  <div className="space-y-2">
                    <p className="font-semibold text-ink">
                      {event.bookedSlots} booked
                      {event.totalSlots != null ? ` / ${event.totalSlots}` : ""}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {event.remainingSlots != null ? `${event.remainingSlots} left` : "Unlimited seats"}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {event.slotPrice > 0 ? `Revenue ${formatCurrency(event.revenue)}` : "Free event"}
                    </p>
                  </div>
                ),
              },
              {
                key: "status",
                label: "State",
                render: (event) => (
                  <div className="space-y-2">
                    <StatusPill label={toLabel(event.status)} tone={getToneForStatus(event.status)} />
                    <StatusPill
                      label={toLabel(event.availabilityStatus)}
                      tone={event.isSoldOut || event.isEventEnded ? "warning" : "info"}
                    />
                  </div>
                ),
              },
              {
                key: "actions",
                label: "Actions",
                render: (event) => (
                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-3 py-2 text-xs"
                      onClick={() => void openAttendeesModal(event)}
                    >
                      View bookings
                    </Button>
                    {event.status !== "ENDED" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-3 py-2 text-xs"
                        onClick={() => void handleToggleStatus(event)}
                        disabled={togglingEventId === event.id}
                      >
                        {togglingEventId === event.id
                          ? "Saving..."
                          : event.manualStatus === "CANCELLED"
                            ? "Reopen"
                            : "Cancel event"}
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

      <div className="space-y-4">
        <SectionHeading
          eyebrow="Event templates"
          title="Reusable event formats for restaurant owners."
          description="Create reusable starter templates for live music nights, buffet weekends, sports screenings, and other event formats owners can quickly adapt for their own restaurants."
          action={<AddButton label="Add template" onClick={openCreateTemplateModal} />}
        />

        {templates.length ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {templates.map((template) => (
              <SurfaceCard key={template.id} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{template.title}</p>
                    <p className="mt-2 text-sm leading-7 text-ink-soft">{template.description}</p>
                  </div>
                  <StatusPill
                    label={toLabel(template.status)}
                    tone={template.status === "ACTIVE" ? "success" : "warning"}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.25rem] bg-cream px-4 py-4 text-sm text-ink-soft">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Suggested pricing</p>
                    <p className="mt-2 font-semibold text-ink">
                      {template.suggestedSlotPrice != null
                        ? formatCurrency(template.suggestedSlotPrice)
                        : "Flexible"}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {template.suggestedMaxSlots != null
                        ? `${template.suggestedMaxSlots} max slots`
                        : "Unlimited slots supported"}
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] bg-cream px-4 py-4 text-sm text-ink-soft">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Suggested timing</p>
                    <p className="mt-2 font-semibold text-ink">
                      {template.suggestedDurationMinutes != null
                        ? `${template.suggestedDurationMinutes} min duration`
                        : "Owner chooses duration"}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {template.suggestedBookingWindowHours != null
                        ? `${template.suggestedBookingWindowHours} hr booking window`
                        : "Owner chooses booking window"}
                    </p>
                  </div>
                </div>
                {template.suggestedOfferLabel ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                    {template.suggestedOfferLabel}
                  </p>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Setup checklist</p>
                    <div className="mt-3 space-y-2 text-sm text-ink-soft">
                      {template.setupChecklist.length ? (
                        template.setupChecklist.map((item, index) => <p key={`${template.id}-check-${index}`}>- {item}</p>)
                      ) : (
                        <p>No checklist added yet.</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Required items</p>
                    <div className="mt-3 space-y-2 text-sm text-ink-soft">
                      {template.requiredItems.length ? (
                        template.requiredItems.map((item, index) => <p key={`${template.id}-item-${index}`}>- {item}</p>)
                      ) : (
                        <p>No required items added yet.</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-3 border-t border-accent/10 pt-4">
                  <Button type="button" variant="secondary" onClick={() => openEditTemplateModal(template)}>
                    Edit template
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setDeleteTemplateTarget(template)}>
                    Delete template
                  </Button>
                </div>
              </SurfaceCard>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No event templates yet"
            description="Create reusable event templates so restaurant owners can launch faster without rebuilding the same event setup every time."
          />
        )}
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEvent ? "Edit event" : "Add event"}
        className="max-w-5xl"
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
              label="Event date"
              type="date"
              value={form.eventDate}
              onChange={(event) => setForm({ ...form, eventDate: event.target.value })}
              required
            />
            <Input
              label="Event start time"
              type="time"
              value={form.eventStartTime}
              onChange={(event) => setForm({ ...form, eventStartTime: event.target.value })}
              required
            />
            <Input
              label="Event end time"
              type="time"
              value={form.eventEndTime}
              onChange={(event) => setForm({ ...form, eventEndTime: event.target.value })}
              required
            />
            <Input
              label="Booking start"
              type="datetime-local"
              value={form.bookingStartTime}
              onChange={(event) => setForm({ ...form, bookingStartTime: event.target.value })}
            />
            <Input
              label="Booking end"
              type="datetime-local"
              value={form.bookingEndTime}
              onChange={(event) => setForm({ ...form, bookingEndTime: event.target.value })}
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
                    {region.name} | {region.stateName}
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
            <Input
              label="Total slots"
              type="number"
              min="1"
              value={form.totalSlots}
              onChange={(event) => setForm({ ...form, totalSlots: event.target.value })}
              placeholder="Optional"
            />
            <Input
              label="Slot price"
              type="number"
              min="0"
              step="0.01"
              value={form.slotPrice}
              onChange={(event) => setForm({ ...form, slotPrice: event.target.value })}
              placeholder="0 for free events"
            />
            <Input
              label="Max tickets per user"
              type="number"
              min="1"
              value={form.maxTicketsPerUser}
              onChange={(event) => setForm({ ...form, maxTicketsPerUser: event.target.value })}
              placeholder="Optional"
            />
            <EventRefundPolicySection
              cancellationAllowed={form.cancellationAllowed}
              refundAllowed={form.refundAllowed}
              cancellationWithoutRefundAllowed={form.cancellationWithoutRefundAllowed}
              refundDeadline={form.refundDeadline}
              refundPercentage={form.refundPercentage}
              cancellationFee={form.cancellationFee}
              refundPolicyNote={form.refundPolicyNote}
              onCancellationAllowedChange={(value) => setForm({ ...form, cancellationAllowed: value })}
              onRefundAllowedChange={(value) => setForm({ ...form, refundAllowed: value })}
              onCancellationWithoutRefundAllowedChange={(value) =>
                setForm({ ...form, cancellationWithoutRefundAllowed: value })
              }
              onRefundDeadlineChange={(value) => setForm({ ...form, refundDeadline: value })}
              onRefundPercentageChange={(value) => setForm({ ...form, refundPercentage: value })}
              onCancellationFeeChange={(value) => setForm({ ...form, cancellationFee: value })}
              onRefundPolicyNoteChange={(value) => setForm({ ...form, refundPolicyNote: value })}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value as EventStatusValue })}
            >
              {EVENT_FORM_STATUS_OPTIONS.map((status) => (
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

      <Modal
        open={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title={editingTemplate ? "Edit event template" : "Add event template"}
        className="max-w-5xl"
      >
        <form className="space-y-4" onSubmit={handleTemplateSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Template title"
              value={templateForm.title}
              onChange={(event) => setTemplateForm({ ...templateForm, title: event.target.value })}
              required
            />
            <Select
              label="Status"
              value={templateForm.status}
              onChange={(event) =>
                setTemplateForm({
                  ...templateForm,
                  status: event.target.value as EventTemplateStatusValue,
                })
              }
            >
              {TEMPLATE_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {toLabel(status)}
                </option>
              ))}
            </Select>
            <Input
              label="Default image URL"
              value={templateForm.imageUrl}
              onChange={(event) => setTemplateForm({ ...templateForm, imageUrl: event.target.value })}
              placeholder="https://"
            />
            <Input
              label="Suggested duration (minutes)"
              type="number"
              min="1"
              value={templateForm.suggestedDurationMinutes}
              onChange={(event) =>
                setTemplateForm({ ...templateForm, suggestedDurationMinutes: event.target.value })
              }
              placeholder="180"
            />
            <Input
              label="Suggested booking window (hours)"
              type="number"
              min="1"
              value={templateForm.suggestedBookingWindowHours}
              onChange={(event) =>
                setTemplateForm({
                  ...templateForm,
                  suggestedBookingWindowHours: event.target.value,
                })
              }
              placeholder="24"
            />
            <Input
              label="Suggested slot price"
              type="number"
              min="0"
              step="0.01"
              value={templateForm.suggestedSlotPrice}
              onChange={(event) => setTemplateForm({ ...templateForm, suggestedSlotPrice: event.target.value })}
              placeholder="0 for free events"
            />
            <Input
              label="Suggested max slots"
              type="number"
              min="1"
              value={templateForm.suggestedMaxSlots}
              onChange={(event) => setTemplateForm({ ...templateForm, suggestedMaxSlots: event.target.value })}
              placeholder="Optional"
            />
            <Input
              label="Suggested max tickets per user"
              type="number"
              min="1"
              value={templateForm.suggestedMaxTicketsPerUser}
              onChange={(event) =>
                setTemplateForm({
                  ...templateForm,
                  suggestedMaxTicketsPerUser: event.target.value,
                })
              }
              placeholder="Optional"
            />
            <Input
              label="Suggested offer label"
              value={templateForm.suggestedOfferLabel}
              onChange={(event) =>
                setTemplateForm({ ...templateForm, suggestedOfferLabel: event.target.value })
              }
              placeholder="Weekend buffet offer"
            />
          </div>
          <Textarea
            label="Description"
            value={templateForm.description}
            onChange={(event) => setTemplateForm({ ...templateForm, description: event.target.value })}
            required
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Textarea
              label="Setup checklist"
              value={templateForm.setupChecklist}
              onChange={(event) => setTemplateForm({ ...templateForm, setupChecklist: event.target.value })}
              placeholder={"Stage setup\nArtist sound check\nMenu briefing"}
            />
            <Textarea
              label="Required items"
              value={templateForm.requiredItems}
              onChange={(event) => setTemplateForm({ ...templateForm, requiredItems: event.target.value })}
              placeholder={"Speakers\nProjector\nBuffet warmers"}
            />
          </div>
          <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4 text-sm leading-7 text-ink-soft">
            Templates stay hidden from customers and only help restaurant owners launch restaurant-specific events faster with prefilled details.
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsTemplateModalOpen(false)}
              disabled={isTemplateSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isTemplateSubmitting}>
              {isTemplateSubmitting
                ? "Saving..."
                : editingTemplate
                  ? "Save template"
                  : "Create template"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedAttendeeEvent)}
        onClose={() => {
          if (!isLoadingAttendeeReport && !attendingBookingId) {
            setSelectedAttendeeEvent(null);
            setAttendeeReport(null);
          }
        }}
        title={selectedAttendeeEvent ? `${selectedAttendeeEvent.title} bookings` : "Event bookings"}
        className="max-w-6xl"
      >
        {isLoadingAttendeeReport ? (
          <div className="rounded-[1.5rem] bg-cream px-5 py-5 text-sm leading-7 text-ink-soft">
            Loading event booking analytics.
          </div>
        ) : attendeeReport ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-8">
              <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Total bookings</p>
                <p className="mt-2 text-sm font-semibold text-ink">{attendeeReport.summary.bookingsCount}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Pending</p>
                <p className="mt-2 text-sm font-semibold text-ink">{attendeeReport.summary.pendingCount ?? 0}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Confirmed</p>
                <p className="mt-2 text-sm font-semibold text-ink">{attendeeReport.summary.confirmedCount}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Completed</p>
                <p className="mt-2 text-sm font-semibold text-ink">{attendeeReport.summary.completedCount ?? 0}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Attended</p>
                <p className="mt-2 text-sm font-semibold text-ink">{attendeeReport.summary.attendedCount}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Cancelled</p>
                <p className="mt-2 text-sm font-semibold text-ink">{attendeeReport.summary.cancelledCount}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Refunded</p>
                <p className="mt-2 text-sm font-semibold text-ink">{attendeeReport.summary.refundedCount}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Failed</p>
                <p className="mt-2 text-sm font-semibold text-ink">{attendeeReport.summary.failedCount ?? 0}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Capacity</p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {attendeeReport.summary.totalSlots != null
                    ? `${attendeeReport.summary.bookedSlots} / ${attendeeReport.summary.totalSlots}`
                    : `${attendeeReport.summary.bookedSlots} booked`}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Revenue</p>
                <p className="mt-2 text-sm font-semibold text-ink">{formatCurrency(attendeeReport.summary.revenue)}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Tax</p>
                <p className="mt-2 text-sm font-semibold text-ink">{formatCurrency(attendeeReport.summary.totalTax ?? 0)}</p>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Refunded amount</p>
                <p className="mt-2 text-sm font-semibold text-ink">{formatCurrency(attendeeReport.summary.refundedAmount ?? 0)}</p>
              </div>
            </div>

            {attendeeReport.restaurantBreakdown.length ? (
              <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-5 py-5">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Restaurant breakdown</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {attendeeReport.restaurantBreakdown.map((item) => (
                    <div key={item.restaurant.id} className="rounded-[1.25rem] bg-white px-4 py-4">
                      <p className="font-semibold text-ink">{item.restaurant.name}</p>
                      <p className="mt-2 text-sm text-ink-soft">
                        {item.bookedSlots} slot(s) across {item.bookingsCount} booking(s)
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">{formatCurrency(item.revenue)} revenue</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {attendeeReport.bookings.length ? (
              <AdminDataTable
                rows={attendeeReport.bookings}
                getRowKey={(booking) => booking.id}
                emptyTitle="No bookings yet"
                emptyDescription="Bookings will appear here after customers reserve slots."
                columns={[
                  {
                    key: "guest",
                    label: "Guest",
                    render: (booking) => (
                      <div>
                        <p className="font-semibold text-ink">{booking.user.fullName}</p>
                        <p className="text-xs text-ink-muted">{booking.user.email}</p>
                      </div>
                    ),
                  },
                  {
                    key: "restaurant",
                    label: "Restaurant",
                    render: (booking) => booking.restaurant.name,
                  },
                  {
                    key: "slots",
                    label: "Slots",
                    render: (booking) => booking.quantity,
                  },
                  {
                    key: "bookingCode",
                    label: "Booking code",
                    render: (booking) => booking.bookingCode,
                  },
                  {
                    key: "bookedAt",
                    label: "Booked",
                    render: (booking) => formatDateTime(booking.bookedAt),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (booking) => (
                      <div className="space-y-2">
                        <StatusPill label={toLabel(booking.status)} tone={getToneForStatus(booking.status)} />
                        <StatusPill
                          label={toLabel(booking.paymentStatus)}
                          tone={
                            booking.paymentStatus === "PAID" ||
                            booking.paymentStatus === "REFUNDED" ||
                            booking.paymentStatus === "PARTIALLY_REFUNDED"
                              ? "success"
                              : booking.paymentStatus === "FAILED"
                                ? "warning"
                                : "neutral"
                          }
                        />
                        <StatusPill
                          label={toLabel(booking.refundStatus ?? "NOT_REQUESTED")}
                          tone={getToneForStatus(booking.refundStatus ?? "NOT_REQUESTED")}
                        />
                      </div>
                    ),
                  },
                  {
                    key: "amounts",
                    label: "Amounts",
                    render: (booking) => (
                      <div className="space-y-1 text-xs text-ink-muted">
                        <p>Slot price {formatCurrency(booking.slotPrice ?? 0)}</p>
                        <p>Subtotal {formatCurrency(booking.subtotalAmount ?? booking.totalAmount)}</p>
                        <p>Total {formatCurrency(booking.totalAmount)}</p>
                        <p>Tax {formatCurrency(booking.taxAmount ?? 0)}</p>
                        <p>Platform fee {formatCurrency(booking.platformFee ?? 0)}</p>
                        <p>Discount {formatCurrency(booking.discountAmount ?? 0)}</p>
                        <p>Refund eligible {booking.refundEligible ? "Yes" : "No"}</p>
                        <p>Refund amount {formatCurrency(booking.refundAmount ?? 0)}</p>
                        <p>Refund status {toLabel(booking.refundStatus ?? "NOT_REQUESTED")}</p>
                        <p>Refund reason {booking.refundReason?.trim() || "Not provided"}</p>
                      </div>
                    ),
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (booking) => (
                      <div className="space-y-3">
                        {booking.status === "CONFIRMED" || booking.status === "COMPLETED" ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-3 py-2 text-xs"
                            onClick={() => void handleMarkAttended(booking.eventId, booking.id)}
                            disabled={attendingBookingId === booking.id}
                          >
                            {attendingBookingId === booking.id ? "Saving..." : "Mark attended"}
                          </Button>
                        ) : null}
                        {canApproveRefund(booking) ||
                        canRejectRefund(booking) ||
                        canMarkRefunded(booking) ||
                        canMarkRefundFailed(booking) ? (
                          <div className="space-y-2">
                            <Textarea
                              label="Refund note / reason"
                              value={refundNotes[booking.id] ?? booking.refundReason ?? ""}
                              onChange={(event) =>
                                setRefundNotes((current) => ({
                                  ...current,
                                  [booking.id]: event.target.value,
                                }))
                              }
                              placeholder="Add the approval, rejection, or refund note."
                            />
                            <div className="flex flex-wrap gap-2">
                              {canApproveRefund(booking) ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="px-3 py-2 text-xs"
                                  onClick={() => void handleRefundAction(booking.eventId, booking.id, "APPROVE")}
                                  disabled={refundUpdatingBookingId === booking.id}
                                >
                                  Approve refund
                                </Button>
                              ) : null}
                              {canRejectRefund(booking) ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="px-3 py-2 text-xs"
                                  onClick={() => void handleRefundAction(booking.eventId, booking.id, "REJECT")}
                                  disabled={refundUpdatingBookingId === booking.id}
                                >
                                  Reject refund
                                </Button>
                              ) : null}
                              {canMarkRefunded(booking) ? (
                                <Button
                                  type="button"
                                  className="px-3 py-2 text-xs"
                                  onClick={() => void handleRefundAction(booking.eventId, booking.id, "PROCESS")}
                                  disabled={refundUpdatingBookingId === booking.id}
                                >
                                  {refundUpdatingBookingId === booking.id ? "Saving..." : "Mark refunded"}
                                </Button>
                              ) : null}
                              {canMarkRefundFailed(booking) ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="px-3 py-2 text-xs"
                                  onClick={() => void handleRefundAction(booking.eventId, booking.id, "FAIL")}
                                  disabled={refundUpdatingBookingId === booking.id}
                                >
                                  Mark refund failed
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        {booking.status !== "CONFIRMED" &&
                        booking.status !== "COMPLETED" &&
                        booking.status !== "CANCELLED" ? (
                          <span className="text-xs text-ink-muted">No actions</span>
                        ) : null}
                      </div>
                    ),
                  },
                ]}
              />
            ) : (
              <EmptyState
                title="No bookings yet"
                description="Customers who reserve this event will appear here automatically."
              />
            )}
          </div>
        ) : (
          <EmptyState
            title="Unable to load bookings"
            description="Try reopening this event analytics panel in a moment."
          />
        )}
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

      <ConfirmDangerModal
        open={Boolean(deleteTemplateTarget)}
        title="Delete event template"
        description="This removes the reusable template but will not affect restaurant events that were already created from it."
        confirmLabel="Delete template"
        isSubmitting={isTemplateDeleting}
        onClose={() => setDeleteTemplateTarget(null)}
        onConfirm={() => void handleDeleteTemplate()}
      />
    </div>
  );
};
