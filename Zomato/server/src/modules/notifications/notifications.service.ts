import { NotificationType } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { emitNotification } from "../../socket/index.js";
import { AppError } from "../../utils/app-error.js";

const serializeMeta = (meta?: string | Record<string, unknown> | null) => {
  if (meta == null) {
    return null;
  }

  if (typeof meta === "string") {
    return meta;
  }

  return JSON.stringify(meta);
};

const createNotificationRecord = async (input: {
  userId: number;
  title: string;
  message: string;
  type?: string;
  meta?: string | Record<string, unknown> | null;
  dedupeWindowMinutes?: number;
}) => {
  const normalizedType = input.type ?? NotificationType.SYSTEM;
  const normalizedMeta = serializeMeta(input.meta);

  if (input.dedupeWindowMinutes) {
    const dedupeCutoff = new Date(Date.now() - input.dedupeWindowMinutes * 60 * 1000);
    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        type: normalizedType,
        title: input.title,
        message: input.message,
        meta: normalizedMeta,
        createdAt: {
          gte: dedupeCutoff,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingNotification) {
      return existingNotification;
    }
  }

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: normalizedType,
      meta: normalizedMeta,
    },
  });

  emitNotification(input.userId, notification);
  return notification;
};

export const notificationsService = {
  async listAll(filters?: { userId?: number; isRead?: boolean; type?: string; search?: string }) {
    const search = filters?.search?.trim();

    return prisma.notification.findMany({
      where: {
        ...(filters?.userId ? { userId: filters.userId } : {}),
        ...(filters?.isRead !== undefined ? { isRead: filters.isRead } : {}),
        ...(filters?.type ? { type: filters.type } : {}),
        ...(search
          ? {
              OR: [{ title: { contains: search } }, { message: { contains: search } }],
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async list(userId: number) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async createByAdmin(input: {
    userId: number;
    title: string;
    message: string;
    type: string;
    meta?: string;
  }) {
    const notification = await createNotificationRecord({
      ...input,
      meta: input.meta ?? "{}",
    });

    return prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  },

  async createForUser(input: {
    userId: number;
    title: string;
    message: string;
    type?: string;
    meta?: string | Record<string, unknown> | null;
    dedupeWindowMinutes?: number;
  }) {
    return createNotificationRecord(input);
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

  async removeAll(userId: number) {
    await prisma.notification.deleteMany({
      where: { userId },
    });
  },

  async removeByAdmin(notificationId: number) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true },
    });

    if (!notification) {
      throw new AppError(StatusCodes.NOT_FOUND, "Notification not found", "NOTIFICATION_NOT_FOUND");
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });
  },
};
