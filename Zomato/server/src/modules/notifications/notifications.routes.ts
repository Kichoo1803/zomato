import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createAdminNotification,
  deleteAllNotifications,
  deleteAdminNotification,
  listAdminNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications.controller.js";
import {
  adminNotificationsQuerySchema,
  createAdminNotificationSchema,
  notificationIdParamSchema,
} from "./notifications.validation.js";

export const notificationsRouter = Router();

notificationsRouter.get(
  "/admin/all",
  requireAuth,
  authorize(Role.ADMIN),
  validate(adminNotificationsQuerySchema),
  listAdminNotifications,
);
notificationsRouter.post(
  "/admin",
  requireAuth,
  authorize(Role.ADMIN),
  validate(createAdminNotificationSchema),
  createAdminNotification,
);
notificationsRouter.delete(
  "/admin/:notificationId",
  requireAuth,
  authorize(Role.ADMIN),
  validate(notificationIdParamSchema),
  deleteAdminNotification,
);
notificationsRouter.use(requireAuth);
notificationsRouter.get("/", listNotifications);
notificationsRouter.delete("/", deleteAllNotifications);
notificationsRouter.post("/mark-all-read", markAllNotificationsRead);
notificationsRouter.post("/:notificationId/read", validate(notificationIdParamSchema), markNotificationRead);
