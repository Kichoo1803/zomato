import { StatusCodes } from "http-status-codes";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { favoritesService } from "./favorites.service.js";

export const listFavorites = asyncHandler(async (req, res) => {
  const favorites = await favoritesService.list(req.user!.id);

  return sendSuccess(res, {
    message: "Favorites fetched successfully",
    data: { favorites },
  });
});

export const addFavorite = asyncHandler(async (req, res) => {
  const favorite = await favoritesService.add(req.user!.id, Number(req.params.restaurantId));

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Restaurant added to favorites",
    data: { favorite },
  });
});

export const removeFavorite = asyncHandler(async (req, res) => {
  await favoritesService.remove(req.user!.id, Number(req.params.restaurantId));

  return sendSuccess(res, {
    message: "Restaurant removed from favorites",
  });
});
