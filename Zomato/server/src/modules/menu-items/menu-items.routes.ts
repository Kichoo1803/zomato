import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createMenuItem,
  deleteMenuItem,
  listAllMenuItems,
  listMenuItems,
  listOwnerMenuItems,
  updateMenuItem,
} from "./menu-items.controller.js";
import {
  createMenuItemSchema,
  listMenuItemsQuerySchema,
  restaurantIdParamSchema,
  updateMenuItemSchema,
} from "./menu-items.validation.js";

export const menuItemsRouter = Router();

menuItemsRouter.get("/", requireAuth, authorize(Role.ADMIN), validate(listMenuItemsQuerySchema), listAllMenuItems);
menuItemsRouter.get("/owner/mine", requireAuth, authorize(Role.RESTAURANT_OWNER), listOwnerMenuItems);
menuItemsRouter.get("/restaurant/:restaurantId", validate(restaurantIdParamSchema), listMenuItems);
menuItemsRouter.post(
  "/",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate(createMenuItemSchema),
  createMenuItem,
);
menuItemsRouter.patch(
  "/:itemId",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate(updateMenuItemSchema),
  updateMenuItem,
);
menuItemsRouter.delete("/:itemId", requireAuth, authorize(Role.RESTAURANT_OWNER, Role.ADMIN), deleteMenuItem);
