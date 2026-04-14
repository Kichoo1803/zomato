import { z } from "zod";

export const adminNotificationsQuerySchema = {
  query: z.object({
    userId: z.coerce.number().int().positive().optional(),
    isRead: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    type: z.string().trim().optional(),
    search: z.string().trim().optional(),
  }),
};

export const createAdminNotificationSchema = {
  body: z.object({
    userId: z.coerce.number().int().positive(),
    title: z.string().trim().min(2).max(120),
    message: z.string().trim().min(2).max(500),
    type: z.string().trim().min(2).max(50),
    meta: z.string().trim().optional(),
  }),
};

export const notificationIdParamSchema = {
  params: z.object({
    notificationId: z.coerce.number().int().positive(),
  }),
};
