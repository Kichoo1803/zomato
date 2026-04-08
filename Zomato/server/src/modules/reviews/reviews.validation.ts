import { z } from "zod";

export const createReviewSchema = {
  body: z.object({
    restaurantId: z.coerce.number().int().positive(),
    orderId: z.coerce.number().int().positive().optional(),
    rating: z.coerce.number().int().min(1).max(5),
    reviewText: z.string().trim().max(800).optional(),
  }),
};

export const updateReviewSchema = {
  params: z.object({
    reviewId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    rating: z.coerce.number().int().min(1).max(5).optional(),
    reviewText: z.string().trim().max(800).optional(),
  }),
};

export const reviewIdParamSchema = {
  params: z.object({
    reviewId: z.coerce.number().int().positive(),
  }),
};

export const restaurantReviewsParamSchema = {
  params: z.object({
    restaurantId: z.coerce.number().int().positive(),
  }),
};
