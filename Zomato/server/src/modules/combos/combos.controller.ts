import { StatusCodes } from "http-status-codes";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { combosService } from "./combos.service.js";

export const listAdminCombos = asyncHandler(async (req, res) => {
  const combos = await combosService.listAll({
    search: req.query.search as string | undefined,
    restaurantId: typeof req.query.restaurantId === "number" ? req.query.restaurantId : undefined,
    isActive: typeof req.query.isActive === "boolean" ? req.query.isActive : undefined,
  });

  return sendSuccess(res, {
    message: "Combos fetched successfully",
    data: { combos },
  });
});

export const listRestaurantCombos = asyncHandler(async (req, res) => {
  const combos = await combosService.listByRestaurant(Number(req.params.restaurantId));

  return sendSuccess(res, {
    message: "Restaurant combos fetched successfully",
    data: { combos },
  });
});

export const listOwnerCombos = asyncHandler(async (req, res) => {
  const combos = await combosService.listForOwner(req.user!.id);

  return sendSuccess(res, {
    message: "Owner combos fetched successfully",
    data: { combos },
  });
});

export const createCombo = asyncHandler(async (req, res) => {
  const combo = await combosService.create(req.user!, req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Combo created successfully",
    data: { combo },
  });
});

export const updateCombo = asyncHandler(async (req, res) => {
  const combo = await combosService.update(req.user!, Number(req.params.comboId), req.body);

  return sendSuccess(res, {
    message: "Combo updated successfully",
    data: { combo },
  });
});

export const deleteCombo = asyncHandler(async (req, res) => {
  await combosService.remove(req.user!, Number(req.params.comboId));

  return sendSuccess(res, {
    message: "Combo deleted successfully",
  });
});
