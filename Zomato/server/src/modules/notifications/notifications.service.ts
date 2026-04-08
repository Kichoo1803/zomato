import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";

export const notificationsService = {
  async list(userId: number) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async markRead(userId: number, notificationId: number) {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });

    if (!notification) {
      throw new AppError(StatusCodes.NOT_FOUND, "Notification not found", "NOTIFICATION_NOT_FOUND");
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  },

  async markAllRead(userId: number) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  },
};
