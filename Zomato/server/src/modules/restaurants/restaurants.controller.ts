import { StatusCodes } from "http-status-codes";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { restaurantsService } from "./restaurants.service.js";

export const listRestaurants = asyncHandler(async (req, res) => {
  const result = await restaurantsService.list(req.query as Record<string, unknown>);

  return sendSuccess(res, {
    message: "Restaurants fetched successfully",
    data: result,
  });
});

export const getRestaurantBySlug = asyncHandler(async (req, res) => {
  const restaurant = await restaurantsService.getBySlug(String(req.params.slug));

  return sendSuccess(res, {
    message: "Restaurant fetched successfully",
    data: { restaurant },
  });
});

export const getMyRestaurants = asyncHandler(async (req, res) => {
  const restaurants = await restaurantsService.listForOwner(req.user!.id);

  return sendSuccess(res, {
    message: "Owned restaurants fetched successfully",
    data: { restaurants },
  });
});

export const createRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await restaurantsService.create(req.user!, req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Restaurant created successfully",
    data: { restaurant },
  });
});

export const updateRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await restaurantsService.update(req.user!, Number(req.params.restaurantId), req.body);

  return sendSuccess(res, {
    message: "Restaurant updated successfully",
    data: { restaurant },
  });
});
