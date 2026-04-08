import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createMenuCategory,
  deleteMenuCategory,
  getLookups,
  listMenuCategories,
  updateMenuCategory,
} from "./categories.controller.js";
import {
  createMenuCategorySchema,
  restaurantIdParamSchema,
  updateMenuCategorySchema,
} from "./categories.validation.js";

export const categoriesRouter = Router();

categoriesRouter.get("/lookups", getLookups);
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
