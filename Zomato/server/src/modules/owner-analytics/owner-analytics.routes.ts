import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { getOwnerDashboard } from "./owner-analytics.controller.js";

export const ownerAnalyticsRouter = Router();

ownerAnalyticsRouter.use(requireAuth, authorize(Role.RESTAURANT_OWNER));
ownerAnalyticsRouter.get("/dashboard", getOwnerDashboard);
