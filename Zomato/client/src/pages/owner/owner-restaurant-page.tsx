import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminLoadingState } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IndianPhoneInput } from "@/components/ui/indian-phone-input";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SectionHeading, StatusPill, SurfaceCard } from "@/components/ui/page-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getLookups } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/auth";
import {
  createOwnerEventFromTemplate,
  getOwnerEventTemplates,
  getOwnerEventInsights,
  getOwnerRestaurants,
  markOwnerEventBookingAttended,
  updateOwnerEventBookingRefund,
  updateOwnerEventStatus,
  updateOwnerRestaurant,
  type OwnerEventInsight,
  type OwnerEventTemplate,
  type OwnerRestaurant,
} from "@/lib/owner";
import {
  ChipSelector,
  RefreshButton,
  ToggleField,
  formatCurrency,
  formatDateTime,
  getToneForStatus,
  toLabel,
} from "@/pages/admin/admin-shared";

const emptyForm = {
  name: "",
  description: "",
  email: "",
  phone: "",
  coverImage: "",
  logoImage: "",
  openingTime: "",
  closingTime: "",
  addressLine: "",
  area: "",
  city: "",
  state: "",
  pincode: "",
  preparationTime: "20",
  latitude: "",
  longitude: "",
  isVegOnly: false,
  isActive: true,
  categoryIds: [] as number[],
  cuisineIds: [] as number[],
};

type OwnerEventStatusValue = "ACTIVE" | "CANCELLED";

type OwnerEventFormState = {
  restaurantId: string;
  title: string;
  description: string;
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
  refundAllowed: boolean;
  refundDeadline: string;
  refundPercentage: string;
  cancellationFee: string;
  status: OwnerEventStatusValue;
};

const OWNER_EVENT_STATUS_OPTIONS: OwnerEventStatusValue[] = ["ACTIVE", "CANCELLED"];

const emptyEventForm: OwnerEventFormState = {
  restaurantId: "",
  title: "",
  description: "",
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
  refundAllowed: true,
  refundDeadline: "",
  refundPercentage: "100",
  cancellationFee: "0",
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

const combineDateAndTime = (dateValue: string, timeValue: string) =>
  new Date(`${dateValue}T${timeValue}:00`).toISOString();

const formatSuggestedValue = (value?: number | null, suffix = "") =>
  value != null ? `${value}${suffix}` : "Flexible";

export const OwnerRestaurantPage = () => {
  const [restaurants, setRestaurants] = useState<OwnerRestaurant[]>([]);
  const [eventInsights, setEventInsights] = useState<OwnerEventInsight[]>([]);
  const [eventTemplates, setEventTemplates] = useState<OwnerEventTemplate[]>([]);
  const [restaurantCategories, setRestaurantCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [cuisines, setCuisines] = useState<Array<{ id: number; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRestaurant, setEditingRestaurant] = useState<OwnerRestaurant | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [attendingBookingId, setAttendingBookingId] = useState<number | null>(null);
  const [refundUpdatingBookingId, setRefundUpdatingBookingId] = useState<number | null>(null);
  const [eventStatusUpdatingId, setEventStatusUpdatingId] = useState<number | null>(null);
  const [refundNotes, setRefundNotes] = useState<Record<number, string>>({});
  const [form, setForm] = useState(emptyForm);
  const [selectedTemplate, setSelectedTemplate] = useState<OwnerEventTemplate | null>(null);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [eventForm, setEventForm] = useState<OwnerEventFormState>(emptyEventForm);
  const eventsSectionRef = useRef<HTMLDivElement | null>(null);
  const templatesSectionRef = useRef<HTMLDivElement | null>(null);

  const loadRestaurants = async () => {
    setIsLoading(true);
    try {
      const [restaurantRows, lookups, ownerEventRows, templateRows] = await Promise.all([
        getOwnerRestaurants(),
        getLookups(),
        getOwnerEventInsights().catch(() => [] as OwnerEventInsight[]),
        getOwnerEventTemplates().catch(() => [] as OwnerEventTemplate[]),
      ]);
      setRestaurants(restaurantRows);
      setRestaurantCategories(lookups.restaurantCategories);
      setCuisines(lookups.cuisines);
      setEventInsights(ownerEventRows);
      setEventTemplates(templateRows);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load your restaurants."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRestaurants();
  }, []);

  const handleMarkBookingAttended = async (bookingId: number) => {
    setAttendingBookingId(bookingId);
    try {
      await markOwnerEventBookingAttended(bookingId);
      toast.success("Booking marked as attended.");
      await loadRestaurants();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to mark this booking as attended."));
    } finally {
      setAttendingBookingId(null);
    }
  };

  const handleRefundAction = async (
    bookingId: number,
    action: "APPROVE" | "REJECT" | "PROCESS",
  ) => {
    setRefundUpdatingBookingId(bookingId);
    try {
      await updateOwnerEventBookingRefund(bookingId, {
        action,
        refundReason: refundNotes[bookingId]?.trim() || undefined,
      });
      toast.success(
        action === "APPROVE"
          ? "Refund approved successfully."
          : action === "REJECT"
            ? "Refund rejected successfully."
            : "Refund processed successfully.",
      );
      await loadRestaurants();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update this refund right now."));
    } finally {
      setRefundUpdatingBookingId(null);
    }
  };

  const handleEventStatusChange = async (eventId: number, status: "ACTIVE" | "CANCELLED") => {
    setEventStatusUpdatingId(eventId);
    try {
      await updateOwnerEventStatus(eventId, { status });
      toast.success(status === "CANCELLED" ? "Event cancelled successfully." : "Event reopened successfully.");
      await loadRestaurants();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update this event right now."));
    } finally {
      setEventStatusUpdatingId(null);
    }
  };

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openBlankEventModal = () => {
    setSelectedTemplate(null);
    setEventForm({
      ...emptyEventForm,
      restaurantId: restaurants[0]?.id ? String(restaurants[0].id) : "",
    });
    setIsEventModalOpen(true);
  };

  const applyTemplateToEventForm = (template: OwnerEventTemplate) => {
    const startDateTime =
      eventForm.eventDate && eventForm.eventStartTime
        ? new Date(combineDateAndTime(eventForm.eventDate, eventForm.eventStartTime))
        : null;
    const derivedEndTime =
      startDateTime && template.suggestedDurationMinutes != null
        ? new Date(startDateTime.getTime() + template.suggestedDurationMinutes * 60_000)
            .toISOString()
            .slice(11, 16)
        : "";
    const derivedBookingStart =
      startDateTime && template.suggestedBookingWindowHours != null
        ? toDateTimeLocalValue(
            new Date(startDateTime.getTime() - template.suggestedBookingWindowHours * 60 * 60 * 1000)
              .toISOString(),
          )
        : "";
    const derivedBookingEnd =
      startDateTime && template.suggestedBookingWindowHours != null
        ? toDateTimeLocalValue(startDateTime.toISOString())
        : "";

    setSelectedTemplate(template);
    setEventForm((current) => ({
      ...current,
      restaurantId: current.restaurantId || (restaurants[0]?.id ? String(restaurants[0].id) : ""),
      title: template.title,
      description: template.description,
      imageUrl: template.imageUrl ?? "",
      eventEndTime: current.eventEndTime || derivedEndTime,
      bookingStartTime: current.bookingStartTime || derivedBookingStart,
      bookingEndTime: current.bookingEndTime || derivedBookingEnd,
      discountLabel: template.suggestedOfferLabel ?? "",
      totalSlots: template.suggestedMaxSlots != null ? String(template.suggestedMaxSlots) : "",
      slotPrice: template.suggestedSlotPrice != null ? String(template.suggestedSlotPrice) : "",
      maxTicketsPerUser:
        template.suggestedMaxTicketsPerUser != null
          ? String(template.suggestedMaxTicketsPerUser)
          : "",
      refundAllowed: true,
      refundDeadline: current.refundDeadline || derivedBookingEnd || "",
      refundPercentage: current.refundPercentage || "100",
      cancellationFee: current.cancellationFee || "0",
      status: "ACTIVE",
    }));
    setIsTemplatePickerOpen(false);
    setIsEventModalOpen(true);
  };

  const handleCreateOwnerEvent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!eventForm.restaurantId) {
      toast.error("Choose one of your restaurants for this event.");
      return;
    }

    if (!eventForm.eventDate || !eventForm.eventStartTime) {
      toast.error("Add the event date and start time.");
      return;
    }

    if (!eventForm.eventEndTime && !selectedTemplate?.suggestedDurationMinutes) {
      toast.error("Add the event end time or use a template with a suggested duration.");
      return;
    }

    if (!selectedTemplate && (!eventForm.title.trim() || !eventForm.description.trim())) {
      toast.error("Add an event title and description.");
      return;
    }

    setIsCreatingEvent(true);
    try {
      await createOwnerEventFromTemplate({
        restaurantId: Number(eventForm.restaurantId),
        ...(selectedTemplate ? { templateId: selectedTemplate.id } : {}),
        title: eventForm.title.trim() || undefined,
        description: eventForm.description.trim() || undefined,
        imageUrl: eventForm.imageUrl.trim() || null,
        startsAt: combineDateAndTime(eventForm.eventDate, eventForm.eventStartTime),
        ...(eventForm.eventEndTime
          ? { endsAt: combineDateAndTime(eventForm.eventDate, eventForm.eventEndTime) }
          : {}),
        bookingStartTime: eventForm.bookingStartTime
          ? new Date(eventForm.bookingStartTime).toISOString()
          : null,
        bookingEndTime: eventForm.bookingEndTime
          ? new Date(eventForm.bookingEndTime).toISOString()
          : null,
        discountLabel: eventForm.discountLabel.trim() || null,
        totalSlots: eventForm.totalSlots.trim() ? Number(eventForm.totalSlots) : null,
        slotPrice: eventForm.slotPrice.trim() ? Number(eventForm.slotPrice) : null,
        maxTicketsPerUser: eventForm.maxTicketsPerUser.trim()
          ? Number(eventForm.maxTicketsPerUser)
          : null,
        refundAllowed: eventForm.refundAllowed,
        refundDeadline: eventForm.refundAllowed
          ? eventForm.refundDeadline
            ? new Date(eventForm.refundDeadline).toISOString()
            : combineDateAndTime(eventForm.eventDate, eventForm.eventStartTime)
          : null,
        refundPercentage: eventForm.refundAllowed
          ? eventForm.refundPercentage.trim()
            ? Number(eventForm.refundPercentage)
            : 100
          : 0,
        cancellationFee: eventForm.refundAllowed
          ? eventForm.cancellationFee.trim()
            ? Number(eventForm.cancellationFee)
            : 0
          : 0,
        status: eventForm.status,
      });
      toast.success(
        selectedTemplate
          ? "Restaurant event created from template successfully."
          : "Restaurant event created successfully.",
      );
      setIsEventModalOpen(false);
      setSelectedTemplate(null);
      setEventForm(emptyEventForm);
      await loadRestaurants();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to create this restaurant event."));
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const openEditModal = (restaurant: OwnerRestaurant) => {
    setEditingRestaurant(restaurant);
    setForm({
      name: restaurant.name,
      description: restaurant.description ?? "",
      email: restaurant.email ?? "",
      phone: restaurant.phone ?? "",
      coverImage: restaurant.coverImage ?? "",
      logoImage: restaurant.logoImage ?? "",
      openingTime: restaurant.openingTime ?? "",
      closingTime: restaurant.closingTime ?? "",
      addressLine: restaurant.addressLine ?? "",
      area: restaurant.area ?? "",
      city: restaurant.city,
      state: restaurant.state,
      pincode: restaurant.pincode,
      preparationTime: String(restaurant.preparationTime),
      latitude: restaurant.latitude != null ? String(restaurant.latitude) : "",
      longitude: restaurant.longitude != null ? String(restaurant.longitude) : "",
      isVegOnly: restaurant.isVegOnly,
      isActive: restaurant.isActive,
      categoryIds: restaurant.categoryMappings.map((item) => item.category.id),
      cuisineIds: restaurant.cuisineMappings.map((item) => item.cuisine.id),
    });
  };

  const handleCloseModal = () => {
    if (isSaving) {
      return;
    }

    setEditingRestaurant(null);
  };

  const toggleSelection = (key: "categoryIds" | "cuisineIds", id: number) => {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(id)
        ? current[key].filter((currentId) => currentId !== id)
        : [...current[key], id],
    }));
  };

  const handleSaveRestaurant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingRestaurant) {
      return;
    }

    setIsSaving(true);
    try {
      await updateOwnerRestaurant(editingRestaurant.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        coverImage: form.coverImage.trim() || undefined,
        logoImage: form.logoImage.trim() || undefined,
        openingTime: form.openingTime.trim() || undefined,
        closingTime: form.closingTime.trim() || undefined,
        addressLine: form.addressLine.trim() || undefined,
        area: form.area.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        preparationTime: Number(form.preparationTime || "20"),
        latitude: form.latitude.trim() ? Number(form.latitude) : undefined,
        longitude: form.longitude.trim() ? Number(form.longitude) : undefined,
        isVegOnly: form.isVegOnly,
        isActive: form.isActive,
        categoryIds: form.categoryIds,
        cuisineIds: form.cuisineIds,
      });
      toast.success("Restaurant profile updated successfully.");
      setEditingRestaurant(null);
      await loadRestaurants();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update restaurant settings."));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <AdminLoadingState rows={6} />;
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Restaurant profile"
        title="Your restaurant details in one place."
        description="Review restaurant info, cuisines, active hours, profile imagery, and guest signals without exposing any other partner data."
        action={
          <div className="flex flex-wrap gap-3">
            <RefreshButton onClick={() => void loadRestaurants()} />
            <Button type="button" variant="secondary" onClick={() => scrollToSection(eventsSectionRef)}>
              My Events
            </Button>
            <Button type="button" variant="secondary" onClick={openBlankEventModal}>
              Create Event
            </Button>
            <Button type="button" variant="secondary" onClick={() => setIsTemplatePickerOpen(true)}>
              Create from Template
            </Button>
            <Button type="button" variant="secondary" onClick={() => scrollToSection(templatesSectionRef)}>
              Event Templates
            </Button>
          </div>
        }
      />

      <div ref={templatesSectionRef} className="space-y-4">
        <SectionHeading
          eyebrow="Event templates"
          title="Reusable event formats from admin."
          description="Pick an active template, review the setup checklist, and turn it into a restaurant-specific event with your own schedule, pricing, slots, and imagery."
          action={
            <Button type="button" variant="secondary" onClick={() => setIsTemplatePickerOpen(true)}>
              Browse templates
            </Button>
          }
        />

        {eventTemplates.length ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {eventTemplates.map((template) => (
              <SurfaceCard key={template.id} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{template.title}</p>
                    <p className="mt-2 text-sm leading-7 text-ink-soft">{template.description}</p>
                  </div>
                  <StatusPill
                    label={template.status === "ACTIVE" ? "Active template" : "Inactive"}
                    tone={template.status === "ACTIVE" ? "success" : "warning"}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.25rem] bg-cream px-4 py-4 text-sm text-ink-soft">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Suggested price</p>
                    <p className="mt-2 font-semibold text-ink">
                      {template.suggestedSlotPrice != null
                        ? formatCurrency(template.suggestedSlotPrice)
                        : "Flexible"}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {template.suggestedMaxSlots != null
                        ? `${template.suggestedMaxSlots} suggested slots`
                        : "Unlimited slots supported"}
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] bg-cream px-4 py-4 text-sm text-ink-soft">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Suggested timing</p>
                    <p className="mt-2 font-semibold text-ink">
                      {formatSuggestedValue(template.suggestedDurationMinutes, " min")}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {template.suggestedBookingWindowHours != null
                        ? `${template.suggestedBookingWindowHours} hr booking window`
                        : "Owner chooses booking window"}
                    </p>
                  </div>
                </div>
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
                        <p>No required items listed.</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-accent/10 pt-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-accent">
                    {template.suggestedOfferLabel ?? "No default offer label"}
                  </p>
                  <Button type="button" variant="secondary" onClick={() => applyTemplateToEventForm(template)}>
                    Use Template
                  </Button>
                </div>
              </SurfaceCard>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No active event templates yet"
            description="Templates created by admin will appear here automatically for restaurant owners."
          />
        )}
      </div>

      {restaurants.length ? (
        <div ref={eventsSectionRef} className="space-y-6">
          {restaurants.map((restaurant) => {
            const restaurantEventInsights = eventInsights.filter(
              (eventInsight) => eventInsight.restaurant.id === restaurant.id,
            );

            return (
              <SurfaceCard key={restaurant.id} className="space-y-6 overflow-hidden">
                {restaurant.coverImage ? (
                  <img src={restaurant.coverImage} alt={restaurant.name} className="h-56 w-full rounded-[1.75rem] object-cover" />
                ) : null}
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-4xl font-semibold text-ink">{restaurant.name}</h2>
                    <StatusPill label={restaurant.isActive ? "Active" : "Inactive"} tone={getToneForStatus(restaurant.isActive)} />
                    {restaurant.isFeatured ? <StatusPill label="Featured" tone="info" /> : null}
                    {restaurant.isVegOnly ? <StatusPill label="Veg only" tone="success" /> : null}
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-soft">{restaurant.description ?? "Description not available yet."}</p>
                </div>
                <div className="space-y-3">
                  <Button type="button" variant="secondary" onClick={() => openEditModal(restaurant)}>
                    Update restaurant profile
                  </Button>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Rating</p>
                      <p className="mt-2 text-sm font-semibold text-ink">{restaurant.avgRating.toFixed(1)} from {restaurant.totalReviews} reviews</p>
                    </div>
                    <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Cost for two</p>
                      <p className="mt-2 text-sm font-semibold text-ink">{formatCurrency(restaurant.costForTwo)}</p>
                    </div>
                    <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Average ETA</p>
                      <p className="mt-2 text-sm font-semibold text-ink">{restaurant.avgDeliveryTime} minutes</p>
                    </div>
                    <div className="rounded-[1.5rem] bg-cream px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Menu sections</p>
                      <p className="mt-2 text-sm font-semibold text-ink">{restaurant.menuCategories.length} active sections</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
                <div className="space-y-5">
                  <div className="rounded-[1.75rem] bg-cream px-5 py-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Contact and address</p>
                    <div className="mt-4 space-y-3 text-sm leading-7 text-ink-soft">
                      <p><span className="font-semibold text-ink">Email:</span> {restaurant.email ?? "Unavailable"}</p>
                      <p><span className="font-semibold text-ink">Phone:</span> {restaurant.phone ?? "Unavailable"}</p>
                      <p>
                        <span className="font-semibold text-ink">Address:</span> {restaurant.addressLine ?? "Address not available"}, {restaurant.area ?? "Area not available"}, {restaurant.city}, {restaurant.state} {restaurant.pincode}
                      </p>
                      <p>
                        <span className="font-semibold text-ink">Hours:</span> {(restaurant.openingTime ?? "--:--")} to {(restaurant.closingTime ?? "--:--")}
                      </p>
                      <p>
                        <span className="font-semibold text-ink">Preparation time:</span> {restaurant.preparationTime} minutes
                      </p>
                      <p>
                        <span className="font-semibold text-ink">Coordinates:</span>{" "}
                        {restaurant.latitude != null && restaurant.longitude != null
                          ? `${restaurant.latitude.toFixed(4)}, ${restaurant.longitude.toFixed(4)}`
                          : "Auto-detected when available"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] bg-cream px-5 py-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Cuisines and categories</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {restaurant.categoryMappings.map((item) => (
                        <StatusPill key={`category-${item.category.id}`} label={item.category.name} tone="info" />
                      ))}
                      {restaurant.cuisineMappings.map((item) => (
                        <StatusPill key={`cuisine-${item.cuisine.id}`} label={item.cuisine.name} tone="neutral" />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] bg-cream px-5 py-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Event bookings</p>
                    <div className="mt-4 space-y-4">
                      {restaurantEventInsights.length ? (
                        restaurantEventInsights.map((eventInsight) => (
                          <div
                            key={`${eventInsight.event.id}-${eventInsight.restaurant.id}`}
                            className="rounded-[1.25rem] border border-white/70 bg-white/80 px-4 py-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-ink">{eventInsight.event.title}</p>
                                <p className="mt-1 text-sm text-ink-soft">
                                  {formatDateTime(eventInsight.event.startsAt)} to {formatDateTime(eventInsight.event.endsAt)}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <StatusPill
                                  label={toLabel(eventInsight.event.status)}
                                  tone={getToneForStatus(eventInsight.event.status)}
                                />
                                <StatusPill
                                  label={`${eventInsight.restaurantBookedSlots} at this restaurant`}
                                  tone="info"
                                />
                                <StatusPill
                                  label={`${eventInsight.event.bookedSlots} total`}
                                  tone="neutral"
                                />
                                <StatusPill
                                  label={eventInsight.event.isSoldOut ? "Sold out" : toLabel(eventInsight.event.availabilityStatus)}
                                  tone={eventInsight.event.isSoldOut ? "warning" : "info"}
                                />
                              </div>
                            </div>
                            <p className="mt-3 text-sm leading-7 text-ink-soft">
                              {eventInsight.event.description}
                            </p>
                            <p className="mt-3 text-sm text-ink-soft">
                              {eventInsight.event.remainingSlots != null
                                ? `${eventInsight.event.remainingSlots} slots remaining across this event.`
                                : "This event is currently running without a fixed seat cap."}
                            </p>
                            <p className="mt-2 text-sm text-ink-soft">
                              {eventInsight.event.slotPrice > 0
                                ? `${formatCurrency(eventInsight.restaurantRevenue)} revenue from this restaurant`
                                : "Free event booking"}
                            </p>
                            <p className="mt-2 text-sm text-ink-soft">
                              {eventInsight.bookings.filter((booking) => booking.status === "CONFIRMED" || booking.status === "COMPLETED" || booking.status === "ATTENDED").length} confirmed attendee booking(s) |{" "}
                              {eventInsight.bookings.filter((booking) => booking.status === "CANCELLED").length} cancelled booking(s)
                            </p>
                            {eventInsight.event.status !== "ENDED" ? (
                              <div className="mt-3">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="px-3 py-2 text-xs"
                                  onClick={() =>
                                    void handleEventStatusChange(
                                      eventInsight.event.id,
                                      eventInsight.event.manualStatus === "CANCELLED" ? "ACTIVE" : "CANCELLED",
                                    )
                                  }
                                  disabled={eventStatusUpdatingId === eventInsight.event.id}
                                >
                                  {eventStatusUpdatingId === eventInsight.event.id
                                    ? "Saving..."
                                    : eventInsight.event.manualStatus === "CANCELLED"
                                      ? "Reopen event"
                                      : "Cancel event"}
                                </Button>
                              </div>
                            ) : null}
                            {eventInsight.bookings.length ? (
                              <div className="mt-4 space-y-3">
                                {eventInsight.bookings.map((booking) => (
                                  <div
                                    key={booking.id}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] bg-cream px-4 py-3"
                                  >
                                    <div>
                                      <p className="font-semibold text-ink">{booking.user.fullName}</p>
                                      <p className="text-xs text-ink-muted">{booking.user.email}</p>
                                      <p className="mt-1 text-xs text-ink-muted">
                                        {booking.quantity} slot(s) | Code {booking.bookingCode}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <div className="flex flex-wrap justify-end gap-2">
                                        <StatusPill label={booking.status} tone={getToneForStatus(booking.status)} />
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
                                      <p className="mt-2 text-xs text-ink-muted">{formatDateTime(booking.bookedAt)}</p>
                                      <p className="mt-2 text-xs text-ink-muted">
                                        Total {formatCurrency(booking.totalAmount)} | Tax {formatCurrency(booking.taxAmount ?? 0)} | Refund {formatCurrency(booking.refundAmount ?? 0)}
                                      </p>
                                      {booking.status === "CONFIRMED" || booking.status === "COMPLETED" ? (
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          className="mt-3 px-3 py-2 text-xs"
                                          onClick={() => void handleMarkBookingAttended(booking.id)}
                                          disabled={attendingBookingId === booking.id}
                                        >
                                          {attendingBookingId === booking.id ? "Saving..." : "Mark attended"}
                                        </Button>
                                      ) : null}
                                      {booking.status === "CANCELLED" &&
                                      booking.refundStatus !== "NOT_ELIGIBLE" &&
                                      booking.paymentStatus !== "FREE" ? (
                                        <div className="mt-3 space-y-2">
                                          <Textarea
                                            label="Refund note"
                                            value={refundNotes[booking.id] ?? booking.refundReason ?? ""}
                                            onChange={(event) =>
                                              setRefundNotes((current) => ({
                                                ...current,
                                                [booking.id]: event.target.value,
                                              }))
                                            }
                                            placeholder="Add refund note"
                                          />
                                          <div className="flex flex-wrap justify-end gap-2">
                                            <Button
                                              type="button"
                                              variant="secondary"
                                              className="px-3 py-2 text-xs"
                                              onClick={() => void handleRefundAction(booking.id, "APPROVE")}
                                              disabled={refundUpdatingBookingId === booking.id}
                                            >
                                              Approve refund
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="secondary"
                                              className="px-3 py-2 text-xs"
                                              onClick={() => void handleRefundAction(booking.id, "REJECT")}
                                              disabled={refundUpdatingBookingId === booking.id}
                                            >
                                              Reject refund
                                            </Button>
                                            <Button
                                              type="button"
                                              className="px-3 py-2 text-xs"
                                              onClick={() => void handleRefundAction(booking.id, "PROCESS")}
                                              disabled={refundUpdatingBookingId === booking.id}
                                            >
                                              {refundUpdatingBookingId === booking.id ? "Saving..." : "Mark processed"}
                                            </Button>
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-4 text-sm leading-7 text-ink-soft">
                                No customers have booked this event for this restaurant yet.
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm leading-7 text-ink-soft">
                          No active event booking data is available for this restaurant yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.75rem] bg-cream px-5 py-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Operating hours by day</p>
                    <div className="mt-4 space-y-3">
                      {restaurant.operatingHours.map((hour) => (
                        <div key={hour.id} className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-ink">Day {hour.dayOfWeek}</span>
                          <span className="text-ink-soft">
                            {hour.isClosed ? "Closed" : `${hour.openTime ?? "--:--"} to ${hour.closeTime ?? "--:--"}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] bg-cream px-5 py-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Recent guest reviews</p>
                    <div className="mt-4 space-y-3">
                      {restaurant.reviews.slice(0, 3).map((review) => (
                        <div key={review.id} className="rounded-[1.25rem] border border-white/70 bg-white/70 px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-ink">{review.user.fullName}</p>
                              <p className="text-xs text-ink-muted">{formatDateTime(review.createdAt)}</p>
                            </div>
                            <StatusPill label={`${review.rating} / 5`} tone="info" />
                          </div>
                          <p className="mt-3 text-sm leading-7 text-ink-soft">{review.reviewText ?? "No written feedback was shared."}</p>
                        </div>
                      ))}
                      {!restaurant.reviews.length ? (
                        <p className="text-sm leading-7 text-ink-soft">Guest reviews will appear here once customers start rating completed orders.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              </SurfaceCard>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No restaurants linked yet" description="This owner account does not have any restaurants assigned at the moment." />
      )}

      <Modal
        open={isTemplatePickerOpen}
        onClose={() => setIsTemplatePickerOpen(false)}
        title="Create from template"
        className="max-w-5xl"
      >
        <div className="space-y-5">
          <p className="text-sm leading-7 text-ink-soft">
            Choose one of the active admin templates to prefill your restaurant event form. You can still edit the schedule, pricing, slots, offer label, description, and image before saving.
          </p>
          {eventTemplates.length ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {eventTemplates.map((template) => (
                <SurfaceCard key={`picker-${template.id}`} className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{template.title}</p>
                      <p className="mt-2 text-sm leading-7 text-ink-soft">{template.description}</p>
                    </div>
                    <StatusPill label="Active" tone="success" />
                  </div>
                  <div className="text-sm text-ink-soft">
                    <p>
                      Suggested price:{" "}
                      <span className="font-semibold text-ink">
                        {template.suggestedSlotPrice != null
                          ? formatCurrency(template.suggestedSlotPrice)
                          : "Flexible"}
                      </span>
                    </p>
                    <p className="mt-1">
                      Suggested slots:{" "}
                      <span className="font-semibold text-ink">
                        {template.suggestedMaxSlots != null ? template.suggestedMaxSlots : "Unlimited"}
                      </span>
                    </p>
                  </div>
                  <div className="space-y-2 text-sm text-ink-soft">
                    {template.setupChecklist.slice(0, 3).map((item, index) => (
                      <p key={`picker-check-${template.id}-${index}`}>- {item}</p>
                    ))}
                    {!template.setupChecklist.length ? <p>No checklist added yet.</p> : null}
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="secondary" onClick={() => applyTemplateToEventForm(template)}>
                      Use Template
                    </Button>
                  </div>
                </SurfaceCard>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No templates available"
              description="Active admin templates will appear here once they are published."
            />
          )}
        </div>
      </Modal>

      <Modal
        open={isEventModalOpen}
        onClose={() => {
          if (!isCreatingEvent) {
            setIsEventModalOpen(false);
            setSelectedTemplate(null);
          }
        }}
        title={selectedTemplate ? `Create event from ${selectedTemplate.title}` : "Create event"}
        className="max-w-5xl"
      >
        <form className="space-y-5" onSubmit={handleCreateOwnerEvent}>
          {selectedTemplate ? (
            <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-5 py-5 text-sm leading-7 text-ink-soft">
              <p className="font-semibold text-ink">{selectedTemplate.title}</p>
              <p className="mt-2">{selectedTemplate.description}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-accent">
                Suggested duration {formatSuggestedValue(selectedTemplate.suggestedDurationMinutes, " min")} | Booking window{" "}
                {selectedTemplate.suggestedBookingWindowHours != null
                  ? `${selectedTemplate.suggestedBookingWindowHours} hr`
                  : "Flexible"}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Restaurant"
              value={eventForm.restaurantId}
              onChange={(event) => setEventForm({ ...eventForm, restaurantId: event.target.value })}
              required
            >
              <option value="">Select restaurant</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </Select>
            <Select
              label="Status"
              value={eventForm.status}
              onChange={(event) =>
                setEventForm({ ...eventForm, status: event.target.value as OwnerEventStatusValue })
              }
            >
              {OWNER_EVENT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {toLabel(status)}
                </option>
              ))}
            </Select>
            <Input
              label="Event title"
              value={eventForm.title}
              onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })}
              required={!selectedTemplate}
            />
            <Input
              label="Image URL"
              value={eventForm.imageUrl}
              onChange={(event) => setEventForm({ ...eventForm, imageUrl: event.target.value })}
              placeholder="https://"
            />
            <Input
              label="Event date"
              type="date"
              value={eventForm.eventDate}
              onChange={(event) => setEventForm({ ...eventForm, eventDate: event.target.value })}
              required
            />
            <Input
              label="Event start time"
              type="time"
              value={eventForm.eventStartTime}
              onChange={(event) => setEventForm({ ...eventForm, eventStartTime: event.target.value })}
              required
            />
            <Input
              label={
                selectedTemplate?.suggestedDurationMinutes != null
                  ? "Event end time (optional if using suggested duration)"
                  : "Event end time"
              }
              type="time"
              value={eventForm.eventEndTime}
              onChange={(event) => setEventForm({ ...eventForm, eventEndTime: event.target.value })}
              required={selectedTemplate?.suggestedDurationMinutes == null}
            />
            <Input
              label="Booking start"
              type="datetime-local"
              value={eventForm.bookingStartTime}
              onChange={(event) => setEventForm({ ...eventForm, bookingStartTime: event.target.value })}
            />
            <Input
              label="Booking end"
              type="datetime-local"
              value={eventForm.bookingEndTime}
              onChange={(event) => setEventForm({ ...eventForm, bookingEndTime: event.target.value })}
            />
            <Input
              label="Offer label"
              value={eventForm.discountLabel}
              onChange={(event) => setEventForm({ ...eventForm, discountLabel: event.target.value })}
              placeholder="Weekend buffet"
            />
            <Input
              label="Total slots"
              type="number"
              min="1"
              value={eventForm.totalSlots}
              onChange={(event) => setEventForm({ ...eventForm, totalSlots: event.target.value })}
              placeholder="Optional"
            />
            <Input
              label="Slot price"
              type="number"
              min="0"
              step="0.01"
              value={eventForm.slotPrice}
              onChange={(event) => setEventForm({ ...eventForm, slotPrice: event.target.value })}
              placeholder="0 for free events"
            />
            <Input
              label="Max tickets per user"
              type="number"
              min="1"
              value={eventForm.maxTicketsPerUser}
              onChange={(event) => setEventForm({ ...eventForm, maxTicketsPerUser: event.target.value })}
              placeholder="Optional"
            />
            <label className="flex items-center justify-between rounded-[1.5rem] border border-accent/10 bg-cream px-4 py-3 text-sm font-semibold text-ink">
              <span>Refund allowed</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[rgb(139,30,36)]"
                checked={eventForm.refundAllowed}
                onChange={(event) => setEventForm({ ...eventForm, refundAllowed: event.target.checked })}
              />
            </label>
            <Input
              label="Refund deadline"
              type="datetime-local"
              value={eventForm.refundDeadline}
              onChange={(event) => setEventForm({ ...eventForm, refundDeadline: event.target.value })}
              disabled={!eventForm.refundAllowed}
            />
            <Input
              label="Refund percentage"
              type="number"
              min="0"
              max="100"
              value={eventForm.refundPercentage}
              onChange={(event) => setEventForm({ ...eventForm, refundPercentage: event.target.value })}
              disabled={!eventForm.refundAllowed}
            />
            <Input
              label="Cancellation fee"
              type="number"
              min="0"
              step="0.01"
              value={eventForm.cancellationFee}
              onChange={(event) => setEventForm({ ...eventForm, cancellationFee: event.target.value })}
              disabled={!eventForm.refundAllowed}
            />
          </div>

          <Textarea
            label="Description"
            value={eventForm.description}
            onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })}
            required={!selectedTemplate}
          />

          {selectedTemplate ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] bg-cream px-5 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Setup checklist</p>
                <div className="mt-3 space-y-2 text-sm text-ink-soft">
                  {selectedTemplate.setupChecklist.length ? (
                    selectedTemplate.setupChecklist.map((item, index) => (
                      <p key={`modal-check-${selectedTemplate.id}-${index}`}>- {item}</p>
                    ))
                  ) : (
                    <p>No checklist added yet.</p>
                  )}
                </div>
              </div>
              <div className="rounded-[1.5rem] bg-cream px-5 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ink-muted">Required items</p>
                <div className="mt-3 space-y-2 text-sm text-ink-soft">
                  {selectedTemplate.requiredItems.length ? (
                    selectedTemplate.requiredItems.map((item, index) => (
                      <p key={`modal-item-${selectedTemplate.id}-${index}`}>- {item}</p>
                    ))
                  ) : (
                    <p>No required items listed.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsEventModalOpen(false);
                setSelectedTemplate(null);
              }}
              disabled={isCreatingEvent}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreatingEvent}>
              {isCreatingEvent ? "Saving..." : selectedTemplate ? "Create from template" : "Create event"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingRestaurant)}
        onClose={handleCloseModal}
        title={editingRestaurant ? `Update ${editingRestaurant.name}` : "Update restaurant"}
        className="max-w-5xl"
      >
        <form className="space-y-5" onSubmit={handleSaveRestaurant}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Restaurant name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <Input label="Contact email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <IndianPhoneInput label="Contact phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <Input label="Cover image URL" value={form.coverImage} onChange={(event) => setForm({ ...form, coverImage: event.target.value })} />
            <Input label="Logo image URL" value={form.logoImage} onChange={(event) => setForm({ ...form, logoImage: event.target.value })} />
            <Input label="Opening time" value={form.openingTime} onChange={(event) => setForm({ ...form, openingTime: event.target.value })} placeholder="09:00" />
            <Input label="Closing time" value={form.closingTime} onChange={(event) => setForm({ ...form, closingTime: event.target.value })} placeholder="23:00" />
            <Input label="Address line" value={form.addressLine} onChange={(event) => setForm({ ...form, addressLine: event.target.value })} />
            <Input label="Area" value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} />
            <Input label="City" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} required />
            <Input label="State" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} required />
            <Input label="Pincode" value={form.pincode} onChange={(event) => setForm({ ...form, pincode: event.target.value })} required />
            <Input label="Preparation time" type="number" min="5" value={form.preparationTime} onChange={(event) => setForm({ ...form, preparationTime: event.target.value })} required />
            <Input label="Latitude" type="number" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} placeholder="12.9716" />
            <Input label="Longitude" type="number" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} placeholder="77.5946" />
          </div>

          <Textarea label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />

          <div className="grid gap-4 md:grid-cols-2">
            <ToggleField label="Vegetarian only" checked={form.isVegOnly} onChange={(checked) => setForm({ ...form, isVegOnly: checked })} />
            <ToggleField label="Restaurant is active" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} />
          </div>

          <ChipSelector
            label="Restaurant categories"
            selectedIds={form.categoryIds}
            options={restaurantCategories}
            onToggle={(id) => toggleSelection("categoryIds", id)}
          />

          <ChipSelector
            label="Cuisine tags"
            selectedIds={form.cuisineIds}
            options={cuisines}
            onToggle={(id) => toggleSelection("cuisineIds", id)}
          />

          <div className="rounded-[1.5rem] border border-accent/10 bg-accent/[0.03] px-4 py-4 text-sm leading-7 text-ink-soft">
            Contact, address, cuisine tags, imagery, and preparation time stay scoped to your own restaurant. Default opening and closing times also refresh the owner-facing store schedule summary.
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save updates"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
