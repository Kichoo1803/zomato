import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { getAdminDashboard } from "./admin-analytics.controller.js";
import { getAdminDashboardQuerySchema } from "./admin-analytics.validation.js";

export const adminAnalyticsRouter = Router();

adminAnalyticsRouter.use(requireAuth, authorize(Role.ADMIN));
adminAnalyticsRouter.get("/dashboard", validate(getAdminDashboardQuerySchema), getAdminDashboard);
