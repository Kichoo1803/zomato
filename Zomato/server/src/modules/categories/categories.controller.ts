import { StatusCodes } from "http-status-codes";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { categoriesService } from "./categories.service.js";

export const getLookups = asyncHandler(async (_req, res) => {
  const lookups = await categoriesService.getLookups();

  return sendSuccess(res, {
    message: "Category lookups fetched successfully",
    data: lookups,
  });
});

export const listMenuCategories = asyncHandler(async (req, res) => {
  const categories = await categoriesService.listMenuCategories(Number(req.params.restaurantId));

  return sendSuccess(res, {
    message: "Menu categories fetched successfully",
    data: { categories },
  });
});

export const createMenuCategory = asyncHandler(async (req, res) => {
  const category = await categoriesService.createMenuCategory(req.user!, req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Menu category created successfully",
    data: { category },
  });
});

export const updateMenuCategory = asyncHandler(async (req, res) => {
  const category = await categoriesService.updateMenuCategory(req.user!, Number(req.params.categoryId), req.body);

  return sendSuccess(res, {
    message: "Menu category updated successfully",
    data: { category },
  });
});

export const deleteMenuCategory = asyncHandler(async (req, res) => {
  await categoriesService.removeMenuCategory(req.user!, Number(req.params.categoryId));

  return sendSuccess(res, {
    message: "Menu category deleted successfully",
  });
});

export const createCuisine = asyncHandler(async (req, res) => {
  const cuisine = await categoriesService.createCuisine(req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Cuisine created successfully",
    data: { cuisine },
  });
});

export const updateCuisine = asyncHandler(async (req, res) => {
  const cuisine = await categoriesService.updateCuisine(Number(req.params.cuisineId), req.body);

  return sendSuccess(res, {
    message: "Cuisine updated successfully",
    data: { cuisine },
  });
});

export const deleteCuisine = asyncHandler(async (req, res) => {
  await categoriesService.removeCuisine(Number(req.params.cuisineId));

  return sendSuccess(res, {
    message: "Cuisine deleted successfully",
  });
});

export const createRestaurantCategory = asyncHandler(async (req, res) => {
  const category = await categoriesService.createRestaurantCategory(req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Restaurant category created successfully",
    data: { category },
  });
});

export const updateRestaurantCategory = asyncHandler(async (req, res) => {
  const category = await categoriesService.updateRestaurantCategory(
    Number(req.params.restaurantCategoryId),
    req.body,
  );

  return sendSuccess(res, {
    message: "Restaurant category updated successfully",
    data: { category },
  });
});

export const deleteRestaurantCategory = asyncHandler(async (req, res) => {
  await categoriesService.removeRestaurantCategory(Number(req.params.restaurantCategoryId));

  return sendSuccess(res, {
    message: "Restaurant category deleted successfully",
  });
});
