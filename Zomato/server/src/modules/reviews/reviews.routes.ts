import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createReview,
  deleteReview,
  listAllReviews,
  listOwnerReviews,
  listRestaurantReviews,
  updateReview,
} from "./reviews.controller.js";
import {
  adminReviewsQuerySchema,
  createReviewSchema,
  restaurantReviewsParamSchema,
  reviewIdParamSchema,
  updateReviewSchema,
} from "./reviews.validation.js";

export const reviewsRouter = Router();

reviewsRouter.get("/admin/all", requireAuth, authorize(Role.ADMIN), validate(adminReviewsQuerySchema), listAllReviews);
reviewsRouter.get("/owner/mine", requireAuth, authorize(Role.RESTAURANT_OWNER), listOwnerReviews);
reviewsRouter.get("/restaurant/:restaurantId", validate(restaurantReviewsParamSchema), listRestaurantReviews);
reviewsRouter.post("/", requireAuth, validate(createReviewSchema), createReview);
reviewsRouter.patch("/:reviewId", requireAuth, validate(updateReviewSchema), updateReview);
reviewsRouter.delete("/:reviewId", requireAuth, validate(reviewIdParamSchema), deleteReview);
