import { Role } from "../../constants/enums.js";
import { z } from "zod";

export const listRestaurantsSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    cuisine: z.string().trim().optional(),
    foodType: z.enum(["veg", "non_veg"]).optional(),
    ratingMin: z.coerce.number().min(0).max(5).optional(),
    deliveryTimeMax: z.coerce.number().int().positive().optional(),
    minCost: z.coerce.number().min(0).optional(),
    maxCost: z.coerce.number().min(0).optional(),
    sort: z.enum(["popularity", "rating", "delivery_time", "cost_asc", "cost_desc"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
  }),
};

const restaurantBodySchema = z.object({
  ownerId: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(2).max(191),
  description: z.string().trim().max(500).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().regex(/^\+?[1-9]\d{9,14}$/).optional(),
  coverImage: z.string().trim().url().optional(),
  logoImage: z.string().trim().url().optional(),
  licenseNumber: z.string().trim().max(120).optional(),
  openingTime: z.string().trim().max(12).optional(),
  closingTime: z.string().trim().max(12).optional(),
  addressLine: z.string().trim().max(255).optional(),
  area: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(120),
  pincode: z.string().trim().min(4).max(20),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  costForTwo: z.number().min(0).optional(),
  avgDeliveryTime: z.number().int().positive().optional(),
  isVegOnly: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  categoryIds: z.array(z.coerce.number().int().positive()).optional(),
  cuisineIds: z.array(z.coerce.number().int().positive()).optional(),
});

export const createRestaurantSchema = {
  body: restaurantBodySchema,
};

export const updateRestaurantSchema = {
  params: z.object({
    restaurantId: z.coerce.number().int().positive(),
  }),
  body: restaurantBodySchema.partial(),
};

export const restaurantIdParamSchema = {
  params: z.object({
    restaurantId: z.coerce.number().int().positive(),
  }),
};

export const restaurantSlugParamSchema = {
  params: z.object({
    slug: z.string().trim().min(2),
  }),
};
