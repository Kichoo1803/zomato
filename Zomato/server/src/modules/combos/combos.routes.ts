import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createCombo,
  deleteCombo,
  listAdminCombos,
  listOwnerCombos,
  listRestaurantCombos,
  updateCombo,
} from "./combos.controller.js";
import {
  comboIdParamSchema,
  createComboSchema,
  listCombosQuerySchema,
  restaurantIdParamSchema,
  updateComboSchema,
} from "./combos.validation.js";

export const combosRouter = Router();

combosRouter.get(
  "/admin/all",
  requireAuth,
  authorize(Role.ADMIN),
  validate(listCombosQuerySchema),
  listAdminCombos,
);
combosRouter.get(
  "/owner/mine",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER),
  listOwnerCombos,
);
combosRouter.get("/restaurant/:restaurantId", validate(restaurantIdParamSchema), listRestaurantCombos);
combosRouter.post(
  "/",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate(createComboSchema),
  createCombo,
);
combosRouter.patch(
  "/:comboId",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate(updateComboSchema),
  updateCombo,
);
combosRouter.delete(
  "/:comboId",
  requireAuth,
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate(comboIdParamSchema),
  deleteCombo,
);
