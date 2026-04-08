import { StatusCodes } from "http-status-codes";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { menuItemsService } from "./menu-items.service.js";

export const listMenuItems = asyncHandler(async (req, res) => {
  const items = await menuItemsService.listByRestaurant(Number(req.params.restaurantId));

  return sendSuccess(res, {
    message: "Menu items fetched successfully",
    data: { items },
  });
});

export const createMenuItem = asyncHandler(async (req, res) => {
  const item = await menuItemsService.create(req.user!, req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Menu item created successfully",
    data: { item },
  });
});

export const updateMenuItem = asyncHandler(async (req, res) => {
  const item = await menuItemsService.update(req.user!, Number(req.params.itemId), req.body);

  return sendSuccess(res, {
    message: "Menu item updated successfully",
    data: { item },
  });
});

export const deleteMenuItem = asyncHandler(async (req, res) => {
  await menuItemsService.remove(req.user!, Number(req.params.itemId));

  return sendSuccess(res, {
    message: "Menu item deleted successfully",
  });
});
