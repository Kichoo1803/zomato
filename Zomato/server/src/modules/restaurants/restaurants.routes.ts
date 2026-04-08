import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createRestaurant,
  getMyRestaurants,
  getRestaurantBySlug,
  listRestaurants,
  updateRestaurant,
} from "./restaurants.controller.js";
import {
  createRestaurantSchema,
  listRestaurantsSchema,
  restaurantSlugParamSchema,
  updateRestaurantSchema,
} from "./restaurants.validation.js";

export const restaurantsRouter = Router();

restaurantsRouter.get("/", validate(listRestaurantsSchema), listRestaurants);
restaurantsRouter.get(
  "/owner/mine",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  getMyRestaurants,
);
restaurantsRouter.post(
  "/",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate(createRestaurantSchema),
  createRestaurant,
);
restaurantsRouter.patch(
  "/:restaurantId",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate(updateRestaurantSchema),
  updateRestaurant,
);
restaurantsRouter.get("/:slug", validate(restaurantSlugParamSchema), getRestaurantBySlug);
