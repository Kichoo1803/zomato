import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createOperationsDeliveryPartner,
  createOperationsOwner,
  createOperationsRegionNote,
  getOperationsDashboard,
  getOperationsRegions,
  listOperationsCommunications,
  listOperationsDeliveryPartners,
  listOperationsOwners,
  updateOperationsAssignment,
  updateOperationsRegionNote,
} from "./operations.controller.js";
import {
  createOperationsDeliveryPartnerSchema,
  createOperationsOwnerSchema,
  createOperationsRegionNoteSchema,
  listOperationsCommunicationsQuerySchema,
  listOperationsDeliveryPartnersQuerySchema,
  listOperationsOwnersQuerySchema,
  operationsRegionQuerySchema,
  updateOperationsAssignmentSchema,
  updateOperationsRegionNoteSchema,
} from "./operations.validation.js";

export const operationsRouter = Router();

operationsRouter.use(requireAuth, authorize(Role.ADMIN, Role.REGIONAL_MANAGER));
operationsRouter.get("/dashboard", validate(operationsRegionQuerySchema), getOperationsDashboard);
operationsRouter.get("/regions", validate(operationsRegionQuerySchema), getOperationsRegions);
operationsRouter.get("/owners", validate(listOperationsOwnersQuerySchema), listOperationsOwners);
operationsRouter.post(
  "/owners",
  authorize(Role.ADMIN, Role.REGIONAL_MANAGER),
  validate(createOperationsOwnerSchema),
  createOperationsOwner,
);
operationsRouter.get(
  "/delivery-partners",
  validate(listOperationsDeliveryPartnersQuerySchema),
  listOperationsDeliveryPartners,
);
operationsRouter.post(
  "/delivery-partners",
  authorize(Role.ADMIN, Role.REGIONAL_MANAGER),
  validate(createOperationsDeliveryPartnerSchema),
  createOperationsDeliveryPartner,
);
operationsRouter.patch(
  "/users/:userId/assignment",
  validate(updateOperationsAssignmentSchema),
  updateOperationsAssignment,
);
operationsRouter.get(
  "/communications",
  validate(listOperationsCommunicationsQuerySchema),
  listOperationsCommunications,
);
operationsRouter.post(
  "/communications",
  validate(createOperationsRegionNoteSchema),
  createOperationsRegionNote,
);
operationsRouter.patch(
  "/communications/:noteId",
  validate(updateOperationsRegionNoteSchema),
  updateOperationsRegionNote,
);
