import { Router } from "express";
import { Role } from "../../constants/enums.js";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { listApprovalRequests, reviewApprovalRequest } from "./approval-requests.controller.js";
import {
  listApprovalRequestsQuerySchema,
  reviewApprovalRequestSchema,
} from "./approval-requests.validation.js";

export const approvalRequestsRouter = Router();

approvalRequestsRouter.use(requireAuth, authorize(Role.ADMIN));
approvalRequestsRouter.get("/", validate(listApprovalRequestsQuerySchema), listApprovalRequests);
approvalRequestsRouter.patch("/:requestId/review", validate(reviewApprovalRequestSchema), reviewApprovalRequest);

