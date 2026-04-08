import { z } from "zod";

export const restaurantIdParamSchema = {
  params: z.object({
    restaurantId: z.coerce.number().int().positive(),
  }),
};

const menuCategoryBodySchema = z.object({
  restaurantId: z.coerce.number().int().positive(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(255).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const createMenuCategorySchema = {
  body: menuCategoryBodySchema,
};

export const updateMenuCategorySchema = {
  params: z.object({
    categoryId: z.coerce.number().int().positive(),
  }),
  body: menuCategoryBodySchema.omit({ restaurantId: true }).partial(),
};
