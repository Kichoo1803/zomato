import { EventStatus, PaymentMethod } from "../../constants/enums.js";
import { z } from "zod";

const eventStatusValues = [EventStatus.ACTIVE, EventStatus.INACTIVE, EventStatus.EXPIRED] as const;
const eventTemplateStatusValues = [EventStatus.ACTIVE, EventStatus.INACTIVE] as const;
const eventPaymentMethodValues = [PaymentMethod.CARD, PaymentMethod.UPI] as const;
const stringListSchema = z.array(z.string().trim().min(1).max(240)).default([]);

const eventTargetFields = {
  restaurantId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  regionId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
};

const validateEventTarget = (
  value: {
    restaurantId?: number | null;
    regionId?: number | null;
  },
  ctx: z.RefinementCtx,
) => {
  const hasRestaurantId = typeof value.restaurantId === "number";
  const hasRegionId = typeof value.regionId === "number";

  if (hasRestaurantId && hasRegionId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["restaurantId"],
      message: "Assign the event to a restaurant, a region, or all restaurants.",
    });
  }
};

const getResolvedTotalSlots = (value: {
  totalSlots?: number | null;
  maxAttendees?: number | null;
}) => value.totalSlots ?? value.maxAttendees ?? null;

const validateEventSchedule = (
  value: {
    startsAt?: Date;
    endsAt?: Date;
    bookingStartTime?: Date | null;
    bookingEndTime?: Date | null;
    totalSlots?: number | null;
    maxAttendees?: number | null;
    maxTicketsPerUser?: number | null;
  },
  ctx: z.RefinementCtx,
) => {
  if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endsAt"],
      message: "End time must be after the start time.",
    });
  }

  if (
    value.bookingStartTime &&
    value.bookingEndTime &&
    value.bookingEndTime <= value.bookingStartTime
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bookingEndTime"],
      message: "Booking end time must be after the booking start time.",
    });
  }

  if (value.bookingStartTime && value.endsAt && value.bookingStartTime >= value.endsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bookingStartTime"],
      message: "Booking must open before the event ends.",
    });
  }

  if (value.bookingEndTime && value.endsAt && value.bookingEndTime > value.endsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bookingEndTime"],
      message: "Booking cannot remain open after the event ends.",
    });
  }

  const totalSlots = getResolvedTotalSlots(value);

  if (
    totalSlots != null &&
    value.maxTicketsPerUser != null &&
    value.maxTicketsPerUser > totalSlots
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxTicketsPerUser"],
      message: "Per-user ticket limit cannot exceed the total slot count.",
    });
  }
};

const eventBodyBaseSchema = z.object({
  ...eventTargetFields,
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(500),
  imageUrl: z.union([z.string().trim().url(), z.null()]).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  bookingStartTime: z.union([z.coerce.date(), z.null()]).optional(),
  bookingEndTime: z.union([z.coerce.date(), z.null()]).optional(),
  discountLabel: z.union([z.string().trim().max(120), z.null()]).optional(),
  totalSlots: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  maxAttendees: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  slotPrice: z.union([z.coerce.number().min(0), z.null()]).optional(),
  maxTicketsPerUser: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  status: z.enum(eventStatusValues).default(EventStatus.ACTIVE),
});

const createEventBodySchema = eventBodyBaseSchema.superRefine((value, ctx) => {
  validateEventTarget(value, ctx);
  validateEventSchedule(value, ctx);
});

const updateEventBodySchema = eventBodyBaseSchema.partial().superRefine((value, ctx) => {
  validateEventTarget(value, ctx);
  validateEventSchedule(value, ctx);
});

const validateEventTemplateSuggestions = (
  value: {
    suggestedMaxSlots?: number | null;
    suggestedMaxTicketsPerUser?: number | null;
  },
  ctx: z.RefinementCtx,
) => {
    if (
      value.suggestedMaxSlots != null &&
      value.suggestedMaxTicketsPerUser != null &&
      value.suggestedMaxTicketsPerUser > value.suggestedMaxSlots
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suggestedMaxTicketsPerUser"],
        message: "Suggested per-user limit cannot exceed the suggested slot count.",
      });
    }
  };

const eventTemplateBodyBaseSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(1200),
  imageUrl: z.union([z.string().trim().url(), z.null()]).optional(),
  suggestedDurationMinutes: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  suggestedBookingWindowHours: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  suggestedSlotPrice: z.union([z.coerce.number().min(0), z.null()]).optional(),
  suggestedMaxSlots: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  suggestedMaxTicketsPerUser: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  suggestedOfferLabel: z.union([z.string().trim().max(120), z.null()]).optional(),
  setupChecklist: stringListSchema,
  requiredItems: stringListSchema,
  status: z.enum(eventTemplateStatusValues).default(EventStatus.ACTIVE),
});

const createEventTemplateBodySchema = eventTemplateBodyBaseSchema.superRefine((value, ctx) => {
  validateEventTemplateSuggestions(value, ctx);
});

const updateEventTemplateBodySchema = eventTemplateBodyBaseSchema.partial().superRefine((value, ctx) => {
  validateEventTemplateSuggestions(value, ctx);
});

const ownerEventFromTemplateBodySchema = z
  .object({
    restaurantId: z.coerce.number().int().positive(),
    templateId: z.coerce.number().int().positive().optional(),
    title: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().min(2).max(500).optional(),
    imageUrl: z.union([z.string().trim().url(), z.null()]).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional(),
    bookingStartTime: z.union([z.coerce.date(), z.null()]).optional(),
    bookingEndTime: z.union([z.coerce.date(), z.null()]).optional(),
    discountLabel: z.union([z.string().trim().max(120), z.null()]).optional(),
    totalSlots: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
    maxAttendees: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
    slotPrice: z.union([z.coerce.number().min(0), z.null()]).optional(),
    maxTicketsPerUser: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
    status: z.enum(eventTemplateStatusValues).default(EventStatus.ACTIVE),
  })
  .superRefine((value, ctx) => {
    if (!value.templateId && !value.title) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["title"],
        message: "Title is required when no template is selected.",
      });
    }

    if (!value.templateId && !value.description) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: "Description is required when no template is selected.",
      });
    }

    if (value.endsAt) {
      validateEventSchedule(value, ctx);
    } else if (!value.templateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "End time is required when no template duration is available.",
      });
    }
  });

export const listEventsSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    restaurantId: z.coerce.number().int().positive().optional(),
    regionId: z.coerce.number().int().positive().optional(),
    status: z.enum(eventStatusValues).optional(),
  }),
};

export const restaurantEventsParamSchema = {
  params: z.object({
    restaurantId: z.coerce.number().int().positive(),
  }),
};

export const createEventSchema = {
  body: createEventBodySchema,
};

export const updateEventSchema = {
  params: z.object({
    eventId: z.coerce.number().int().positive(),
  }),
  body: updateEventBodySchema,
};

export const eventIdParamSchema = {
  params: z.object({
    eventId: z.coerce.number().int().positive(),
  }),
};

export const eventTemplateIdParamSchema = {
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
};

export const bookEventSchema = {
  params: z.object({
    eventId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    restaurantId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().positive().default(1),
    paymentMethod: z.enum(eventPaymentMethodValues).optional(),
    paymentMethodId: z.coerce.number().int().positive().optional(),
    savedPaymentMethodId: z.coerce.number().int().positive().optional(),
  }),
};

export const joinEventSchema = {
  params: z.object({
    eventId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    restaurantId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().positive().optional(),
    paymentMethod: z.enum(eventPaymentMethodValues).optional(),
    paymentMethodId: z.coerce.number().int().positive().optional(),
    savedPaymentMethodId: z.coerce.number().int().positive().optional(),
  }),
};

export const cancelEventSchema = eventIdParamSchema;

export const cancelBookingSchema = {
  params: z.object({
    bookingId: z.coerce.number().int().positive(),
  }),
};

export const payEventBookingSchema = {
  params: z.object({
    bookingId: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      paymentMethod: z.enum(eventPaymentMethodValues).optional(),
      paymentMethodId: z.coerce.number().int().positive().optional(),
      savedPaymentMethodId: z.coerce.number().int().positive().optional(),
    })
    .default({}),
};

export const createEventTemplateSchema = {
  body: createEventTemplateBodySchema,
};

export const updateEventTemplateSchema = {
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: updateEventTemplateBodySchema,
};

export const createOwnerEventFromTemplateSchema = {
  body: ownerEventFromTemplateBodySchema,
};

export const markBookingAttendedSchema = {
  params: z.object({
    eventId: z.coerce.number().int().positive(),
    bookingId: z.coerce.number().int().positive(),
  }),
};

export const ownerBookingIdParamSchema = {
  params: z.object({
    bookingId: z.coerce.number().int().positive(),
  }),
};
