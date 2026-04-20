import { z } from "zod";
import { ApprovalRequestEntityType, ApprovalRequestStatus } from "./approval-request.constants.js";

export const listApprovalRequestsQuerySchema = {
  query: z.object({
    search: z.string().trim().optional(),
    status: z
      .enum([
        ApprovalRequestStatus.PENDING,
        ApprovalRequestStatus.APPROVED,
        ApprovalRequestStatus.REJECTED,
        ApprovalRequestStatus.CANCELLED,
      ])
      .optional(),
    entityType: z
      .enum([
        ApprovalRequestEntityType.USER,
        ApprovalRequestEntityType.RESTAURANT,
        ApprovalRequestEntityType.DELIVERY_PARTNER,
      ])
      .optional(),
    requesterId: z.coerce.number().int().positive().optional(),
    regionId: z.coerce.number().int().positive().optional(),
  }),
};

export const reviewApprovalRequestSchema = {
  params: z.object({
    requestId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    status: z.enum([ApprovalRequestStatus.APPROVED, ApprovalRequestStatus.REJECTED]),
    comment: z.string().trim().max(1000).optional(),
  }),
};

