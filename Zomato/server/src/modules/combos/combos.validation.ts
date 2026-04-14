import { z } from "zod";

const comboItemSchema = z.object({
  menuItemId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().default(1),
});

const comboBodyBaseSchema = z.object({
  restaurantId: z.coerce.number().int().positive(),
  name: z.string().trim().min(2).max(191),
  description: z.string().trim().max(800).optional(),
  image: z.string().trim().url().optional(),
  basePrice: z.coerce.number().min(0),
  offerPrice: z.coerce.number().min(0).optional(),
  categoryTag: z.string().trim().max(120).optional(),
  isAvailable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  items: z.array(comboItemSchema).min(1),
});

const createComboBodySchema = comboBodyBaseSchema.superRefine((value, ctx) => {
  if (value.offerPrice !== undefined && value.offerPrice > value.basePrice) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["offerPrice"],
      message: "Offer price cannot exceed base price.",
    });
  }
});

const updateComboBodySchema = comboBodyBaseSchema
  .partial()
  .superRefine((value, ctx) => {
    if (
      value.offerPrice !== undefined &&
      value.basePrice !== undefined &&
      value.offerPrice > value.basePrice
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["offerPrice"],
        message: "Offer price cannot exceed base price.",
      });
    }
  });

export const listCombosQuerySchema = {
  query: z.object({
    search: z.string().trim().optional(),
    restaurantId: z.coerce.number().int().positive().optional(),
    isActive: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  }),
};

export const comboIdParamSchema = {
  params: z.object({
    comboId: z.coerce.number().int().positive(),
  }),
};

export const restaurantIdParamSchema = {
  params: z.object({
    restaurantId: z.coerce.number().int().positive(),
  }),
};

export const createComboSchema = {
  body: createComboBodySchema,
};

export const updateComboSchema = {
  params: z.object({
    comboId: z.coerce.number().int().positive(),
  }),
  body: updateComboBodySchema,
};
