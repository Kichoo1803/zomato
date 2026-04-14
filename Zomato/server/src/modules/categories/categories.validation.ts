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

const lookupBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(255).optional(),
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

export const createCuisineSchema = {
  body: lookupBodySchema.pick({ name: true }),
};

export const updateCuisineSchema = {
  params: z.object({
    cuisineId: z.coerce.number().int().positive(),
  }),
  body: lookupBodySchema.pick({ name: true }).partial(),
};

export const cuisineIdParamSchema = {
  params: z.object({
    cuisineId: z.coerce.number().int().positive(),
  }),
};

export const createRestaurantCategorySchema = {
  body: lookupBodySchema,
};

export const updateRestaurantCategorySchema = {
  params: z.object({
    restaurantCategoryId: z.coerce.number().int().positive(),
  }),
  body: lookupBodySchema.partial(),
};

export const restaurantCategoryIdParamSchema = {
  params: z.object({
    restaurantCategoryId: z.coerce.number().int().positive(),
  }),
};
