import { StatusCodes } from "http-status-codes";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { addonsService } from "./addons.service.js";

export const listAdminAddons = asyncHandler(async (req, res) => {
  const addons = await addonsService.listAll({
    search: req.query.search as string | undefined,
    restaurantId: typeof req.query.restaurantId === "number" ? req.query.restaurantId : undefined,
    isActive: typeof req.query.isActive === "boolean" ? req.query.isActive : undefined,
    parentType: req.query.parentType as "MENU_ITEM" | "COMBO" | undefined,
  });

  return sendSuccess(res, {
    message: "Addons fetched successfully",
    data: { addons },
  });
});

export const listOwnerAddons = asyncHandler(async (req, res) => {
  const addons = await addonsService.listForOwner(req.user!.id, {
    search: req.query.search as string | undefined,
    restaurantId: typeof req.query.restaurantId === "number" ? req.query.restaurantId : undefined,
    isActive: typeof req.query.isActive === "boolean" ? req.query.isActive : undefined,
    parentType: req.query.parentType as "MENU_ITEM" | "COMBO" | undefined,
  });

  return sendSuccess(res, {
    message: "Owner addons fetched successfully",
    data: { addons },
  });
});

export const createAddon = asyncHandler(async (req, res) => {
  const addon = await addonsService.create(req.user!, req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Addon created successfully",
    data: { addon },
  });
});

export const updateAddon = asyncHandler(async (req, res) => {
  const addon = await addonsService.update(req.user!, Number(req.params.addonId), req.body);

  return sendSuccess(res, {
    message: "Addon updated successfully",
    data: { addon },
  });
});

export const deleteAddon = asyncHandler(async (req, res) => {
  await addonsService.remove(req.user!, Number(req.params.addonId));

  return sendSuccess(res, {
    message: "Addon deleted successfully",
  });
});
