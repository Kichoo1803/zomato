import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { notificationsService } from "./notifications.service.js";

export const listAdminNotifications = asyncHandler(async (req, res) => {
  const notifications = await notificationsService.listAll({
    userId: typeof req.query.userId === "number" ? req.query.userId : undefined,
    isRead: typeof req.query.isRead === "boolean" ? req.query.isRead : undefined,
    type: req.query.type as string | undefined,
    search: req.query.search as string | undefined,
  });

  return sendSuccess(res, {
    message: "Notifications fetched successfully",
    data: { notifications },
  });
});

export const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await notificationsService.list(req.user!.id);

  return sendSuccess(res, {
    message: "Notifications fetched successfully",
    data: { notifications },
  });
});

export const createAdminNotification = asyncHandler(async (req, res) => {
  const notification = await notificationsService.createByAdmin(req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Notification created successfully",
    data: { notification },
  });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await notificationsService.markRead(req.user!.id, Number(req.params.notificationId));

  return sendSuccess(res, {
    message: "Notification marked as read",
    data: { notification },
  });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await notificationsService.markAllRead(req.user!.id);

  return sendSuccess(res, {
    message: "All notifications marked as read",
  });
});

export const deleteAllNotifications = asyncHandler(async (req, res) => {
  await notificationsService.removeAll(req.user!.id);

  return sendSuccess(res, {
    message: "All notifications deleted successfully",
  });
});

export const deleteAdminNotification = asyncHandler(async (req, res) => {
  await notificationsService.removeByAdmin(Number(req.params.notificationId));

  return sendSuccess(res, {
    message: "Notification deleted successfully",
  });
});
