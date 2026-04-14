import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createAddon,
  deleteAddon,
  listAdminAddons,
  listOwnerAddons,
  updateAddon,
} from "./addons.controller.js";
import { createAddonSchema, listAddonsQuerySchema, updateAddonSchema } from "./addons.validation.js";

export const addonsRouter = Router();

addonsRouter.get("/admin/all", requireAuth, authorize(Role.ADMIN), validate(listAddonsQuerySchema), listAdminAddons);
addonsRouter.get(
  "/owner/mine",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER),
  validate(listAddonsQuerySchema),
  listOwnerAddons,
);
addonsRouter.post("/", requireAuth, authorize(Role.RESTAURANT_OWNER, Role.ADMIN), validate(createAddonSchema), createAddon);
addonsRouter.patch("/:addonId", requireAuth, authorize(Role.RESTAURANT_OWNER, Role.ADMIN), validate(updateAddonSchema), updateAddon);
addonsRouter.delete("/:addonId", requireAuth, authorize(Role.RESTAURANT_OWNER, Role.ADMIN), deleteAddon);
