import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { addFavorite, listFavorites, removeFavorite } from "./favorites.controller.js";

export const favoritesRouter = Router();

favoritesRouter.use(requireAuth);
favoritesRouter.get("/", listFavorites);
favoritesRouter.post("/:restaurantId", addFavorite);
favoritesRouter.delete("/:restaurantId", removeFavorite);
