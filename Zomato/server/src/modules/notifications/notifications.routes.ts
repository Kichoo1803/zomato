import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications.controller.js";
import { notificationIdParamSchema } from "./notifications.validation.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);
notificationsRouter.get("/", listNotifications);
notificationsRouter.post("/mark-all-read", markAllNotificationsRead);
notificationsRouter.post("/:notificationId/read", validate(notificationIdParamSchema), markNotificationRead);
