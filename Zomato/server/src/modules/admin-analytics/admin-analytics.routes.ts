import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { getAdminDashboard } from "./admin-analytics.controller.js";

export const adminAnalyticsRouter = Router();

adminAnalyticsRouter.use(requireAuth, authorize(Role.ADMIN));
adminAnalyticsRouter.get("/dashboard", getAdminDashboard);
