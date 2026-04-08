import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createReview, deleteReview, listRestaurantReviews, updateReview } from "./reviews.controller.js";
import {
  createReviewSchema,
  restaurantReviewsParamSchema,
  reviewIdParamSchema,
  updateReviewSchema,
} from "./reviews.validation.js";

export const reviewsRouter = Router();

reviewsRouter.get("/restaurant/:restaurantId", validate(restaurantReviewsParamSchema), listRestaurantReviews);
reviewsRouter.post("/", requireAuth, validate(createReviewSchema), createReview);
reviewsRouter.patch("/:reviewId", requireAuth, validate(updateReviewSchema), updateReview);
reviewsRouter.delete("/:reviewId", requireAuth, validate(reviewIdParamSchema), deleteReview);
