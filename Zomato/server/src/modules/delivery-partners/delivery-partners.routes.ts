import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  getDeliveryProfile,
  listActiveDeliveries,
  listDeliveryHistory,
  listNewRequests,
  updateAvailability,
  updateLocation,
} from "./delivery-partners.controller.js";
import { updateAvailabilitySchema, updateLocationSchema } from "./delivery-partners.validation.js";

export const deliveryPartnersRouter = Router();

deliveryPartnersRouter.use(requireAuth, authorize(Role.DELIVERY_PARTNER, Role.ADMIN));
deliveryPartnersRouter.get("/me", getDeliveryProfile);
deliveryPartnersRouter.get("/requests", listNewRequests);
deliveryPartnersRouter.get("/active", listActiveDeliveries);
deliveryPartnersRouter.get("/history", listDeliveryHistory);
deliveryPartnersRouter.patch("/availability", validate(updateAvailabilitySchema), updateAvailability);
deliveryPartnersRouter.patch("/location", validate(updateLocationSchema), updateLocation);
