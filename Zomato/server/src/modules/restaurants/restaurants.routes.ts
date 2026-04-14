import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createRestaurant,
  deleteRestaurant,
  getRestaurantById,
  getMyRestaurants,
  getRestaurantBySlug,
  listAdminRestaurants,
  listRestaurants,
  updateRestaurant,
} from "./restaurants.controller.js";
import {
  adminListRestaurantsSchema,
  createRestaurantSchema,
  listRestaurantsSchema,
  restaurantIdParamSchema,
  restaurantSlugParamSchema,
  updateRestaurantSchema,
} from "./restaurants.validation.js";

export const restaurantsRouter = Router();

restaurantsRouter.get("/", validate(listRestaurantsSchema), listRestaurants);
restaurantsRouter.get(
  "/admin/all",
  requireAuth,
  authorize(Role.ADMIN),
  validate(adminListRestaurantsSchema),
  listAdminRestaurants,
);
restaurantsRouter.get(
  "/admin/:restaurantId",
  requireAuth,
  authorize(Role.ADMIN),
  validate(restaurantIdParamSchema),
  getRestaurantById,
);
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
restaurantsRouter.delete(
  "/:restaurantId",
  requireAuth,
  authorize(Role.ADMIN),
  validate(restaurantIdParamSchema),
  deleteRestaurant,
);
restaurantsRouter.get("/:slug", validate(restaurantSlugParamSchema), getRestaurantBySlug);
