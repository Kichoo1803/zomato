import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createCuisine,
  createMenuCategory,
  createRestaurantCategory,
  deleteCuisine,
  deleteMenuCategory,
  deleteRestaurantCategory,
  getLookups,
  listMenuCategories,
  updateCuisine,
  updateMenuCategory,
  updateRestaurantCategory,
} from "./categories.controller.js";
import {
  createCuisineSchema,
  createMenuCategorySchema,
  createRestaurantCategorySchema,
  cuisineIdParamSchema,
  restaurantIdParamSchema,
  restaurantCategoryIdParamSchema,
  updateCuisineSchema,
  updateMenuCategorySchema,
  updateRestaurantCategorySchema,
} from "./categories.validation.js";

export const categoriesRouter = Router();

categoriesRouter.get("/lookups", getLookups);
categoriesRouter.post(
  "/admin/cuisines",
  requireAuth,
  authorize(Role.ADMIN),
  validate(createCuisineSchema),
  createCuisine,
);
categoriesRouter.patch(
  "/admin/cuisines/:cuisineId",
  requireAuth,
  authorize(Role.ADMIN),
  validate(updateCuisineSchema),
  updateCuisine,
);
categoriesRouter.delete(
  "/admin/cuisines/:cuisineId",
  requireAuth,
  authorize(Role.ADMIN),
  validate(cuisineIdParamSchema),
  deleteCuisine,
);
categoriesRouter.post(
  "/admin/restaurant-categories",
  requireAuth,
  authorize(Role.ADMIN),
  validate(createRestaurantCategorySchema),
  createRestaurantCategory,
);
categoriesRouter.patch(
  "/admin/restaurant-categories/:restaurantCategoryId",
  requireAuth,
  authorize(Role.ADMIN),
  validate(updateRestaurantCategorySchema),
  updateRestaurantCategory,
);
categoriesRouter.delete(
  "/admin/restaurant-categories/:restaurantCategoryId",
  requireAuth,
  authorize(Role.ADMIN),
  validate(restaurantCategoryIdParamSchema),
  deleteRestaurantCategory,
);
categoriesRouter.get("/restaurants/:restaurantId/menu", validate(restaurantIdParamSchema), listMenuCategories);
categoriesRouter.post(
  "/menu",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate(createMenuCategorySchema),
  createMenuCategory,
);
categoriesRouter.patch(
  "/menu/:categoryId",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate(updateMenuCategorySchema),
  updateMenuCategory,
);
categoriesRouter.delete(
  "/menu/:categoryId",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  deleteMenuCategory,
);
