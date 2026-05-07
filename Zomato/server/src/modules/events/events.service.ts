import { Prisma } from "@prisma/client";
import {
  EventBookingStatus,
  EventStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { notificationsService } from "../notifications/notifications.service.js";

const ACTIVE_BOOKING_STATUSES = [
  EventBookingStatus.CONFIRMED,
  EventBookingStatus.ATTENDED,
] as const;
const SLOT_RESERVED_BOOKING_STATUSES = [
  EventBookingStatus.PENDING,
  EventBookingStatus.CONFIRMED,
  EventBookingStatus.ATTENDED,
] as const;
const REBOOKABLE_BOOKING_STATUSES = [
  EventBookingStatus.CANCELLED,
  EventBookingStatus.REFUNDED,
  EventBookingStatus.FAILED,
] as const;
const CANCELLABLE_BOOKING_STATUSES = [
  EventBookingStatus.PENDING,
  EventBookingStatus.CONFIRMED,
] as const;
const EVENT_PAYMENT_METHODS = [PaymentMethod.CARD, PaymentMethod.UPI] as const;
const EVENT_PLATFORM_FEE = 20;
const EVENT_GST_RATE = 0.05;

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

const eventTemplateSelect = {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  suggestedDurationMinutes: true,
  suggestedBookingWindowHours: true,
  suggestedSlotPrice: true,
  suggestedMaxSlots: true,
  suggestedMaxTicketsPerUser: true,
  suggestedOfferLabel: true,
  setupChecklist: true,
  requiredItems: true,
  status: true,
  createdByAdminId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EventTemplateSelect;

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
  slotPrice: true,
  quantity: true,
  subtotalAmount: true,
  taxAmount: true,
  platformFee: true,
  discountAmount: true,
  totalAmount: true,
  bookingCode: true,
  status: true,
  bookedAt: true,
  cancelledAt: true,
  paymentStatus: true,
  paymentMethod: true,
  paymentMethodId: true,
  refundAmount: true,
  refundStatus: true,
  refundReason: true,
  cancellationAllowedUntil: true,
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
type EventTemplateRecord = Prisma.EventTemplateGetPayload<{ select: typeof eventTemplateSelect }>;
type EventBookingRecord = Prisma.EventBookingGetPayload<{ select: typeof bookingSelect }>;
type RestaurantContext = NonNullable<EventRecord["restaurant"]>;
type SavedPaymentMethodLookupClient = Pick<Prisma.TransactionClient, "savedPaymentMethod">;

type CurrentUserBookingSummary = {
  id: number;
  eventId: number;
  restaurantId: number;
  slotPrice: number | null;
  quantity: number;
  subtotalAmount: number | null;
  taxAmount: number | null;
  platformFee: number | null;
  discountAmount: number | null;
  totalAmount: number;
  bookingCode: string;
  status: string;
  bookedAt: Date;
  cancelledAt: Date | null;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentMethodId: number | null;
  refundAmount: number | null;
  refundStatus: string | null;
  refundReason: string | null;
  cancellationAllowedUntil: Date | null;
};

const isNamedError = (error: unknown, name: string): error is Error =>
  error instanceof Error && error.name === name;

const isPrismaKnownRequestError = (
  error: unknown,
  code?: string,
): error is Error & { code: string; meta?: unknown } =>
  isNamedError(error, "PrismaClientKnownRequestError") &&
  typeof (error as { code?: unknown }).code === "string" &&
  (code ? Reflect.get(error, "code") === code : true);

const getDatabaseErrorMessage = (error: unknown) => {
  if (!isPrismaKnownRequestError(error)) {
    return error instanceof Error ? error.message : "";
  }

  if (!error.meta || typeof error.meta !== "object") {
    return error.message;
  }

  const metaMessage = Reflect.get(error.meta, "message");
  return typeof metaMessage === "string" && metaMessage.trim() ? metaMessage : error.message;
};

const bookingDatabaseBusyFragments = [
  "transaction api error",
  "expired transaction",
  "unable to start a transaction",
  "transaction not found",
  "could not keep this write request open long enough",
];

const includesAnyFragment = (value: string, fragments: string[]) =>
  fragments.some((fragment) => value.includes(fragment));

const isTransientBookingDatabaseError = (error: unknown) => {
  const message = getDatabaseErrorMessage(error).toLowerCase();

  return (
    isPrismaKnownRequestError(error, "P2028") &&
    includesAnyFragment(message, bookingDatabaseBusyFragments)
  );
};

const serializeDatabaseError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(isPrismaKnownRequestError(error)
        ? {
            code: error.code,
            meta: error.meta,
          }
        : {}),
    };
  }

  return {
    value: error,
  };
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

const getEventTemplateById = async (
  templateId: number,
  options?: { activeOnly?: boolean },
) => {
  const template = await prisma.eventTemplate.findUnique({
    where: { id: templateId },
    select: eventTemplateSelect,
  });

  if (!template || (options?.activeOnly && template.status !== EventStatus.ACTIVE)) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      "Event template not found.",
      "EVENT_TEMPLATE_NOT_FOUND",
    );
  }

  return template;
};

const getEventBookingMetrics = async (eventIds: number[], userId?: number) => {
  const bookedSlotsByEventId = new Map<number, number>();
  const confirmedBookingCountByEventId = new Map<number, number>();
  const revenueByEventId = new Map<number, number>();
  const taxByEventId = new Map<number, number>();
  const refundedAmountByEventId = new Map<number, number>();
  const currentUserBookingByEventId = new Map<number, CurrentUserBookingSummary>();

  if (!eventIds.length) {
    return {
      bookedSlotsByEventId,
      confirmedBookingCountByEventId,
      revenueByEventId,
      taxByEventId,
      refundedAmountByEventId,
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
      slotPrice: true,
      quantity: true,
      subtotalAmount: true,
      taxAmount: true,
      platformFee: true,
      discountAmount: true,
      totalAmount: true,
      bookingCode: true,
      status: true,
      bookedAt: true,
      cancelledAt: true,
      paymentStatus: true,
      paymentMethod: true,
      paymentMethodId: true,
      refundAmount: true,
      refundStatus: true,
      refundReason: true,
      cancellationAllowedUntil: true,
    },
  });

  bookings.forEach((booking) => {
    const reservesSlots = SLOT_RESERVED_BOOKING_STATUSES.includes(
      booking.status as (typeof SLOT_RESERVED_BOOKING_STATUSES)[number],
    );
    const isActiveBooking = ACTIVE_BOOKING_STATUSES.includes(
      booking.status as (typeof ACTIVE_BOOKING_STATUSES)[number],
    );

    if (reservesSlots) {
      bookedSlotsByEventId.set(
        booking.eventId,
        (bookedSlotsByEventId.get(booking.eventId) ?? 0) + booking.quantity,
      );
    }

    if (isActiveBooking) {
      confirmedBookingCountByEventId.set(
        booking.eventId,
        (confirmedBookingCountByEventId.get(booking.eventId) ?? 0) + 1,
      );

      if (booking.paymentStatus === PaymentStatus.PAID) {
        revenueByEventId.set(
          booking.eventId,
          Number(((revenueByEventId.get(booking.eventId) ?? 0) + booking.totalAmount).toFixed(2)),
        );
        taxByEventId.set(
          booking.eventId,
          Number(((taxByEventId.get(booking.eventId) ?? 0) + (booking.taxAmount ?? 0)).toFixed(2)),
        );
      }
    }

    if (
      booking.paymentStatus === PaymentStatus.REFUNDED ||
      booking.paymentStatus === PaymentStatus.REFUND_PENDING
    ) {
      refundedAmountByEventId.set(
        booking.eventId,
        Number(((refundedAmountByEventId.get(booking.eventId) ?? 0) + (booking.refundAmount ?? 0)).toFixed(2)),
      );
    }

    if (
      userId &&
      booking.userId === userId &&
      !REBOOKABLE_BOOKING_STATUSES.includes(
        booking.status as (typeof REBOOKABLE_BOOKING_STATUSES)[number],
      )
    ) {
      currentUserBookingByEventId.set(booking.eventId, booking);
    }
  });

  return {
    bookedSlotsByEventId,
    confirmedBookingCountByEventId,
    revenueByEventId,
    taxByEventId,
    refundedAmountByEventId,
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

const assertOwnerCanManageRestaurant = async (userId: number, restaurantId: number) => {
  const restaurant = await getRestaurantBookingContext(restaurantId);

  if (restaurant.ownerId !== userId) {
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

const validateEventBookingWindow = (
  event: EventRecord,
  bookedSlotsOverride?: number,
) => {
  const availability = getEventAvailability(event, bookedSlotsOverride ?? event.bookedSlots);

  if (availability.effectiveStatus !== EventStatus.ACTIVE) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Booking closed.", "EVENT_NOT_ACTIVE");
  }

  if (availability.isEventEnded) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Booking closed.", "EVENT_ENDED");
  }

  if (Date.now() < availability.bookingStartTime.getTime()) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Booking closed.", "EVENT_BOOKING_NOT_OPEN");
  }

  if (Date.now() > availability.bookingEndTime.getTime()) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Booking closed.", "EVENT_BOOKING_CLOSED");
  }

  return availability;
};

const validateEventSlotAvailability = (
  event: EventRecord,
  quantity: number,
  bookedSlotsOverride?: number,
) => {
  const availability = getEventAvailability(event, bookedSlotsOverride ?? event.bookedSlots);

  if (availability.isSoldOut) {
    throw new AppError(StatusCodes.CONFLICT, "Event sold out.", "EVENT_SOLD_OUT");
  }

  if (availability.remainingSlots != null && quantity > availability.remainingSlots) {
    throw new AppError(
      StatusCodes.CONFLICT,
      availability.remainingSlots <= 0
        ? "Event sold out."
        : `Only ${availability.remainingSlots} slot${availability.remainingSlots === 1 ? "" : "s"} left for this event.`,
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

const getBookingPricing = (event: Pick<EventRecord, "slotPrice" | "startsAt">, quantity: number) => {
  const slotPrice = roundCurrency(event.slotPrice ?? 0);
  const subtotalAmount = roundCurrency(slotPrice * quantity);
  const discountAmount = 0;
  const platformFee = subtotalAmount > 0 ? EVENT_PLATFORM_FEE : 0;
  const taxAmount = subtotalAmount > 0 ? roundCurrency(subtotalAmount * EVENT_GST_RATE) : 0;
  const totalAmount = roundCurrency(subtotalAmount + platformFee + taxAmount - discountAmount);

  return {
    slotPrice,
    quantity,
    subtotalAmount,
    taxAmount,
    platformFee,
    discountAmount,
    totalAmount,
    refundPolicyNote:
      "Full refund is available until the event starts. Refunds are returned to the original payment method.",
    cancellationAllowedUntil: event.startsAt,
  };
};

const normalizeBookingAmounts = (
  booking: Pick<
    EventBookingRecord | CurrentUserBookingSummary,
    | "slotPrice"
    | "quantity"
    | "subtotalAmount"
    | "taxAmount"
    | "platformFee"
    | "discountAmount"
    | "totalAmount"
    | "refundAmount"
  >,
  eventSlotPrice?: number | null,
) => {
  const slotPrice = roundCurrency(booking.slotPrice ?? eventSlotPrice ?? 0);
  const subtotalAmount = roundCurrency(booking.subtotalAmount ?? slotPrice * booking.quantity);
  const taxAmount = roundCurrency(booking.taxAmount ?? 0);
  const platformFee = roundCurrency(booking.platformFee ?? (subtotalAmount > 0 ? 0 : 0));
  const discountAmount = roundCurrency(booking.discountAmount ?? 0);

  return {
    slotPrice,
    subtotalAmount,
    taxAmount,
    platformFee,
    discountAmount,
    totalAmount: roundCurrency(booking.totalAmount),
    refundAmount: roundCurrency(booking.refundAmount ?? 0),
  };
};

const getRefundStatusForBooking = (
  paymentStatus: string,
  refundStatus?: string | null,
) => {
  if (refundStatus) {
    return refundStatus;
  }

  if (paymentStatus === PaymentStatus.REFUNDED) {
    return RefundStatus.REFUNDED;
  }

  if (paymentStatus === PaymentStatus.REFUND_PENDING) {
    return RefundStatus.PENDING;
  }

  return RefundStatus.NOT_REQUESTED;
};

const reserveSequentialId = async (model: string) => {
  const counter = await prisma.idCounter.upsert({
    where: { id: model },
    create: {
      id: model,
      value: 1,
    },
    update: {
      value: {
        increment: 1,
      },
    },
  });

  return counter.value;
};

const buildEventBookingLogContext = (
  input: {
    bookingId?: number | null;
    eventId: number;
    userId: number;
    requestedQuantity: number;
    totalSlots?: number | null;
    bookedSlots?: number | null;
    remainingSlots?: number | null;
  },
  error?: unknown,
) => ({
  bookingId: input.bookingId ?? null,
  eventId: input.eventId,
  userId: input.userId,
  requestedQuantity: input.requestedQuantity,
  totalSlots: input.totalSlots ?? null,
  bookedSlots: input.bookedSlots ?? null,
  remainingSlots: input.remainingSlots ?? null,
  ...(error ? { databaseError: serializeDatabaseError(error) } : {}),
});

const rollbackBookedSlotsIncrement = async (eventId: number, quantity: number, userId: number) => {
  try {
    await prisma.event.updateMany({
      where: {
        id: eventId,
        bookedSlots: {
          gte: quantity,
        },
      },
      data: {
        bookedSlots: {
          decrement: quantity,
        },
      },
    });
  } catch (rollbackError) {
    logger.error(
      "Event booking rollback failed",
      buildEventBookingLogContext(
        {
          eventId,
          userId,
          bookingId: null,
          requestedQuantity: quantity,
        },
        rollbackError,
      ),
    );
  }
};

const releaseReservedSlots = async (
  eventId: number,
  quantity: number,
  userId: number,
  bookingId?: number,
) => {
  try {
    await prisma.event.updateMany({
      where: {
        id: eventId,
        bookedSlots: {
          gte: quantity,
        },
      },
      data: {
        bookedSlots: {
          decrement: quantity,
        },
      },
    });
  } catch (releaseError) {
    logger.error(
      "Event slot release failed",
      buildEventBookingLogContext(
        {
          bookingId,
          eventId,
          userId,
          requestedQuantity: quantity,
        },
        releaseError,
      ),
    );
  }
};

const restoreReleasedSlots = async (
  eventId: number,
  quantity: number,
  userId: number,
  bookingId?: number,
) => {
  try {
    await prisma.event.update({
      where: { id: eventId },
      data: {
        bookedSlots: {
          increment: quantity,
        },
      },
    });
  } catch (restoreError) {
    logger.error(
      "Event slot restore failed",
      buildEventBookingLogContext(
        {
          bookingId,
          eventId,
          userId,
          requestedQuantity: quantity,
        },
        restoreError,
      ),
    );
  }
};

const mapEventBookingWriteError = (error: unknown) => {
  if (error instanceof AppError) {
    return error;
  }

  if (isPrismaKnownRequestError(error, "P2002")) {
    return new AppError(StatusCodes.CONFLICT, "Already booked.", "EVENT_ALREADY_BOOKED");
  }

  if (isTransientBookingDatabaseError(error)) {
    return new AppError(
      StatusCodes.SERVICE_UNAVAILABLE,
      "Database busy, please try again.",
      "EVENT_BOOKING_DATABASE_BUSY",
    );
  }

  return error;
};

const validateSavedPaymentMethod = async (
  client: SavedPaymentMethodLookupClient,
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

  const paymentMethod = await client.savedPaymentMethod.findFirst({
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
    paymentStatus: PaymentStatus.PENDING,
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
    slotPrice: booking.slotPrice ?? null,
    quantity: booking.quantity,
    subtotalAmount: booking.subtotalAmount ?? null,
    taxAmount: booking.taxAmount ?? null,
    platformFee: booking.platformFee ?? null,
    discountAmount: booking.discountAmount ?? null,
    totalAmount: booking.totalAmount,
    bookingCode: booking.bookingCode,
    bookingStatus: booking.status,
    status: booking.status,
    bookedAt: booking.bookedAt,
    cancelledAt: booking.cancelledAt ?? null,
    paymentStatus: booking.paymentStatus,
    paymentMethod: booking.paymentMethod ?? null,
    paymentMethodId: booking.paymentMethodId ?? null,
    refundAmount: booking.refundAmount ?? null,
    refundStatus: booking.refundStatus ?? null,
    refundReason: booking.refundReason ?? null,
    cancellationAllowedUntil: booking.cancellationAllowedUntil ?? null,
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
  const reservedStatuses = new Set(SLOT_RESERVED_BOOKING_STATUSES);
  const cancellableStatuses = new Set(CANCELLABLE_BOOKING_STATUSES);
  const normalizedAmounts = normalizeBookingAmounts(booking, booking.event.slotPrice ?? null);
  const cancellationAllowedUntil = booking.cancellationAllowedUntil ?? booking.event.startsAt;
  const refundStatus = getRefundStatusForBooking(booking.paymentStatus, booking.refundStatus);

  return {
    id: booking.id,
    userId: booking.userId,
    eventId: booking.eventId,
    restaurantId: booking.restaurantId,
    slotPrice: normalizedAmounts.slotPrice,
    quantity: booking.quantity,
    subtotalAmount: normalizedAmounts.subtotalAmount,
    taxAmount: normalizedAmounts.taxAmount,
    platformFee: normalizedAmounts.platformFee,
    discountAmount: normalizedAmounts.discountAmount,
    totalAmount: normalizedAmounts.totalAmount,
    bookingCode: booking.bookingCode,
    bookingStatus: booking.status,
    status: booking.status,
    bookedAt: booking.bookedAt,
    cancelledAt: booking.cancelledAt,
    paymentStatus: booking.paymentStatus,
    paymentMethod: booking.paymentMethod,
    paymentMethodId: booking.paymentMethodId,
    refundAmount: normalizedAmounts.refundAmount,
    refundStatus,
    refundReason: booking.refundReason,
    cancellationAllowedUntil,
    refundPolicyNote:
      "Full refund is available until the event starts. Refunds are returned to the original payment method.",
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    canCancel:
      cancellableStatuses.has(
        booking.status as (typeof CANCELLABLE_BOOKING_STATUSES)[number],
      ) && cancellationAllowedUntil.getTime() > Date.now(),
    isUpcoming:
      reservedStatuses.has(
        booking.status as (typeof SLOT_RESERVED_BOOKING_STATUSES)[number],
      ) &&
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
  const upcomingStatuses = new Set<string>([
    EventBookingStatus.PENDING,
    EventBookingStatus.CONFIRMED,
    EventBookingStatus.ATTENDED,
  ]);
  const leftUpcoming =
    upcomingStatuses.has(left.status) && left.event.endsAt.getTime() >= Date.now();
  const rightUpcoming =
    upcomingStatuses.has(right.status) && right.event.endsAt.getTime() >= Date.now();

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

const buildEventTemplatePayload = (
  input: {
    title: string;
    description: string;
    imageUrl?: string | null;
    suggestedDurationMinutes?: number | null;
    suggestedBookingWindowHours?: number | null;
    suggestedSlotPrice?: number | null;
    suggestedMaxSlots?: number | null;
    suggestedMaxTicketsPerUser?: number | null;
    suggestedOfferLabel?: string | null;
    setupChecklist?: string[];
    requiredItems?: string[];
    status: string;
    createdByAdminId: number;
  },
) => ({
  title: input.title,
  description: input.description,
  imageUrl: input.imageUrl ?? null,
  suggestedDurationMinutes: input.suggestedDurationMinutes ?? null,
  suggestedBookingWindowHours: input.suggestedBookingWindowHours ?? null,
  suggestedSlotPrice:
    input.suggestedSlotPrice != null ? roundCurrency(input.suggestedSlotPrice) : null,
  suggestedMaxSlots: input.suggestedMaxSlots ?? null,
  suggestedMaxTicketsPerUser: input.suggestedMaxTicketsPerUser ?? null,
  suggestedOfferLabel: input.suggestedOfferLabel ?? null,
  setupChecklist: input.setupChecklist ?? [],
  requiredItems: input.requiredItems ?? [],
  status: input.status,
  createdByAdminId: input.createdByAdminId,
});

const mapEventTemplate = (template: EventTemplateRecord) => ({
  ...template,
  imageUrl: template.imageUrl ?? null,
  suggestedDurationMinutes: template.suggestedDurationMinutes ?? null,
  suggestedBookingWindowHours: template.suggestedBookingWindowHours ?? null,
  suggestedSlotPrice:
    template.suggestedSlotPrice != null ? roundCurrency(template.suggestedSlotPrice) : null,
  suggestedMaxSlots: template.suggestedMaxSlots ?? null,
  suggestedMaxTicketsPerUser: template.suggestedMaxTicketsPerUser ?? null,
  suggestedOfferLabel: template.suggestedOfferLabel ?? null,
  setupChecklist: template.setupChecklist ?? [],
  requiredItems: template.requiredItems ?? [],
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

  async listTemplatesAdmin() {
    const templates = await prisma.eventTemplate.findMany({
      select: eventTemplateSelect,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    return templates.map(mapEventTemplate);
  },

  async listTemplatesForOwner() {
    const templates = await prisma.eventTemplate.findMany({
      where: {
        status: EventStatus.ACTIVE,
      },
      select: eventTemplateSelect,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    return templates.map(mapEventTemplate);
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
    const { bookedSlotsByEventId: currentBookedSlotsByEventId } = await getEventBookingMetrics([eventId]);
    const actualBookedSlots = currentBookedSlotsByEventId.get(eventId) ?? existingEvent.bookedSlots;
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

    if (nextTotalSlots != null && nextTotalSlots < actualBookedSlots) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Total slots cannot be set below the slots that are already booked.",
        "EVENT_SLOT_COUNT_TOO_LOW",
      );
    }

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(existingEvent.bookedSlots !== actualBookedSlots ? { bookedSlots: actualBookedSlots } : {}),
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

  async createTemplate(
    adminId: number,
    input: {
      title: string;
      description: string;
      imageUrl?: string | null;
      suggestedDurationMinutes?: number | null;
      suggestedBookingWindowHours?: number | null;
      suggestedSlotPrice?: number | null;
      suggestedMaxSlots?: number | null;
      suggestedMaxTicketsPerUser?: number | null;
      suggestedOfferLabel?: string | null;
      setupChecklist?: string[];
      requiredItems?: string[];
      status: string;
    },
  ) {
    const template = await prisma.eventTemplate.create({
      data: buildEventTemplatePayload({
        ...input,
        createdByAdminId: adminId,
      }),
      select: eventTemplateSelect,
    });

    return mapEventTemplate(template);
  },

  async updateTemplate(
    templateId: number,
    input: Partial<{
      title: string;
      description: string;
      imageUrl: string | null;
      suggestedDurationMinutes: number | null;
      suggestedBookingWindowHours: number | null;
      suggestedSlotPrice: number | null;
      suggestedMaxSlots: number | null;
      suggestedMaxTicketsPerUser: number | null;
      suggestedOfferLabel: string | null;
      setupChecklist: string[];
      requiredItems: string[];
      status: string;
    }>,
  ) {
    await getEventTemplateById(templateId);

    const template = await prisma.eventTemplate.update({
      where: { id: templateId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl ?? null } : {}),
        ...(input.suggestedDurationMinutes !== undefined
          ? { suggestedDurationMinutes: input.suggestedDurationMinutes ?? null }
          : {}),
        ...(input.suggestedBookingWindowHours !== undefined
          ? { suggestedBookingWindowHours: input.suggestedBookingWindowHours ?? null }
          : {}),
        ...(input.suggestedSlotPrice !== undefined
          ? {
              suggestedSlotPrice:
                input.suggestedSlotPrice != null ? roundCurrency(input.suggestedSlotPrice) : null,
            }
          : {}),
        ...(input.suggestedMaxSlots !== undefined
          ? { suggestedMaxSlots: input.suggestedMaxSlots ?? null }
          : {}),
        ...(input.suggestedMaxTicketsPerUser !== undefined
          ? { suggestedMaxTicketsPerUser: input.suggestedMaxTicketsPerUser ?? null }
          : {}),
        ...(input.suggestedOfferLabel !== undefined
          ? { suggestedOfferLabel: input.suggestedOfferLabel ?? null }
          : {}),
        ...(input.setupChecklist !== undefined ? { setupChecklist: input.setupChecklist } : {}),
        ...(input.requiredItems !== undefined ? { requiredItems: input.requiredItems } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: eventTemplateSelect,
    });

    return mapEventTemplate(template);
  },

  async removeTemplate(templateId: number) {
    await getEventTemplateById(templateId);

    await prisma.eventTemplate.delete({
      where: { id: templateId },
    });
  },

  async createForOwnerFromTemplate(
    userId: number,
    input: {
      restaurantId: number;
      templateId?: number;
      title?: string;
      description?: string;
      imageUrl?: string | null;
      startsAt: Date;
      endsAt?: Date;
      bookingStartTime?: Date | null;
      bookingEndTime?: Date | null;
      discountLabel?: string | null;
      totalSlots?: number | null;
      maxAttendees?: number | null;
      slotPrice?: number | null;
      maxTicketsPerUser?: number | null;
      status?: string;
    },
  ) {
    await assertOwnerCanManageRestaurant(userId, input.restaurantId);

    const template =
      typeof input.templateId === "number"
        ? await getEventTemplateById(input.templateId, { activeOnly: true })
        : null;

    const resolvedEndsAt =
      input.endsAt ??
      (template?.suggestedDurationMinutes != null
        ? new Date(input.startsAt.getTime() + template.suggestedDurationMinutes * 60_000)
        : null);

    if (!resolvedEndsAt) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Add the event end time before saving.",
        "EVENT_END_TIME_REQUIRED",
      );
    }

    const resolvedBookingStartTime =
      input.bookingStartTime !== undefined
        ? input.bookingStartTime
        : template?.suggestedBookingWindowHours != null
          ? new Date(input.startsAt.getTime() - template.suggestedBookingWindowHours * 60 * 60 * 1000)
          : null;
    const resolvedBookingEndTime =
      input.bookingEndTime !== undefined
        ? input.bookingEndTime
        : template?.suggestedBookingWindowHours != null
          ? input.startsAt
          : null;

    const resolvedTitle = input.title?.trim() || template?.title;
    const resolvedDescription = input.description?.trim() || template?.description;

    if (!resolvedTitle || !resolvedDescription) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Event title and description are required.",
        "EVENT_TEMPLATE_FIELDS_REQUIRED",
      );
    }

    return this.create({
      restaurantId: input.restaurantId,
      regionId: null,
      title: resolvedTitle,
      description: resolvedDescription,
      imageUrl: input.imageUrl !== undefined ? input.imageUrl ?? null : template?.imageUrl ?? null,
      startsAt: input.startsAt,
      endsAt: resolvedEndsAt,
      bookingStartTime: resolvedBookingStartTime ?? null,
      bookingEndTime: resolvedBookingEndTime ?? null,
      discountLabel:
        input.discountLabel !== undefined
          ? input.discountLabel ?? null
          : template?.suggestedOfferLabel ?? null,
      totalSlots:
        input.totalSlots !== undefined
          ? input.totalSlots
          : input.maxAttendees !== undefined
            ? input.maxAttendees
            : template?.suggestedMaxSlots ?? null,
      slotPrice:
        input.slotPrice !== undefined ? input.slotPrice : template?.suggestedSlotPrice ?? null,
      maxTicketsPerUser:
        input.maxTicketsPerUser !== undefined
          ? input.maxTicketsPerUser
          : template?.suggestedMaxTicketsPerUser ?? null,
      status: input.status ?? EventStatus.ACTIVE,
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
    const initialAvailability = getEventAvailability(event, event.bookedSlots);

    logger.info(
      "Event booking requested",
      buildEventBookingLogContext({
        eventId,
        userId,
        requestedQuantity: input.quantity,
        totalSlots: initialAvailability.totalSlots,
        bookedSlots: initialAvailability.bookedSlots,
        remainingSlots: initialAvailability.remainingSlots,
      }),
    );

    let slotsReserved = false;
    let bookingId: number | null = null;
    const paymentPricing = getBookingPricing(event, input.quantity);
    const result = await (async () => {
      try {
        validateEventBookingWindow(event, event.bookedSlots);

        const existingBooking = await prisma.eventBooking.findUnique({
          where: {
            userId_eventId: {
              userId,
              eventId,
            },
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (
          existingBooking &&
          !REBOOKABLE_BOOKING_STATUSES.includes(
            existingBooking.status as (typeof REBOOKABLE_BOOKING_STATUSES)[number],
          )
        ) {
          throw new AppError(StatusCodes.CONFLICT, "Already booked.", "EVENT_ALREADY_BOOKED");
        }

        validateEventSlotAvailability(event, input.quantity, event.bookedSlots);

        const paymentDetails = await validateSavedPaymentMethod(prisma, {
          userId,
          slotPrice: event.slotPrice ?? 0,
          paymentMethod: input.paymentMethod,
          paymentMethodId: input.paymentMethodId,
          savedPaymentMethodId: input.savedPaymentMethodId,
        });

        if (event.totalSlots != null) {
          const updatedEventCounter = await prisma.event.updateMany({
            where: {
              id: eventId,
              bookedSlots: {
                lte: event.totalSlots - input.quantity,
              },
            },
            data: {
              bookedSlots: {
                increment: input.quantity,
              },
            },
          });

          if (!updatedEventCounter.count) {
            const latestEvent = await getEventById(eventId);
            validateEventBookingWindow(latestEvent, latestEvent.bookedSlots);
            validateEventSlotAvailability(latestEvent, input.quantity, latestEvent.bookedSlots);

            throw new AppError(StatusCodes.CONFLICT, "Event sold out.", "EVENT_SOLD_OUT");
          }

          slotsReserved = true;
        }

        const bookedAt = new Date();
        bookingId = existingBooking?.id ?? (await reserveSequentialId("EventBooking"));
        const bookingCode = buildBookingCode(bookingId, bookedAt);
        const bookingWriteData = {
          restaurantId: input.restaurantId,
          slotPrice: paymentPricing.slotPrice,
          quantity: input.quantity,
          subtotalAmount: paymentPricing.subtotalAmount,
          taxAmount: paymentPricing.taxAmount,
          platformFee: paymentPricing.platformFee,
          discountAmount: paymentPricing.discountAmount,
          totalAmount: paymentPricing.totalAmount,
          bookingCode,
          status:
            paymentDetails.paymentStatus === PaymentStatus.FREE
              ? EventBookingStatus.CONFIRMED
              : EventBookingStatus.PENDING,
          bookedAt,
          cancelledAt: null,
          paymentStatus: paymentDetails.paymentStatus,
          paymentMethod: paymentDetails.paymentMethod,
          paymentMethodId: paymentDetails.paymentMethodId,
          refundAmount: 0,
          refundStatus: RefundStatus.NOT_REQUESTED,
          refundReason: null,
          cancellationAllowedUntil: paymentPricing.cancellationAllowedUntil,
        };

        const booking =
          existingBooking?.id != null
            ? await (async () => {
                const updatedBooking = await prisma.eventBooking.updateMany({
                  where: {
                    id: existingBooking.id,
                    status: {
                      in: [...REBOOKABLE_BOOKING_STATUSES],
                    },
                  },
                  data: bookingWriteData,
                });

                if (!updatedBooking.count) {
                  throw new AppError(StatusCodes.CONFLICT, "Already booked.", "EVENT_ALREADY_BOOKED");
                }

                return prisma.eventBooking.findUnique({
                  where: { id: existingBooking.id },
                  select: bookingSelect,
                });
              })()
            : await prisma.eventBooking.create({
                data: {
                  id: bookingId,
                  userId,
                  eventId,
                  ...bookingWriteData,
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

        const nextBookedSlots =
          event.bookedSlots + input.quantity;

        logger.info(
          "Event booking saved",
          buildEventBookingLogContext({
            eventId,
            userId,
            requestedQuantity: input.quantity,
            totalSlots: event.totalSlots,
            bookedSlots: nextBookedSlots,
            remainingSlots:
              event.totalSlots != null ? Math.max(event.totalSlots - nextBookedSlots, 0) : null,
          }),
        );

        return {
          booking,
          bookedSlots: nextBookedSlots,
          requiresPayment: paymentDetails.paymentStatus === PaymentStatus.PENDING,
        };
      } catch (error) {
        if (slotsReserved) {
          await rollbackBookedSlotsIncrement(eventId, input.quantity, userId);
        }

        const mappedError = mapEventBookingWriteError(error);
        const logLevel =
          mappedError instanceof AppError && mappedError.statusCode < StatusCodes.INTERNAL_SERVER_ERROR
            ? "warn"
            : "error";

        logger[logLevel](
          "Event booking failed",
          buildEventBookingLogContext(
            {
              bookingId,
              eventId,
              userId,
              requestedQuantity: input.quantity,
              totalSlots: event.totalSlots,
              bookedSlots:
                slotsReserved && event.totalSlots != null
                  ? event.bookedSlots + input.quantity
                  : event.bookedSlots,
              remainingSlots:
                event.totalSlots != null
                  ? Math.max(
                      event.totalSlots -
                        (slotsReserved && event.totalSlots != null
                          ? event.bookedSlots + input.quantity
                          : event.bookedSlots),
                      0,
                    )
                  : null,
            },
            error,
          ),
        );

        throw mappedError;
      }
    })();

    if (!result.requiresPayment) {
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
    }

    const {
      bookedSlotsByEventId,
      confirmedBookingCountByEventId,
      revenueByEventId,
      taxByEventId,
      refundedAmountByEventId,
    } =
      await getEventBookingMetrics([eventId], userId);
    const bookedSlots = bookedSlotsByEventId.get(eventId) ?? result.bookedSlots;
    const confirmedBookingCount = confirmedBookingCountByEventId.get(eventId) ?? 0;
    const revenue = revenueByEventId.get(eventId) ?? 0;
    void taxByEventId;
    void refundedAmountByEventId;

    return {
      booking: mapEventBooking(result.booking, {
        bookedSlots,
        confirmedBookingCount,
        revenue,
      }),
      event: mapEvent(event, {
        bookedSlots,
        confirmedBookingCount,
        revenue,
        currentUserBooking: mapBookingSummary(result.booking),
      }),
      requiresPayment: result.requiresPayment,
    };
  },

  async pay(
    userId: number,
    bookingId: number,
    input: {
      paymentMethod?: string;
      paymentMethodId?: number;
      savedPaymentMethodId?: number;
    },
  ) {
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

    if (booking.paymentStatus === PaymentStatus.FREE) {
      return {
        booking: mapEventBooking(booking, {
          bookedSlots: booking.event.bookedSlots,
          confirmedBookingCount: booking.status === EventBookingStatus.CONFIRMED ? 1 : 0,
          revenue: 0,
        }),
        event: mapEvent(booking.event, {
          bookedSlots: booking.event.bookedSlots,
          confirmedBookingCount: booking.status === EventBookingStatus.CONFIRMED ? 1 : 0,
          revenue: 0,
          currentUserBooking: mapBookingSummary(booking),
        }),
      };
    }

    if (booking.status === EventBookingStatus.CONFIRMED && booking.paymentStatus === PaymentStatus.PAID) {
      const { bookedSlotsByEventId, confirmedBookingCountByEventId, revenueByEventId } =
        await getEventBookingMetrics([booking.eventId], userId);

      return {
        booking: mapEventBooking(booking, {
          bookedSlots: bookedSlotsByEventId.get(booking.eventId) ?? booking.event.bookedSlots,
          confirmedBookingCount: confirmedBookingCountByEventId.get(booking.eventId) ?? 0,
          revenue: revenueByEventId.get(booking.eventId) ?? 0,
        }),
        event: mapEvent(booking.event, {
          bookedSlots: bookedSlotsByEventId.get(booking.eventId) ?? booking.event.bookedSlots,
          confirmedBookingCount: confirmedBookingCountByEventId.get(booking.eventId) ?? 0,
          revenue: revenueByEventId.get(booking.eventId) ?? 0,
          currentUserBooking: mapBookingSummary(booking),
        }),
      };
    }

    if (booking.status !== EventBookingStatus.PENDING || booking.paymentStatus !== PaymentStatus.PENDING) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "This booking is not waiting for payment anymore.",
        "EVENT_BOOKING_PAYMENT_NOT_PENDING",
      );
    }

    validateEventBookingWindow(booking.event, booking.event.bookedSlots);

    logger.info(
      "Event booking payment requested",
      buildEventBookingLogContext({
        bookingId,
        eventId: booking.eventId,
        userId,
        requestedQuantity: booking.quantity,
        totalSlots: booking.event.totalSlots,
        bookedSlots: booking.event.bookedSlots,
        remainingSlots:
          booking.event.totalSlots != null
            ? Math.max(booking.event.totalSlots - booking.event.bookedSlots, 0)
            : null,
      }),
    );

    let paymentCaptured = false;

    try {
      const paymentDetails = await validateSavedPaymentMethod(prisma, {
        userId,
        slotPrice: booking.slotPrice ?? booking.event.slotPrice ?? 0,
        paymentMethod: input.paymentMethod ?? booking.paymentMethod ?? undefined,
        paymentMethodId: input.paymentMethodId ?? booking.paymentMethodId ?? undefined,
        savedPaymentMethodId: input.savedPaymentMethodId,
      });

      const confirmedBookingCount = await prisma.eventBooking.updateMany({
        where: {
          id: bookingId,
          userId,
          status: EventBookingStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
        },
        data: {
          status: EventBookingStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: paymentDetails.paymentMethod,
          paymentMethodId: paymentDetails.paymentMethodId,
          refundStatus: RefundStatus.NOT_REQUESTED,
          refundReason: null,
        },
      });

      if (!confirmedBookingCount.count) {
        const latestBooking = await prisma.eventBooking.findFirst({
          where: {
            id: bookingId,
            userId,
          },
          select: bookingSelect,
        });

        if (latestBooking?.status === EventBookingStatus.CONFIRMED && latestBooking.paymentStatus === PaymentStatus.PAID) {
          const { bookedSlotsByEventId, confirmedBookingCountByEventId, revenueByEventId } =
            await getEventBookingMetrics([latestBooking.eventId], userId);

          return {
            booking: mapEventBooking(latestBooking, {
              bookedSlots: bookedSlotsByEventId.get(latestBooking.eventId) ?? latestBooking.event.bookedSlots,
              confirmedBookingCount: confirmedBookingCountByEventId.get(latestBooking.eventId) ?? 0,
              revenue: revenueByEventId.get(latestBooking.eventId) ?? 0,
            }),
            event: mapEvent(latestBooking.event, {
              bookedSlots: bookedSlotsByEventId.get(latestBooking.eventId) ?? latestBooking.event.bookedSlots,
              confirmedBookingCount: confirmedBookingCountByEventId.get(latestBooking.eventId) ?? 0,
              revenue: revenueByEventId.get(latestBooking.eventId) ?? 0,
              currentUserBooking: mapBookingSummary(latestBooking),
            }),
          };
        }

        throw new AppError(
          StatusCodes.CONFLICT,
          "This booking payment could not be completed safely right now.",
          "EVENT_BOOKING_PAYMENT_CONFLICT",
        );
      }

      paymentCaptured = true;

      const confirmedBooking = await prisma.eventBooking.findFirst({
        where: {
          id: bookingId,
          userId,
        },
        select: bookingSelect,
      });

      if (!confirmedBooking) {
        throw new AppError(
          StatusCodes.NOT_FOUND,
          "Event booking not found.",
          "EVENT_BOOKING_NOT_FOUND",
        );
      }

      await notificationsService.createForUser({
        userId,
        title: "Event booking confirmed",
        message: `Payment received for ${confirmedBooking.event.title}. Booking code ${confirmedBooking.bookingCode}.`,
        meta: {
          eventId: confirmedBooking.eventId,
          restaurantId: confirmedBooking.restaurantId,
          bookingId: confirmedBooking.id,
          bookingCode: confirmedBooking.bookingCode,
          path: "/my-events",
          eventKey: `event:booking:${confirmedBooking.id}:paid`,
        },
        dedupeWindowMinutes: 1,
      });

      const { bookedSlotsByEventId, confirmedBookingCountByEventId, revenueByEventId } =
        await getEventBookingMetrics([confirmedBooking.eventId], userId);

      return {
        booking: mapEventBooking(confirmedBooking, {
          bookedSlots: bookedSlotsByEventId.get(confirmedBooking.eventId) ?? confirmedBooking.event.bookedSlots,
          confirmedBookingCount: confirmedBookingCountByEventId.get(confirmedBooking.eventId) ?? 0,
          revenue: revenueByEventId.get(confirmedBooking.eventId) ?? 0,
        }),
        event: mapEvent(confirmedBooking.event, {
          bookedSlots: bookedSlotsByEventId.get(confirmedBooking.eventId) ?? confirmedBooking.event.bookedSlots,
          confirmedBookingCount: confirmedBookingCountByEventId.get(confirmedBooking.eventId) ?? 0,
          revenue: revenueByEventId.get(confirmedBooking.eventId) ?? 0,
          currentUserBooking: mapBookingSummary(confirmedBooking),
        }),
      };
    } catch (error) {
      if (!paymentCaptured) {
        const latestBooking = await prisma.eventBooking.findFirst({
          where: {
            id: bookingId,
            userId,
          },
          select: {
            id: true,
            status: true,
            paymentStatus: true,
          },
        });

        const shouldReleaseSlots =
          latestBooking?.status === EventBookingStatus.PENDING &&
          latestBooking.paymentStatus === PaymentStatus.PENDING;

        if (shouldReleaseSlots && booking.event.totalSlots != null) {
          await releaseReservedSlots(booking.eventId, booking.quantity, userId, bookingId);
        }

        try {
          await prisma.eventBooking.updateMany({
            where: {
              id: bookingId,
              userId,
              status: EventBookingStatus.PENDING,
              paymentStatus: PaymentStatus.PENDING,
            },
            data: {
              status: EventBookingStatus.FAILED,
              paymentStatus: PaymentStatus.FAILED,
              refundAmount: 0,
              refundStatus: RefundStatus.NOT_REQUESTED,
              refundReason: "Payment could not be completed.",
            },
          });
        } catch (bookingFailureError) {
          logger.error(
            "Event booking payment failure update failed",
            buildEventBookingLogContext(
              {
                bookingId,
                eventId: booking.eventId,
                userId,
                requestedQuantity: booking.quantity,
                totalSlots: booking.event.totalSlots,
                bookedSlots: booking.event.bookedSlots,
                remainingSlots:
                  booking.event.totalSlots != null
                    ? Math.max(booking.event.totalSlots - booking.event.bookedSlots, 0)
                    : null,
              },
              bookingFailureError,
            ),
          );
        }
      }

      const mappedError = mapEventBookingWriteError(error);
      const logLevel =
        mappedError instanceof AppError && mappedError.statusCode < StatusCodes.INTERNAL_SERVER_ERROR
          ? "warn"
          : "error";

      logger[logLevel](
        "Event booking payment failed",
        buildEventBookingLogContext(
          {
            bookingId,
            eventId: booking.eventId,
            userId,
            requestedQuantity: booking.quantity,
            totalSlots: booking.event.totalSlots,
            bookedSlots: booking.event.bookedSlots,
            remainingSlots:
              booking.event.totalSlots != null
                ? Math.max(booking.event.totalSlots - booking.event.bookedSlots, 0)
                : null,
          },
          error,
        ),
      );

      throw mappedError;
    }
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

    if (
      !CANCELLABLE_BOOKING_STATUSES.includes(
        booking.status as (typeof CANCELLABLE_BOOKING_STATUSES)[number],
      )
    ) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "This booking cannot be cancelled anymore.",
        "EVENT_CANNOT_BE_CANCELLED",
      );
    }

    const cancellationAllowedUntil = booking.cancellationAllowedUntil ?? booking.event.startsAt;

    if (cancellationAllowedUntil.getTime() <= Date.now()) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Cancellation closed because the event has started.",
        "EVENT_CANNOT_BE_CANCELLED",
      );
    }

    const wasPaid = booking.paymentStatus === PaymentStatus.PAID;
    const wasPendingPayment = booking.paymentStatus === PaymentStatus.PENDING;
    const nextPaymentStatus = wasPaid
      ? PaymentStatus.REFUNDED
      : wasPendingPayment
        ? PaymentStatus.FAILED
        : booking.paymentStatus;
    const refundAmount = wasPaid ? booking.totalAmount : 0;
    const refundStatus = wasPaid ? RefundStatus.REFUNDED : RefundStatus.NOT_REQUESTED;
    const refundReason = wasPaid
      ? "Full refund processed because the booking was cancelled before the event started."
      : booking.paymentStatus === PaymentStatus.FREE
        ? "Free booking cancelled."
        : "Pending payment booking cancelled before payment capture.";

    let slotsReleased = false;

    if (booking.event.totalSlots != null) {
      const updatedEventCounter = await prisma.event.updateMany({
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

      slotsReleased = true;
    }

    const updateResult = await prisma.eventBooking.updateMany({
      where: {
        id: booking.id,
        userId,
        status: {
          in: [...CANCELLABLE_BOOKING_STATUSES],
        },
      },
      data: {
        status: EventBookingStatus.CANCELLED,
        cancelledAt: new Date(),
        paymentStatus: nextPaymentStatus,
        refundAmount,
        refundStatus,
        refundReason,
      },
    });

    if (!updateResult.count) {
      if (slotsReleased && booking.event.totalSlots != null) {
        await restoreReleasedSlots(booking.eventId, booking.quantity, userId, booking.id);
      }

      throw new AppError(
        StatusCodes.CONFLICT,
        "This booking could not be cancelled safely right now.",
        "EVENT_CANCEL_CONFLICT",
      );
    }

    const updatedBooking = await prisma.eventBooking.findFirst({
      where: {
        id: booking.id,
        userId,
      },
      select: bookingSelect,
    });

    if (!updatedBooking) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        "Event booking not found.",
        "EVENT_BOOKING_NOT_FOUND",
      );
    }

    await notificationsService.createForUser({
      userId,
      title: "Event booking cancelled",
      message:
        wasPaid
          ? `Your booking for ${booking.event.title} was cancelled and refunded to the original payment method.`
          : booking.paymentStatus === PaymentStatus.FREE
            ? `Your free booking for ${booking.event.title} was cancelled successfully.`
            : `Your booking for ${booking.event.title} was cancelled before payment capture.`,
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
      booking: mapEventBooking(updatedBooking, {
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
        status: {
          in: [...CANCELLABLE_BOOKING_STATUSES],
        },
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

    const pendingCount = bookings.filter((booking) => booking.status === EventBookingStatus.PENDING).length;
    const confirmedCount = bookings.filter((booking) => booking.status === EventBookingStatus.CONFIRMED).length;
    const attendedCount = bookings.filter((booking) => booking.status === EventBookingStatus.ATTENDED).length;
    const cancelledCount = bookings.filter((booking) => booking.status === EventBookingStatus.CANCELLED).length;
    const failedCount = bookings.filter((booking) => booking.status === EventBookingStatus.FAILED).length;
    const refundedCount = bookings.filter(
      (booking) =>
        booking.paymentStatus === PaymentStatus.REFUNDED ||
        booking.paymentStatus === PaymentStatus.REFUND_PENDING,
    ).length;
    const bookedSlots = bookings.reduce((total, booking) => {
      if (SLOT_RESERVED_BOOKING_STATUSES.includes(booking.status as (typeof SLOT_RESERVED_BOOKING_STATUSES)[number])) {
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
    const totalTax = roundCurrency(
      bookings.reduce((total, booking) => {
        if (
          (booking.status === EventBookingStatus.CONFIRMED ||
            booking.status === EventBookingStatus.ATTENDED) &&
          booking.paymentStatus === PaymentStatus.PAID
        ) {
          return total + (booking.taxAmount ?? 0);
        }

        return total;
      }, 0),
    );
    const refundedAmount = roundCurrency(
      bookings.reduce((total, booking) => {
        if (
          booking.paymentStatus === PaymentStatus.REFUNDED ||
          booking.paymentStatus === PaymentStatus.REFUND_PENDING
        ) {
          return total + (booking.refundAmount ?? 0);
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
      const isActiveBooking = SLOT_RESERVED_BOOKING_STATUSES.includes(
        booking.status as (typeof SLOT_RESERVED_BOOKING_STATUSES)[number],
      );
      const nextRevenue =
        booking.paymentStatus === PaymentStatus.PAID &&
        ACTIVE_BOOKING_STATUSES.includes(booking.status as (typeof ACTIVE_BOOKING_STATUSES)[number])
          ? booking.totalAmount
          : 0;

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
        bookingsCount: bookings.length,
        pendingCount,
        confirmedCount,
        attendedCount,
        cancelledCount,
        failedCount,
        refundedCount,
        bookedSlots,
        totalSlots: availability.totalSlots,
        remainingSlots: availability.remainingSlots,
        isSoldOut: availability.isSoldOut,
        isFullyBooked: availability.isSoldOut,
        isBookingClosed: availability.isBookingClosed,
        revenue,
        totalTax,
        refundedAmount,
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
