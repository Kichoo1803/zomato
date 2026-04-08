import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createAddon, deleteAddon, updateAddon } from "./addons.controller.js";
import { createAddonSchema, updateAddonSchema } from "./addons.validation.js";

export const addonsRouter = Router();

addonsRouter.post("/", requireAuth, authorize(Role.RESTAURANT_OWNER, Role.ADMIN), validate(createAddonSchema), createAddon);
addonsRouter.patch("/:addonId", requireAuth, authorize(Role.RESTAURANT_OWNER, Role.ADMIN), validate(updateAddonSchema), updateAddon);
addonsRouter.delete("/:addonId", requireAuth, authorize(Role.RESTAURANT_OWNER, Role.ADMIN), deleteAddon);
