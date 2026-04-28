import { Router } from "express";
import { Role } from "../../constants/enums.js";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  approveRegistrationApplication,
  listRegistrationApplications,
  rejectRegistrationApplication,
  submitDeliveryPartnerApplication,
  submitRestaurantOwnerApplication,
} from "./registration-applications.controller.js";
import {
  approveRegistrationApplicationSchema,
  listRegistrationApplicationsQuerySchema,
  rejectRegistrationApplicationSchema,
  submitDeliveryPartnerApplicationSchema,
  submitRestaurantOwnerApplicationSchema,
} from "./registration-applications.validation.js";
import { registrationApplicationUploadFields } from "./registration-applications.uploads.js";

export const registrationApplicationsRouter = Router();

registrationApplicationsRouter.post(
  "/restaurant-owner",
  registrationApplicationUploadFields,
  validate(submitRestaurantOwnerApplicationSchema),
  submitRestaurantOwnerApplication,
);
registrationApplicationsRouter.post(
  "/delivery-partner",
  registrationApplicationUploadFields,
  validate(submitDeliveryPartnerApplicationSchema),
  submitDeliveryPartnerApplication,
);

registrationApplicationsRouter.use(requireAuth, authorize(Role.ADMIN, Role.REGIONAL_MANAGER));
registrationApplicationsRouter.get(
  "/",
  validate(listRegistrationApplicationsQuerySchema),
  listRegistrationApplications,
);
registrationApplicationsRouter.patch(
  "/:applicationId/approve",
  validate(approveRegistrationApplicationSchema),
  approveRegistrationApplication,
);
registrationApplicationsRouter.patch(
  "/:applicationId/reject",
  validate(rejectRegistrationApplicationSchema),
  rejectRegistrationApplication,
);
