import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
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
  createOperationsRegionNoteSchema,
  listOperationsCommunicationsQuerySchema,
  listOperationsDeliveryPartnersQuerySchema,
  listOperationsOwnersQuerySchema,
  operationsRegionQuerySchema,
  updateOperationsAssignmentSchema,
  updateOperationsRegionNoteSchema,
} from "./operations.validation.js";

export const operationsRouter = Router();

operationsRouter.use(requireAuth, authorize(Role.OPERATIONS_MANAGER, Role.REGIONAL_MANAGER));
operationsRouter.get("/dashboard", validate(operationsRegionQuerySchema), getOperationsDashboard);
operationsRouter.get("/regions", validate(operationsRegionQuerySchema), getOperationsRegions);
operationsRouter.get("/owners", validate(listOperationsOwnersQuerySchema), listOperationsOwners);
operationsRouter.get(
  "/delivery-partners",
  validate(listOperationsDeliveryPartnersQuerySchema),
  listOperationsDeliveryPartners,
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
