import { Router } from "express";
import { optionalAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { getDeliveryAvailability } from "./delivery.controller.js";
import { deliveryAvailabilityQuerySchema } from "./delivery.validation.js";

export const deliveryRouter = Router();

deliveryRouter.get(
  "/availability",
  optionalAuth,
  validate(deliveryAvailabilityQuerySchema),
  getDeliveryAvailability,
);
