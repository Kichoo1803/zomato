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
