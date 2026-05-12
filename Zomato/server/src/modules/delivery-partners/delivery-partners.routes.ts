import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  acceptDeliveryRequest,
  createDeliveryPartner,
  declineDeliveryRequest,
  deleteDeliveryPartner,
  getDeliveryProfile,
  getDeliveryById,
  listDeliveries,
  listActiveDeliveries,
  listDeliveryHistory,
  listNearbyRestaurants,
  listDeliveryPartners,
  listNewRequests,
  releaseAssignedOrder,
  updateMyDeliveryProfile,
  updateDeliveryPartner,
  updateAvailability,
  updateLocation,
} from "./delivery-partners.controller.js";
import {
  createDeliveryPartnerSchema,
  deliveryPartnerIdParamSchema,
  deliveryRequestOrderIdParamSchema,
  listDeliveryPartnersQuerySchema,
  rejectDeliveryRequestSchema,
  releaseAssignedOrderSchema,
  updateAvailabilitySchema,
  updateDeliveryPartnerSchema,
  updateLocationSchema,
  updateMyDeliveryProfileSchema,
} from "./delivery-partners.validation.js";

export const deliveryPartnersRouter = Router();

deliveryPartnersRouter.get(
  "/admin/all",
  requireAuth,
  authorize(Role.ADMIN),
  validate(listDeliveryPartnersQuerySchema),
  listDeliveryPartners,
);
deliveryPartnersRouter.post(
  "/admin",
  requireAuth,
  authorize(Role.ADMIN),
  validate(createDeliveryPartnerSchema),
  createDeliveryPartner,
);
deliveryPartnersRouter.patch(
  "/admin/:partnerId",
  requireAuth,
  authorize(Role.ADMIN),
  validate(updateDeliveryPartnerSchema),
  updateDeliveryPartner,
);
deliveryPartnersRouter.delete(
  "/admin/:partnerId",
  requireAuth,
  authorize(Role.ADMIN),
  validate(deliveryPartnerIdParamSchema),
  deleteDeliveryPartner,
);
deliveryPartnersRouter.use(requireAuth, authorize(Role.DELIVERY_PARTNER));
deliveryPartnersRouter.get("/me", getDeliveryProfile);
deliveryPartnersRouter.patch("/me", validate(updateMyDeliveryProfileSchema), updateMyDeliveryProfile);
deliveryPartnersRouter.get("/nearby-restaurants", listNearbyRestaurants);
deliveryPartnersRouter.get("/deliveries", listDeliveries);
deliveryPartnersRouter.get(
  "/deliveries/:orderId",
  validate(deliveryRequestOrderIdParamSchema),
  getDeliveryById,
);
deliveryPartnersRouter.post(
  "/deliveries/:orderId/accept",
  validate(deliveryRequestOrderIdParamSchema),
  acceptDeliveryRequest,
);
deliveryPartnersRouter.post(
  "/deliveries/:orderId/reject",
  validate(rejectDeliveryRequestSchema),
  declineDeliveryRequest,
);
deliveryPartnersRouter.get("/requests", listNewRequests);
deliveryPartnersRouter.patch(
  "/requests/:orderId/accept",
  validate(deliveryRequestOrderIdParamSchema),
  acceptDeliveryRequest,
);
deliveryPartnersRouter.patch(
  "/requests/:orderId/skip",
  validate(rejectDeliveryRequestSchema),
  declineDeliveryRequest,
);
deliveryPartnersRouter.get("/active", listActiveDeliveries);
deliveryPartnersRouter.patch(
  "/active/:orderId/release",
  validate(releaseAssignedOrderSchema),
  releaseAssignedOrder,
);
deliveryPartnersRouter.get("/history", listDeliveryHistory);
deliveryPartnersRouter.patch("/availability", validate(updateAvailabilitySchema), updateAvailability);
deliveryPartnersRouter.patch("/location", validate(updateLocationSchema), updateLocation);
