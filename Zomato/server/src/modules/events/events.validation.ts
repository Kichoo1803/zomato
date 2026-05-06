import { EventStatus } from "../../constants/enums.js";
import { z } from "zod";

const eventStatusValues = [EventStatus.ACTIVE, EventStatus.INACTIVE, EventStatus.EXPIRED] as const;

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

const eventBodyBaseSchema = z.object({
  ...eventTargetFields,
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(500),
  imageUrl: z.union([z.string().trim().url(), z.null()]).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  discountLabel: z.union([z.string().trim().max(120), z.null()]).optional(),
  maxAttendees: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  status: z.enum(eventStatusValues).default(EventStatus.ACTIVE),
});

const createEventBodySchema = eventBodyBaseSchema.superRefine((value, ctx) => {
  validateEventTarget(value, ctx);

  if (value.endsAt <= value.startsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endsAt"],
      message: "End time must be after the start time.",
    });
  }
});

const updateEventBodySchema = eventBodyBaseSchema
  .partial()
  .superRefine((value, ctx) => {
    validateEventTarget(value, ctx);

    if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "End time must be after the start time.",
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

export const joinEventSchema = {
  params: z.object({
    eventId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    restaurantId: z.coerce.number().int().positive(),
  }),
};

export const cancelEventSchema = eventIdParamSchema;
