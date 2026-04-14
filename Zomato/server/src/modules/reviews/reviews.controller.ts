import { StatusCodes } from "http-status-codes";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { reviewsService } from "./reviews.service.js";

export const listAllReviews = asyncHandler(async (req, res) => {
  const reviews = await reviewsService.listAll({
    restaurantId: typeof req.query.restaurantId === "number" ? req.query.restaurantId : undefined,
    rating: typeof req.query.rating === "number" ? req.query.rating : undefined,
    search: req.query.search as string | undefined,
  });

  return sendSuccess(res, {
    message: "Reviews fetched successfully",
    data: { reviews },
  });
});

export const listRestaurantReviews = asyncHandler(async (req, res) => {
  const reviews = await reviewsService.listByRestaurant(Number(req.params.restaurantId));

  return sendSuccess(res, {
    message: "Reviews fetched successfully",
    data: { reviews },
  });
});

export const listOwnerReviews = asyncHandler(async (req, res) => {
  const reviews = await reviewsService.listForOwner(req.user!.id);

  return sendSuccess(res, {
    message: "Owner reviews fetched successfully",
    data: { reviews },
  });
});

export const createReview = asyncHandler(async (req, res) => {
  const review = await reviewsService.create(req.user!.id, req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Review submitted successfully",
    data: { review },
  });
});

export const updateReview = asyncHandler(async (req, res) => {
  const review = await reviewsService.update(req.user!.id, Number(req.params.reviewId), req.body);

  return sendSuccess(res, {
    message: "Review updated successfully",
    data: { review },
  });
});

export const deleteReview = asyncHandler(async (req, res) => {
  await reviewsService.remove(req.user!, Number(req.params.reviewId));

  return sendSuccess(res, {
    message: "Review deleted successfully",
  });
});
