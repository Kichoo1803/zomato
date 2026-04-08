import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { notificationsService } from "./notifications.service.js";

export const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await notificationsService.list(req.user!.id);

  return sendSuccess(res, {
    message: "Notifications fetched successfully",
    data: { notifications },
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
