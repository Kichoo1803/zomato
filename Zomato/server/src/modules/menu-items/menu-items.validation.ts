import { FoodType } from "../../constants/enums.js";
import { z } from "zod";

const menuItemBodySchema = z.object({
  restaurantId: z.coerce.number().int().positive(),
  categoryId: z.coerce.number().int().positive(),
  name: z.string().trim().min(2).max(191),
  description: z.string().trim().max(600).optional(),
  image: z.string().trim().url().optional(),
  price: z.number().positive(),
  discountPrice: z.number().positive().optional(),
  foodType: z.enum([FoodType.VEG, FoodType.NON_VEG, FoodType.EGG]),
  isAvailable: z.boolean().optional(),
  isRecommended: z.boolean().optional(),
  preparationTime: z.coerce.number().int().positive().optional(),
  calories: z.coerce.number().int().positive().optional(),
  spiceLevel: z.coerce.number().int().min(1).max(5).optional(),
});

export const listMenuItemsQuerySchema = {
  query: z.object({
    search: z.string().trim().optional(),
    restaurantId: z.coerce.number().int().positive().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    isAvailable: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  }),
};

export const createMenuItemSchema = {
  body: menuItemBodySchema,
};

export const updateMenuItemSchema = {
  params: z.object({
    itemId: z.coerce.number().int().positive(),
  }),
  body: menuItemBodySchema.omit({ restaurantId: true, categoryId: true }).extend({
    categoryId: z.coerce.number().int().positive().optional(),
  }).partial(),
};

export const restaurantIdParamSchema = {
  params: z.object({
    restaurantId: z.coerce.number().int().positive(),
  }),
};
