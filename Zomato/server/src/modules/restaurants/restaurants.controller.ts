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

export const listAdminRestaurants = asyncHandler(async (req, res) => {
  const restaurants = await restaurantsService.listForAdmin({
    search: req.query.search as string | undefined,
    city: req.query.city as string | undefined,
    ownerId: typeof req.query.ownerId === "number" ? req.query.ownerId : undefined,
    isActive: typeof req.query.isActive === "boolean" ? req.query.isActive : undefined,
  });

  return sendSuccess(res, {
    message: "Admin restaurants fetched successfully",
    data: { restaurants },
  });
});

export const getRestaurantBySlug = asyncHandler(async (req, res) => {
  const restaurant = await restaurantsService.getBySlug(String(req.params.slug));

  return sendSuccess(res, {
    message: "Restaurant fetched successfully",
    data: { restaurant },
  });
});

export const getRestaurantById = asyncHandler(async (req, res) => {
  const restaurant = await restaurantsService.getAdminById(Number(req.params.restaurantId));

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

export const deleteRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await restaurantsService.archiveByAdmin(Number(req.params.restaurantId));

  return sendSuccess(res, {
    message: "Restaurant archived successfully",
    data: { restaurant },
  });
});
