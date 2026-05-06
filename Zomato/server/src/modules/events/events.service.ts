import { Prisma } from "@prisma/client";
import {
  EventBookingStatus,
  EventStatus,
  PaymentMethod,
  PaymentStatus,
} from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { notificationsService } from "../notifications/notifications.service.js";

const ACTIVE_BOOKING_STATUSES = [
  EventBookingStatus.CONFIRMED,
  EventBookingStatus.ATTENDED,
] as const;
const OPEN_BOOKING_STATUSES = [EventBookingStatus.CONFIRMED] as const;
const EVENT_PAYMENT_METHODS = [PaymentMethod.CARD, PaymentMethod.UPI] as const;

const eventSelect = {
  id: true,
  title: true,
  description: true,
  restaurantId: true,
  regionId: true,
  imageUrl: true,
  startsAt: true,
  endsAt: true,
  bookingStartTime: true,
  bookingEndTime: true,
  discountLabel: true,
  totalSlots: true,
  bookedSlots: true,
  slotPrice: true,
  maxTicketsPerUser: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  restaurant: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  region: {
    select: {
      id: true,
      name: true,
      districtName: true,
      stateName: true,
      slug: true,
    },
  },
} satisfies Prisma.EventSelect;

const attendeeUserSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  profileImage: true,
} satisfies Prisma.UserSelect;

const bookingSelect = {
  id: true,
  userId: true,
  eventId: true,
  restaurantId: true,
  quantity: true,
  totalAmount: true,
  bookingCode: true,
  status: true,
  bookedAt: true,
  cancelledAt: true,
  paymentStatus: true,
  paymentMethod: true,
  paymentMethodId: true,
  createdAt: true,
  updatedAt: true,
  event: {
    select: eventSelect,
  },
  restaurant: {
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
    },
  },
  user: {
    select: attendeeUserSelect,
  },
} satisfies Prisma.EventBookingSelect;

type EventRecord = Prisma.EventGetPayload<{ select: typeof eventSelect }>;
type EventBookingRecord = Prisma.EventBookingGetPayload<{ select: typeof bookingSelect }>;
type RestaurantContext = NonNullable<EventRecord["restaurant"]>;

type CurrentUserBookingSummary = {
  id: number;
  eventId: number;
  restaurantId: number;
  quantity: number;
  totalAmount: number;
  bookingCode: string;
  status: string;
  bookedAt: Date;
  cancelledAt: Date | null;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentMethodId: number | null;
};

const getEffectiveEventStatus = (event: Pick<EventRecord, "status" | "endsAt">) => {
  if (event.status === EventStatus.INACTIVE) {
    return EventStatus.INACTIVE;
  }

  if (event.status === EventStatus.EXPIRED) {
    return EventStatus.EXPIRED;
  }

  return event.endsAt.getTime() < Date.now() ? EventStatus.EXPIRED : EventStatus.ACTIVE;
};

const getBookingWindow = (
  event: Pick<EventRecord, "bookingStartTime" | "bookingEndTime" | "createdAt" | "startsAt">,
) => ({
  bookingStartTime: event.bookingStartTime ?? event.createdAt,
  bookingEndTime: event.bookingEndTime ?? event.startsAt,
});

const getEventAvailability = (
  event: Pick<
    EventRecord,
    | "status"
    | "endsAt"
    | "createdAt"
    | "startsAt"
    | "bookingStartTime"
    | "bookingEndTime"
    | "totalSlots"
  >,
  bookedSlots: number,
) => {
  const effectiveStatus = getEffectiveEventStatus(event);
  const { bookingStartTime, bookingEndTime } = getBookingWindow(event);
  const totalSlots = event.totalSlots ?? null;
  const remainingSlots = totalSlots == null ? null : Math.max(totalSlots - bookedSlots, 0);
  const isSoldOut = totalSlots != null ? bookedSlots >= totalSlots : false;
  const now = Date.now();
  const isEventEnded = event.endsAt.getTime() < now;
  const isBookingClosed =
    effectiveStatus !== EventStatus.ACTIVE ||
    now < bookingStartTime.getTime() ||
    now > bookingEndTime.getTime();

  let availabilityStatus: "AVAILABLE" | "SOLD_OUT" | "BOOKING_CLOSED" | "EVENT_ENDED" | "INACTIVE";

  if (effectiveStatus === EventStatus.INACTIVE) {
    availabilityStatus = "INACTIVE";
  } else if (isEventEnded) {
    availabilityStatus = "EVENT_ENDED";
  } else if (isSoldOut) {
    availabilityStatus = "SOLD_OUT";
  } else if (isBookingClosed) {
    availabilityStatus = "BOOKING_CLOSED";
  } else {
    availabilityStatus = "AVAILABLE";
  }

  return {
    effectiveStatus,
    bookingStartTime,
    bookingEndTime,
    totalSlots,
    bookedSlots,
    remainingSlots,
    isSoldOut,
    isEventEnded,
    isBookingClosed,
    availabilityStatus,
    isBookable:
      effectiveStatus === EventStatus.ACTIVE && !isSoldOut && !isEventEnded && !isBookingClosed,
  };
};

const buildEventWhere = (
  query: {
    search?: string;
    restaurantId?: number;
    regionId?: number;
    status?: string;
  },
  mode: "admin" | "public",
): Prisma.EventWhereInput => {
  const clauses: Prisma.EventWhereInput[] = [];
  const trimmedSearch = query.search?.trim();

  if (trimmedSearch) {
    clauses.push({
      OR: [
        { title: { contains: trimmedSearch } },
        { description: { contains: trimmedSearch } },
        { discountLabel: { contains: trimmedSearch } },
      ],
    });
  }

  if (typeof query.restaurantId === "number") {
    clauses.push({ restaurantId: query.restaurantId });
  }

  if (typeof query.regionId === "number") {
    clauses.push({ regionId: query.regionId });
  }

  if (mode === "admin") {
    if (query.status) {
      if (query.status === EventStatus.EXPIRED) {
        clauses.push({
          OR: [
            { status: EventStatus.EXPIRED },
            {
              status: EventStatus.ACTIVE,
              endsAt: {
                lt: new Date(),
              },
            },
          ],
        });
      } else {
        clauses.push({ status: query.status });
      }
    }
  } else {
    clauses.push({
      status: EventStatus.ACTIVE,
      endsAt: {
        gte: new Date(),
      },
    });
  }

  return clauses.length ? { AND: clauses } : {};
};

const ensureTargetExists = async (input: {
  restaurantId?: number | null;
  regionId?: number | null;
}) => {
  if (typeof input.restaurantId === "number") {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: input.restaurantId },
      select: { id: true },
    });

    if (!restaurant) {
      throw new AppError(StatusCodes.NOT_FOUND, "Restaurant not found", "RESTAURANT_NOT_FOUND");
    }
  }

  if (typeof input.regionId === "number") {
    const region = await prisma.region.findUnique({
      where: { id: input.regionId },
      select: { id: true },
    });

    if (!region) {
      throw new AppError(StatusCodes.NOT_FOUND, "Region not found", "REGION_NOT_FOUND");
    }
  }
};

const getEventById = async (eventId: number) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: eventSelect,
  });

  if (!event) {
    throw new AppError(StatusCodes.NOT_FOUND, "Event not found", "EVENT_NOT_FOUND");
  }

  return event;
};

const getEventBookingMetrics = async (eventIds: number[], userId?: number) => {
  const bookedSlotsByEventId = new Map<number, number>();
  const confirmedBookingCountByEventId = new Map<number, number>();
  const revenueByEventId = new Map<number, number>();
  const currentUserBookingByEventId = new Map<number, CurrentUserBookingSummary>();

  if (!eventIds.length) {
    return {
      bookedSlotsByEventId,
      confirmedBookingCountByEventId,
      revenueByEventId,
      currentUserBookingByEventId,
    };
  }

  const bookings = await prisma.eventBooking.findMany({
    where: {
      eventId: {
        in: eventIds,
      },
    },
    select: {
      id: true,
      eventId: true,
      userId: true,
      restaurantId: true,
      quantity: true,
      totalAmount: true,
      bookingCode: true,
      status: true,
      bookedAt: true,
      cancelledAt: true,
      paymentStatus: true,
      paymentMethod: true,
      paymentMethodId: true,
    },
  });

  bookings.forEach((booking) => {
    const isActiveBooking = ACTIVE_BOOKING_STATUSES.includes(
      booking.status as (typeof ACTIVE_BOOKING_STATUSES)[number],
    );

    if (isActiveBooking) {
      bookedSlotsByEventId.set(
        booking.eventId,
        (bookedSlotsByEventId.get(booking.eventId) ?? 0) + booking.quantity,
      );
      confirmedBookingCountByEventId.set(
        booking.eventId,
        (confirmedBookingCountByEventId.get(booking.eventId) ?? 0) + 1,
      );

      if (booking.paymentStatus === PaymentStatus.PAID) {
        revenueByEventId.set(
          booking.eventId,
          Number(((revenueByEventId.get(booking.eventId) ?? 0) + booking.totalAmount).toFixed(2)),
        );
      }
    }

    if (
      userId &&
      booking.userId === userId &&
      booking.status !== EventBookingStatus.CANCELLED &&
      booking.status !== EventBookingStatus.REFUNDED
    ) {
      currentUserBookingByEventId.set(booking.eventId, booking);
    }
  });

  return {
    bookedSlotsByEventId,
    confirmedBookingCountByEventId,
    revenueByEventId,
    currentUserBookingByEventId,
  };
};

const getRestaurantBookingContext = async (restaurantId: number) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      name: true,
      slug: true,
      regionId: true,
      ownerId: true,
      isActive: true,
    },
  });

  if (!restaurant || !restaurant.isActive) {
    throw new AppError(StatusCodes.NOT_FOUND, "Restaurant not found", "RESTAURANT_NOT_FOUND");
  }

  return restaurant;
};

const assertEventMatchesRestaurant = async (event: EventRecord, restaurantId: number) => {
  const restaurant = await getRestaurantBookingContext(restaurantId);

  if (event.restaurantId && event.restaurantId !== restaurantId) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "This event is not available for the selected restaurant.",
      "EVENT_RESTAURANT_MISMATCH",
    );
  }

  if (event.regionId && restaurant.regionId !== event.regionId) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "This event is not available for the selected restaurant.",
      "EVENT_REGION_MISMATCH",
    );
  }

  return restaurant;
};

const validateBookableEvent = (
  event: EventRecord,
  quantity: number,
  bookedSlotsOverride?: number,
) => {
  const availability = getEventAvailability(event, bookedSlotsOverride ?? event.bookedSlots);

  if (availability.effectiveStatus !== EventStatus.ACTIVE) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Only active events can be booked right now.",
      "EVENT_NOT_ACTIVE",
    );
  }

  if (availability.isEventEnded) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "This event has already ended.",
      "EVENT_ENDED",
    );
  }

  if (Date.now() < availability.bookingStartTime.getTime()) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Booking has not opened for this event yet.",
      "EVENT_BOOKING_NOT_OPEN",
    );
  }

  if (Date.now() > availability.bookingEndTime.getTime()) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Booking is closed for this event.",
      "EVENT_BOOKING_CLOSED",
    );
  }

  if (availability.isSoldOut) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "This event is sold out right now.",
      "EVENT_SOLD_OUT",
    );
  }

  if (availability.remainingSlots != null && quantity > availability.remainingSlots) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Requested tickets exceed the remaining event slots.",
      "EVENT_SLOT_LIMIT_EXCEEDED",
    );
  }

  if (event.maxTicketsPerUser != null && quantity > event.maxTicketsPerUser) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Requested tickets exceed the per-user booking limit.",
      "EVENT_TICKET_LIMIT_EXCEEDED",
    );
  }

  return availability;
};

const buildBookingCode = (bookingId: number, bookedAt: Date) =>
  `EVT-${bookedAt.getUTCFullYear()}-${String(bookingId).padStart(4, "0")}`;

const roundCurrency = (value: number) => Number(value.toFixed(2));

const validateSavedPaymentMethod = async (
  tx: Prisma.TransactionClient,
  input: {
    userId: number;
    slotPrice: number;
    paymentMethod?: string;
    paymentMethodId?: number;
    savedPaymentMethodId?: number;
  },
) => {
  if (input.slotPrice <= 0) {
    return {
      paymentStatus: PaymentStatus.FREE,
      paymentMethod: null,
      paymentMethodId: null,
    };
  }

  if (
    !input.paymentMethod ||
    !EVENT_PAYMENT_METHODS.includes(input.paymentMethod as (typeof EVENT_PAYMENT_METHODS)[number])
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Choose a saved card or UPI payment method before confirming this booking.",
      "PAYMENT_METHOD_REQUIRED",
    );
  }

  const selectedSavedPaymentMethodId = input.savedPaymentMethodId ?? input.paymentMethodId;

  if (!selectedSavedPaymentMethodId) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Choose a saved card or UPI payment method before confirming this booking.",
      "PAYMENT_METHOD_REQUIRED",
    );
  }

  const paymentMethod = await tx.savedPaymentMethod.findFirst({
    where: {
      id: selectedSavedPaymentMethodId,
      userId: input.userId,
    },
    select: {
      id: true,
      type: true,
    },
  });

  if (!paymentMethod) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Select a valid saved payment method before continuing.",
      "PAYMENT_METHOD_INVALID",
    );
  }

  if (paymentMethod.type !== input.paymentMethod) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Selected payment details do not match the chosen payment mode.",
      "PAYMENT_METHOD_MODE_MISMATCH",
    );
  }

  return {
    paymentStatus: PaymentStatus.PAID,
    paymentMethod: paymentMethod.type,
    paymentMethodId: paymentMethod.id,
  };
};

const mapBookingSummary = (
  booking?: CurrentUserBookingSummary | EventBookingRecord | null,
) => {
  if (!booking) {
    return null;
  }

  return {
    id: booking.id,
    eventId: booking.eventId,
    restaurantId: booking.restaurantId,
    quantity: booking.quantity,
    totalAmount: booking.totalAmount,
    bookingCode: booking.bookingCode,
    status: booking.status,
    bookedAt: booking.bookedAt,
    cancelledAt: booking.cancelledAt ?? null,
    paymentStatus: booking.paymentStatus,
    paymentMethod: booking.paymentMethod ?? null,
    paymentMethodId: booking.paymentMethodId ?? null,
  };
};

const mapEvent = (
  event: EventRecord,
  options?: {
    bookedSlots?: number;
    confirmedBookingCount?: number;
    revenue?: number;
    currentUserBooking?: CurrentUserBookingSummary | null;
    restaurantOverride?: RestaurantContext | null;
  },
) => {
  const bookedSlots = options?.bookedSlots ?? event.bookedSlots;
  const availability = getEventAvailability(event, bookedSlots);
  const userBooking = mapBookingSummary(options?.currentUserBooking);

  return {
    ...event,
    restaurant: options?.restaurantOverride ?? event.restaurant,
    status: availability.effectiveStatus,
    appliesToAllRestaurants: !event.restaurantId && !event.regionId,
    bookingStartTime: availability.bookingStartTime,
    bookingEndTime: availability.bookingEndTime,
    totalSlots: availability.totalSlots,
    bookedSlots: availability.bookedSlots,
    remainingSlots: availability.remainingSlots,
    slotPrice: event.slotPrice ?? 0,
    maxTicketsPerUser: event.maxTicketsPerUser ?? null,
    isSoldOut: availability.isSoldOut,
    isFullyBooked: availability.isSoldOut,
    isBookingClosed: availability.isBookingClosed,
    isEventEnded: availability.isEventEnded,
    availabilityStatus: availability.availabilityStatus,
    isBookable: availability.isBookable,
    bookingsCount: options?.confirmedBookingCount ?? 0,
    revenue: options?.revenue ?? 0,
    userBooking,
    hasUserBooking: Boolean(userBooking),

    // Compatibility fields for the existing event cards and admin tables.
    maxAttendees: availability.totalSlots,
    attendeeCount: availability.bookedSlots,
    isJoined: Boolean(userBooking),
    joinedAt: userBooking?.bookedAt ?? null,
  };
};

const mapEventBooking = (
  booking: EventBookingRecord,
  options?: {
    bookedSlots?: number;
    confirmedBookingCount?: number;
    revenue?: number;
  },
) => {
  const activeStatuses = new Set(ACTIVE_BOOKING_STATUSES);

  return {
    id: booking.id,
    userId: booking.userId,
    eventId: booking.eventId,
    restaurantId: booking.restaurantId,
    quantity: booking.quantity,
    totalAmount: booking.totalAmount,
    bookingCode: booking.bookingCode,
    status: booking.status,
    bookedAt: booking.bookedAt,
    cancelledAt: booking.cancelledAt,
    paymentStatus: booking.paymentStatus,
    paymentMethod: booking.paymentMethod,
    paymentMethodId: booking.paymentMethodId,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    canCancel:
      booking.status === EventBookingStatus.CONFIRMED &&
      booking.event.startsAt.getTime() > Date.now(),
    isUpcoming:
      booking.status === EventBookingStatus.CONFIRMED &&
      booking.event.endsAt.getTime() >= Date.now(),
    isPastEvent: booking.event.endsAt.getTime() < Date.now(),
    hasActiveBooking: activeStatuses.has(
      booking.status as (typeof ACTIVE_BOOKING_STATUSES)[number],
    ),
    restaurant: {
      id: booking.restaurant.id,
      name: booking.restaurant.name,
      slug: booking.restaurant.slug,
    },
    user: booking.user,
    event: mapEvent(booking.event, {
      bookedSlots: options?.bookedSlots,
      confirmedBookingCount: options?.confirmedBookingCount,
      revenue: options?.revenue,
      currentUserBooking: mapBookingSummary(booking),
    }),
  };
};

const sortMyEventBookings = <T extends { event: { startsAt: Date; endsAt: Date }; status: string }>(
  left: T,
  right: T,
) => {
  const leftUpcoming =
    left.status === EventBookingStatus.CONFIRMED && left.event.endsAt.getTime() >= Date.now();
  const rightUpcoming =
    right.status === EventBookingStatus.CONFIRMED && right.event.endsAt.getTime() >= Date.now();

  if (leftUpcoming !== rightUpcoming) {
    return leftUpcoming ? -1 : 1;
  }

  if (leftUpcoming) {
    return left.event.startsAt.getTime() - right.event.startsAt.getTime();
  }

  return right.event.endsAt.getTime() - left.event.endsAt.getTime();
};

const buildEventPayload = (
  input: {
    title: string;
    description: string;
    restaurantId?: number | null;
    regionId?: number | null;
    imageUrl?: string | null;
    startsAt: Date;
    endsAt: Date;
    bookingStartTime?: Date | null;
    bookingEndTime?: Date | null;
    discountLabel?: string | null;
    totalSlots?: number | null;
    maxAttendees?: number | null;
    slotPrice?: number | null;
    maxTicketsPerUser?: number | null;
    status: string;
  },
) => ({
  title: input.title,
  description: input.description,
  restaurantId: input.restaurantId ?? null,
  regionId: input.regionId ?? null,
  imageUrl: input.imageUrl ?? null,
  startsAt: input.startsAt,
  endsAt: input.endsAt,
  bookingStartTime: input.bookingStartTime ?? null,
  bookingEndTime: input.bookingEndTime ?? null,
  discountLabel: input.discountLabel ?? null,
  totalSlots: input.totalSlots ?? input.maxAttendees ?? null,
  slotPrice: input.slotPrice != null ? roundCurrency(input.slotPrice) : null,
  maxTicketsPerUser: input.maxTicketsPerUser ?? null,
  status: input.status,
});

export const eventsService = {
  async listAdmin(query: {
    search?: string;
    restaurantId?: number;
    regionId?: number;
    status?: string;
  }) {
    const events = await prisma.event.findMany({
      where: buildEventWhere(query, "admin"),
      select: eventSelect,
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    });
    const { bookedSlotsByEventId, confirmedBookingCountByEventId, revenueByEventId } =
      await getEventBookingMetrics(events.map((event) => event.id));

    return events.map((event) =>
      mapEvent(event, {
        bookedSlots: bookedSlotsByEventId.get(event.id) ?? event.bookedSlots,
        confirmedBookingCount: confirmedBookingCountByEventId.get(event.id) ?? 0,
        revenue: revenueByEventId.get(event.id) ?? 0,
      }),
    );
  },

  async listPublic(
    query: {
      search?: string;
      restaurantId?: number;
      regionId?: number;
    },
    userId?: number,
  ) {
    const events = await prisma.event.findMany({
      where: buildEventWhere(query, "public"),
      select: eventSelect,
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    });
    const { bookedSlotsByEventId, confirmedBookingCountByEventId, revenueByEventId, currentUserBookingByEventId } =
      await getEventBookingMetrics(
        events.map((event) => event.id),
        userId,
      );

    return events.map((event) =>
      mapEvent(event, {
        bookedSlots: bookedSlotsByEventId.get(event.id) ?? event.bookedSlots,
        confirmedBookingCount: confirmedBookingCountByEventId.get(event.id) ?? 0,
        revenue: revenueByEventId.get(event.id) ?? 0,
        currentUserBooking: currentUserBookingByEventId.get(event.id) ?? null,
      }),
    );
  },

  async listForRestaurantPublic(restaurantId: number, userId?: number) {
    const restaurant = await getRestaurantBookingContext(restaurantId);

    const events = await prisma.event.findMany({
      where: {
        status: EventStatus.ACTIVE,
        endsAt: {
          gte: new Date(),
        },
        OR: [
          { restaurantId },
          ...(restaurant.regionId ? [{ regionId: restaurant.regionId }] : []),
          {
            restaurantId: null,
            regionId: null,
          },
        ],
      },
      select: eventSelect,
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    });

    const {
      bookedSlotsByEventId,
      confirmedBookingCountByEventId,
      revenueByEventId,
      currentUserBookingByEventId,
    } = await getEventBookingMetrics(
      events.map((event) => event.id),
      userId,
    );

    return events.map((event) =>
      mapEvent(event, {
        bookedSlots: bookedSlotsByEventId.get(event.id) ?? event.bookedSlots,
        confirmedBookingCount: confirmedBookingCountByEventId.get(event.id) ?? 0,
        revenue: revenueByEventId.get(event.id) ?? 0,
        currentUserBooking: currentUserBookingByEventId.get(event.id) ?? null,
        restaurantOverride: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
        },
      }),
    );
  },

  async create(input: {
    title: string;
    description: string;
    restaurantId?: number | null;
    regionId?: number | null;
    imageUrl?: string | null;
    startsAt: Date;
    endsAt: Date;
    bookingStartTime?: Date | null;
    bookingEndTime?: Date | null;
    discountLabel?: string | null;
    totalSlots?: number | null;
    maxAttendees?: number | null;
    slotPrice?: number | null;
    maxTicketsPerUser?: number | null;
    status: string;
  }) {
    await ensureTargetExists(input);

    const totalSlots = input.totalSlots ?? input.maxAttendees ?? null;

    if (totalSlots != null && input.maxTicketsPerUser != null && input.maxTicketsPerUser > totalSlots) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Per-user ticket limit cannot exceed the total slot count.",
        "INVALID_EVENT_SLOT_LIMIT",
      );
    }

    const event = await prisma.event.create({
      data: buildEventPayload({ ...input, totalSlots }),
      select: eventSelect,
    });

    return mapEvent(event);
  },

  async update(
    eventId: number,
    input: Partial<{
      title: string;
      description: string;
      restaurantId: number | null;
      regionId: number | null;
      imageUrl: string | null;
      startsAt: Date;
      endsAt: Date;
      bookingStartTime: Date | null;
      bookingEndTime: Date | null;
      discountLabel: string | null;
      totalSlots: number | null;
      maxAttendees: number | null;
      slotPrice: number | null;
      maxTicketsPerUser: number | null;
      status: string;
    }>,
  ) {
    const existingEvent = await getEventById(eventId);
    const nextRestaurantId =
      input.restaurantId !== undefined ? input.restaurantId : existingEvent.restaurantId;
    const nextRegionId = input.regionId !== undefined ? input.regionId : existingEvent.regionId;

    if (typeof nextRestaurantId === "number" && typeof nextRegionId === "number") {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Assign the event to a restaurant, a region, or all restaurants.",
        "INVALID_EVENT_TARGET",
      );
    }

    await ensureTargetExists({
      restaurantId: nextRestaurantId,
      regionId: nextRegionId,
    });

    const nextStartsAt = input.startsAt ?? existingEvent.startsAt;
    const nextEndsAt = input.endsAt ?? existingEvent.endsAt;
    const nextBookingStartTime =
      input.bookingStartTime !== undefined ? input.bookingStartTime : existingEvent.bookingStartTime;
    const nextBookingEndTime =
      input.bookingEndTime !== undefined ? input.bookingEndTime : existingEvent.bookingEndTime;
    const nextTotalSlots =
      input.totalSlots !== undefined
        ? input.totalSlots
        : input.maxAttendees !== undefined
          ? input.maxAttendees
          : existingEvent.totalSlots;
    const nextMaxTicketsPerUser =
      input.maxTicketsPerUser !== undefined
        ? input.maxTicketsPerUser
        : existingEvent.maxTicketsPerUser;

    if (nextEndsAt <= nextStartsAt) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "End time must be after the start time.",
        "INVALID_EVENT_SCHEDULE",
      );
    }

    if (nextBookingStartTime && nextBookingEndTime && nextBookingEndTime <= nextBookingStartTime) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Booking end time must be after the booking start time.",
        "INVALID_EVENT_BOOKING_WINDOW",
      );
    }

    if (nextBookingEndTime && nextBookingEndTime > nextEndsAt) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Booking cannot remain open after the event ends.",
        "INVALID_EVENT_BOOKING_WINDOW",
      );
    }

    if (
      nextTotalSlots != null &&
      nextMaxTicketsPerUser != null &&
      nextMaxTicketsPerUser > nextTotalSlots
    ) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Per-user ticket limit cannot exceed the total slot count.",
        "INVALID_EVENT_SLOT_LIMIT",
      );
    }

    if (nextTotalSlots != null && nextTotalSlots < existingEvent.bookedSlots) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Total slots cannot be set below the slots that are already booked.",
        "EVENT_SLOT_COUNT_TOO_LOW",
      );
    }

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.restaurantId !== undefined ? { restaurantId: input.restaurantId } : {}),
        ...(input.regionId !== undefined ? { regionId: input.regionId } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl ?? null } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
        ...(input.bookingStartTime !== undefined
          ? { bookingStartTime: input.bookingStartTime ?? null }
          : {}),
        ...(input.bookingEndTime !== undefined ? { bookingEndTime: input.bookingEndTime ?? null } : {}),
        ...(input.discountLabel !== undefined ? { discountLabel: input.discountLabel ?? null } : {}),
        ...(input.totalSlots !== undefined
          ? { totalSlots: input.totalSlots ?? null }
          : input.maxAttendees !== undefined
            ? { totalSlots: input.maxAttendees ?? null }
            : {}),
        ...(input.slotPrice !== undefined ? { slotPrice: input.slotPrice != null ? roundCurrency(input.slotPrice) : null } : {}),
        ...(input.maxTicketsPerUser !== undefined
          ? { maxTicketsPerUser: input.maxTicketsPerUser ?? null }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: eventSelect,
    });

    const { bookedSlotsByEventId, confirmedBookingCountByEventId, revenueByEventId } =
      await getEventBookingMetrics([event.id]);

    return mapEvent(event, {
      bookedSlots: bookedSlotsByEventId.get(event.id) ?? event.bookedSlots,
      confirmedBookingCount: confirmedBookingCountByEventId.get(event.id) ?? 0,
      revenue: revenueByEventId.get(event.id) ?? 0,
    });
  },

  async remove(eventId: number) {
    await getEventById(eventId);

    await prisma.event.delete({
      where: { id: eventId },
    });
  },

  async book(
    userId: number,
    eventId: number,
    input: {
      restaurantId: number;
      quantity: number;
      paymentMethod?: string;
      paymentMethodId?: number;
      savedPaymentMethodId?: number;
    },
  ) {
    const event = await getEventById(eventId);
    const restaurant = await assertEventMatchesRestaurant(event, input.restaurantId);
    validateBookableEvent(event, input.quantity, event.bookedSlots);

    const result = await prisma.$transaction(async (tx) => {
      const latestEvent = await tx.event.findUnique({
        where: { id: eventId },
        select: eventSelect,
      });

      if (!latestEvent) {
        throw new AppError(StatusCodes.NOT_FOUND, "Event not found", "EVENT_NOT_FOUND");
      }

      validateBookableEvent(latestEvent, input.quantity, latestEvent.bookedSlots);

      const existingBooking = await tx.eventBooking.findFirst({
        where: {
          eventId,
          userId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (
        existingBooking &&
        existingBooking.status !== EventBookingStatus.CANCELLED &&
        existingBooking.status !== EventBookingStatus.REFUNDED
      ) {
        throw new AppError(
          StatusCodes.CONFLICT,
          "You have already booked this event.",
          "EVENT_ALREADY_BOOKED",
        );
      }

      const paymentDetails = await validateSavedPaymentMethod(tx, {
        userId,
        slotPrice: latestEvent.slotPrice ?? 0,
        paymentMethod: input.paymentMethod,
        paymentMethodId: input.paymentMethodId,
        savedPaymentMethodId: input.savedPaymentMethodId,
      });

      const nextBookedSlots = latestEvent.bookedSlots + input.quantity;

      if (latestEvent.totalSlots != null) {
        const updatedEventCounter = await tx.event.updateMany({
          where: {
            id: eventId,
            bookedSlots: {
              lte: latestEvent.totalSlots - input.quantity,
            },
          },
          data: {
            bookedSlots: {
              increment: input.quantity,
            },
          },
        });

        if (!updatedEventCounter.count) {
          throw new AppError(
            StatusCodes.BAD_REQUEST,
            "This event does not have enough remaining slots.",
            "EVENT_SLOT_LIMIT_EXCEEDED",
          );
        }
      } else {
        await tx.event.update({
          where: { id: eventId },
          data: {
            bookedSlots: {
              increment: input.quantity,
            },
          },
        });
      }

      const bookedAt = new Date();
      const totalAmount = roundCurrency((latestEvent.slotPrice ?? 0) * input.quantity);
      const temporaryBookingCode = `TEMP-${bookedAt.getTime()}-${userId}-${eventId}`;

      const savedBooking =
        existingBooking && existingBooking.status
          ? await tx.eventBooking.update({
              where: { id: existingBooking.id },
              data: {
                restaurantId: input.restaurantId,
                quantity: input.quantity,
                totalAmount,
                bookingCode: temporaryBookingCode,
                status: EventBookingStatus.CONFIRMED,
                bookedAt,
                cancelledAt: null,
                paymentStatus: paymentDetails.paymentStatus,
                paymentMethod: paymentDetails.paymentMethod,
                paymentMethodId: paymentDetails.paymentMethodId,
              },
              select: bookingSelect,
            })
          : await tx.eventBooking.create({
              data: {
                userId,
                eventId,
                restaurantId: input.restaurantId,
                quantity: input.quantity,
                totalAmount,
                bookingCode: temporaryBookingCode,
                status: EventBookingStatus.CONFIRMED,
                bookedAt,
                paymentStatus: paymentDetails.paymentStatus,
                paymentMethod: paymentDetails.paymentMethod,
                paymentMethodId: paymentDetails.paymentMethodId,
              },
              select: bookingSelect,
            });

      const bookingCode = buildBookingCode(savedBooking.id, bookedAt);
      const booking = await tx.eventBooking.update({
        where: { id: savedBooking.id },
        data: {
          bookingCode,
        },
        select: bookingSelect,
      });

      return {
        booking,
        bookedSlots: nextBookedSlots,
      };
    });

    await notificationsService.createForUser({
      userId,
      title: "Event booking confirmed",
      message: `You successfully booked ${input.quantity} slot${input.quantity === 1 ? "" : "s"} for ${event.title} at ${restaurant.name}. Booking code ${result.booking.bookingCode}.`,
      meta: {
        eventId,
        restaurantId: input.restaurantId,
        bookingId: result.booking.id,
        bookingCode: result.booking.bookingCode,
        path: "/my-events",
        eventKey: `event:booking:${result.booking.id}`,
      },
      dedupeWindowMinutes: 1,
    });

    return {
      booking: mapEventBooking(result.booking, {
        bookedSlots: result.bookedSlots,
        confirmedBookingCount: 1,
        revenue: result.booking.paymentStatus === PaymentStatus.PAID ? result.booking.totalAmount : 0,
      }),
      event: mapEvent(event, {
        bookedSlots: result.bookedSlots,
        confirmedBookingCount: 1,
        revenue: result.booking.paymentStatus === PaymentStatus.PAID ? result.booking.totalAmount : 0,
        currentUserBooking: mapBookingSummary(result.booking),
      }),
    };
  },

  async join(
    userId: number,
    eventId: number,
    restaurantId: number,
  ) {
    const event = await getEventById(eventId);

    if ((event.slotPrice ?? 0) > 0) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Use the event booking flow for paid events.",
        "EVENT_BOOKING_REQUIRES_PAYMENT",
      );
    }

    return this.book(userId, eventId, {
      restaurantId,
      quantity: 1,
    });
  },

  async cancelBooking(userId: number, bookingId: number) {
    const booking = await prisma.eventBooking.findFirst({
      where: {
        id: bookingId,
        userId,
      },
      select: bookingSelect,
    });

    if (!booking) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        "Event booking not found.",
        "EVENT_BOOKING_NOT_FOUND",
      );
    }

    if (!OPEN_BOOKING_STATUSES.includes(booking.status as (typeof OPEN_BOOKING_STATUSES)[number])) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "This booking cannot be cancelled anymore.",
        "EVENT_CANNOT_BE_CANCELLED",
      );
    }

    if (booking.event.startsAt.getTime() <= Date.now()) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Bookings can only be cancelled before the event starts.",
        "EVENT_CANNOT_BE_CANCELLED",
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedEventCounter = await tx.event.updateMany({
        where: {
          id: booking.eventId,
          bookedSlots: {
            gte: booking.quantity,
          },
        },
        data: {
          bookedSlots: {
            decrement: booking.quantity,
          },
        },
      });

      if (!updatedEventCounter.count) {
        throw new AppError(
          StatusCodes.CONFLICT,
          "This booking could not be cancelled safely right now.",
          "EVENT_CANCEL_CONFLICT",
        );
      }

      const nextStatus =
        booking.paymentStatus === PaymentStatus.PAID
          ? EventBookingStatus.REFUNDED
          : EventBookingStatus.CANCELLED;
      const nextPaymentStatus =
        booking.paymentStatus === PaymentStatus.PAID
          ? PaymentStatus.REFUNDED
          : booking.paymentStatus;

      const cancelledBooking = await tx.eventBooking.update({
        where: { id: booking.id },
        data: {
          status: nextStatus,
          cancelledAt: new Date(),
          paymentStatus: nextPaymentStatus,
        },
        select: bookingSelect,
      });

      return {
        booking: cancelledBooking,
      };
    });

    await notificationsService.createForUser({
      userId,
      title: "Event booking cancelled",
      message:
        booking.paymentStatus === PaymentStatus.PAID
          ? `Your booking for ${booking.event.title} was cancelled and marked for refund.`
          : `Your booking for ${booking.event.title} was cancelled successfully.`,
      meta: {
        eventId: booking.eventId,
        restaurantId: booking.restaurantId,
        bookingId: booking.id,
        path: "/my-events",
        eventKey: `event:cancel:${booking.id}`,
      },
      dedupeWindowMinutes: 1,
    });

    const { bookedSlotsByEventId, confirmedBookingCountByEventId, revenueByEventId } =
      await getEventBookingMetrics([booking.eventId], userId);

    return {
      booking: mapEventBooking(result.booking, {
        bookedSlots: bookedSlotsByEventId.get(booking.eventId) ?? 0,
        confirmedBookingCount: confirmedBookingCountByEventId.get(booking.eventId) ?? 0,
        revenue: revenueByEventId.get(booking.eventId) ?? 0,
      }),
      event: mapEvent(booking.event, {
        bookedSlots: bookedSlotsByEventId.get(booking.eventId) ?? 0,
        confirmedBookingCount: confirmedBookingCountByEventId.get(booking.eventId) ?? 0,
        revenue: revenueByEventId.get(booking.eventId) ?? 0,
      }),
    };
  },

  async cancel(userId: number, eventId: number) {
    const booking = await prisma.eventBooking.findFirst({
      where: {
        eventId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!booking) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        "Event booking not found.",
        "EVENT_BOOKING_NOT_FOUND",
      );
    }

    return this.cancelBooking(userId, booking.id);
  },

  async listMyEvents(userId: number) {
    const bookings = await prisma.eventBooking.findMany({
      where: {
        userId,
        status: {
          notIn: [EventBookingStatus.CANCELLED, EventBookingStatus.REFUNDED],
        },
      },
      select: bookingSelect,
      orderBy: [{ bookedAt: "desc" }],
    });

    const { bookedSlotsByEventId, confirmedBookingCountByEventId, revenueByEventId } =
      await getEventBookingMetrics(bookings.map((booking) => booking.eventId), userId);

    return bookings
      .map((booking) =>
        mapEventBooking(booking, {
          bookedSlots: bookedSlotsByEventId.get(booking.eventId) ?? booking.event.bookedSlots,
          confirmedBookingCount: confirmedBookingCountByEventId.get(booking.eventId) ?? 0,
          revenue: revenueByEventId.get(booking.eventId) ?? 0,
        }),
      )
      .sort(sortMyEventBookings);
  },

  async listAttendeesForAdmin(eventId: number) {
    const event = await getEventById(eventId);
    const bookings = await prisma.eventBooking.findMany({
      where: {
        eventId,
      },
      select: bookingSelect,
      orderBy: [{ bookedAt: "desc" }],
    });

    const confirmedCount = bookings.filter((booking) => booking.status === EventBookingStatus.CONFIRMED).length;
    const attendedCount = bookings.filter((booking) => booking.status === EventBookingStatus.ATTENDED).length;
    const cancelledCount = bookings.filter((booking) => booking.status === EventBookingStatus.CANCELLED).length;
    const refundedCount = bookings.filter((booking) => booking.status === EventBookingStatus.REFUNDED).length;
    const bookedSlots = bookings.reduce((total, booking) => {
      if (
        booking.status === EventBookingStatus.CONFIRMED ||
        booking.status === EventBookingStatus.ATTENDED
      ) {
        return total + booking.quantity;
      }

      return total;
    }, 0);
    const revenue = roundCurrency(
      bookings.reduce((total, booking) => {
        if (
          (booking.status === EventBookingStatus.CONFIRMED ||
            booking.status === EventBookingStatus.ATTENDED) &&
          booking.paymentStatus === PaymentStatus.PAID
        ) {
          return total + booking.totalAmount;
        }

        return total;
      }, 0),
    );
    const availability = getEventAvailability(event, bookedSlots);

    const restaurantBreakdownMap = new Map<
      number,
      {
        restaurant: {
          id: number;
          name: string;
          slug: string;
        };
        bookingsCount: number;
        bookedSlots: number;
        revenue: number;
      }
    >();

    bookings.forEach((booking) => {
      const current = restaurantBreakdownMap.get(booking.restaurant.id);
      const isActiveBooking =
        booking.status === EventBookingStatus.CONFIRMED ||
        booking.status === EventBookingStatus.ATTENDED;
      const nextRevenue =
        booking.paymentStatus === PaymentStatus.PAID && isActiveBooking ? booking.totalAmount : 0;

      restaurantBreakdownMap.set(booking.restaurant.id, {
        restaurant: {
          id: booking.restaurant.id,
          name: booking.restaurant.name,
          slug: booking.restaurant.slug,
        },
        bookingsCount: (current?.bookingsCount ?? 0) + 1,
        bookedSlots: (current?.bookedSlots ?? 0) + (isActiveBooking ? booking.quantity : 0),
        revenue: roundCurrency((current?.revenue ?? 0) + nextRevenue),
      });
    });

    const mappedBookings = bookings.map((booking) =>
      mapEventBooking(booking, {
        bookedSlots,
        confirmedBookingCount: confirmedCount + attendedCount,
        revenue,
      }),
    );

    return {
      event: mapEvent(event, {
        bookedSlots,
        confirmedBookingCount: confirmedCount + attendedCount,
        revenue,
      }),
      summary: {
        bookingsCount: confirmedCount + attendedCount,
        confirmedCount,
        attendedCount,
        cancelledCount,
        refundedCount,
        bookedSlots,
        totalSlots: availability.totalSlots,
        remainingSlots: availability.remainingSlots,
        isSoldOut: availability.isSoldOut,
        isFullyBooked: availability.isSoldOut,
        isBookingClosed: availability.isBookingClosed,
        revenue,
      },
      restaurantBreakdown: [...restaurantBreakdownMap.values()].sort(
        (left, right) => right.bookedSlots - left.bookedSlots,
      ),
      bookings: mappedBookings,
      attendees: mappedBookings,
    };
  },

  async markBookingAttendedForAdmin(eventId: number, bookingId: number) {
    const booking = await prisma.eventBooking.findFirst({
      where: {
        id: bookingId,
        eventId,
      },
      select: bookingSelect,
    });

    if (!booking) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        "Event booking not found.",
        "EVENT_BOOKING_NOT_FOUND",
      );
    }

    if (booking.status !== EventBookingStatus.CONFIRMED) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Only confirmed bookings can be marked as attended.",
        "EVENT_BOOKING_NOT_ATTENDABLE",
      );
    }

    if (booking.event.startsAt.getTime() > Date.now()) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Check-in becomes available after the event starts.",
        "EVENT_CHECKIN_NOT_OPEN",
      );
    }

    const updatedBooking = await prisma.eventBooking.update({
      where: { id: bookingId },
      data: {
        status: EventBookingStatus.ATTENDED,
      },
      select: bookingSelect,
    });

    await notificationsService.createForUser({
      userId: booking.userId,
      title: "Event check-in completed",
      message: `Your booking for ${booking.event.title} has been marked as attended.`,
      meta: {
        eventId: booking.eventId,
        restaurantId: booking.restaurantId,
        bookingId,
        bookingCode: booking.bookingCode,
        path: "/my-events",
        eventKey: `event:attended:${bookingId}`,
      },
      dedupeWindowMinutes: 1,
    });

    const { bookedSlotsByEventId, confirmedBookingCountByEventId, revenueByEventId } =
      await getEventBookingMetrics([booking.eventId], booking.userId);

    return {
      booking: mapEventBooking(updatedBooking, {
        bookedSlots: bookedSlotsByEventId.get(booking.eventId) ?? updatedBooking.event.bookedSlots,
        confirmedBookingCount: confirmedBookingCountByEventId.get(booking.eventId) ?? 0,
        revenue: revenueByEventId.get(booking.eventId) ?? 0,
      }),
    };
  },

  async listOwnerParticipation(userId: number) {
    const ownedRestaurants = await prisma.restaurant.findMany({
      where: {
        ownerId: userId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        regionId: true,
      },
      orderBy: { name: "asc" },
    });

    if (!ownedRestaurants.length) {
      return [];
    }

    const ownedRestaurantIds = ownedRestaurants.map((restaurant) => restaurant.id);
    const ownedRegionIds = [
      ...new Set(
        ownedRestaurants.flatMap((restaurant) => (restaurant.regionId ? [restaurant.regionId] : [])),
      ),
    ];

    const events = await prisma.event.findMany({
      where: {
        status: EventStatus.ACTIVE,
        endsAt: {
          gte: new Date(),
        },
        OR: [
          { restaurantId: { in: ownedRestaurantIds } },
          ...(ownedRegionIds.length ? [{ regionId: { in: ownedRegionIds } }] : []),
          {
            restaurantId: null,
            regionId: null,
          },
        ],
      },
      select: eventSelect,
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    });

    if (!events.length) {
      return [];
    }

    const eventIds = events.map((event) => event.id);
    const [bookingMetrics, ownerBookings] = await Promise.all([
      getEventBookingMetrics(eventIds),
      prisma.eventBooking.findMany({
        where: {
          eventId: { in: eventIds },
          restaurantId: { in: ownedRestaurantIds },
        },
        select: bookingSelect,
        orderBy: [{ bookedAt: "desc" }],
      }),
    ]);

    const restaurantBookingSummaryByKey = ownerBookings.reduce(
      (summaries, booking) => {
        const key = `${booking.eventId}:${booking.restaurantId}`;
        const current = summaries.get(key) ?? {
          bookedSlots: 0,
          revenue: 0,
          bookings: [] as EventBookingRecord[],
        };
        const isActiveBooking =
          booking.status === EventBookingStatus.CONFIRMED ||
          booking.status === EventBookingStatus.ATTENDED;

        current.bookedSlots += isActiveBooking ? booking.quantity : 0;
        current.revenue = roundCurrency(
          current.revenue +
            (isActiveBooking && booking.paymentStatus === PaymentStatus.PAID ? booking.totalAmount : 0),
        );
        current.bookings.push(booking);
        summaries.set(key, current);
        return summaries;
      },
      new Map<
        string,
        {
          bookedSlots: number;
          revenue: number;
          bookings: EventBookingRecord[];
        }
      >(),
    );

    return ownedRestaurants.flatMap((restaurant) => {
      const applicableEvents = events.filter(
        (event) =>
          event.restaurantId === restaurant.id ||
          (event.regionId != null && event.regionId === restaurant.regionId) ||
          (!event.restaurantId && !event.regionId),
      );

      return applicableEvents.map((event) => {
        const key = `${event.id}:${restaurant.id}`;
        const restaurantSummary = restaurantBookingSummaryByKey.get(key) ?? {
          bookedSlots: 0,
          revenue: 0,
          bookings: [],
        };

        return {
          event: mapEvent(event, {
            bookedSlots:
              bookingMetrics.bookedSlotsByEventId.get(event.id) ?? event.bookedSlots,
            confirmedBookingCount:
              bookingMetrics.confirmedBookingCountByEventId.get(event.id) ?? 0,
            revenue: bookingMetrics.revenueByEventId.get(event.id) ?? 0,
          }),
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
          },
          restaurantBookedSlots: restaurantSummary.bookedSlots,
          restaurantRevenue: restaurantSummary.revenue,
          bookings: restaurantSummary.bookings.slice(0, 5).map((booking) =>
            mapEventBooking(booking, {
              bookedSlots:
                bookingMetrics.bookedSlotsByEventId.get(event.id) ?? event.bookedSlots,
              confirmedBookingCount:
                bookingMetrics.confirmedBookingCountByEventId.get(event.id) ?? 0,
              revenue: bookingMetrics.revenueByEventId.get(event.id) ?? 0,
            }),
          ),
        };
      });
    });
  },

  async markBookingAttendedForOwner(userId: number, bookingId: number) {
    const booking = await prisma.eventBooking.findFirst({
      where: {
        id: bookingId,
      },
      select: bookingSelect,
    });

    if (!booking || booking.restaurant.ownerId !== userId) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        "Event booking not found.",
        "EVENT_BOOKING_NOT_FOUND",
      );
    }

    return this.markBookingAttendedForAdmin(booking.eventId, bookingId);
  },
};
