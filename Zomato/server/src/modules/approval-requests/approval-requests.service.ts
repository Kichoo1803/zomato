import { Prisma } from "@prisma/client";
import { NotificationType, Role } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { notificationsService } from "../notifications/notifications.service.js";
import {
  resolveRegionIdForAssignment,
  syncRestaurantsRegionForOwner,
} from "../regions/regions.service.js";
import { AppError } from "../../utils/app-error.js";
import {
  ApprovalRequestActionType,
  ApprovalRequestEntityType,
  ApprovalRequestStatus,
} from "./approval-request.constants.js";

const approvalRequestSelect = {
  id: true,
  requesterId: true,
  requesterRole: true,
  targetEntityType: true,
  targetEntityId: true,
  regionId: true,
  actionType: true,
  beforeSnapshot: true,
  proposedChanges: true,
  status: true,
  reviewComment: true,
  reviewedAt: true,
  appliedAt: true,
  createdAt: true,
  updatedAt: true,
  region: {
    select: {
      id: true,
      name: true,
      stateName: true,
      districtName: true,
      code: true,
      slug: true,
      isActive: true,
    },
  },
  requester: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
    },
  },
  reviewedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.ApprovalRequestSelect;

const parseSnapshot = (value?: string | null) => {
  if (!value?.trim()) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return { raw: value };
  }
};

const serializeSnapshot = (value?: Record<string, unknown> | null) =>
  value ? JSON.stringify(value) : null;

const toApprovalRequest = (
  request: Prisma.ApprovalRequestGetPayload<{ select: typeof approvalRequestSelect }>,
) => ({
  ...request,
  beforeSnapshot: parseSnapshot(request.beforeSnapshot),
  proposedChanges: parseSnapshot(request.proposedChanges),
});

const notifyAdminsAboutRequest = async (request: {
  id: number;
  requester: { fullName: string };
  region?: { name: string } | null;
  actionType: string;
}) => {
  const admins = await prisma.user.findMany({
    where: {
      role: Role.ADMIN,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!admins.length) {
    return;
  }

  await Promise.all(
    admins.map((admin) =>
      notificationsService.createForUser({
        userId: admin.id,
        title: "Approval request pending",
        message: `${request.requester.fullName} submitted ${request.actionType.replace(/_/g, " ").toLowerCase()} for ${request.region?.name ?? "an unscoped region"}.`,
        type: NotificationType.SYSTEM,
        meta: {
          eventKey: "approval-request:pending",
          approvalRequestId: request.id,
          path: "/admin/approval-requests",
        },
        dedupeWindowMinutes: 15,
      }),
    ),
  );
};

const notifyRequesterAboutDecision = async (
  requesterId: number,
  payload: {
    requestId: number;
    status: string;
    comment?: string;
  },
) => {
  const title =
    payload.status === ApprovalRequestStatus.APPROVED
      ? "Approval request approved"
      : "Approval request rejected";

  const message =
    payload.status === ApprovalRequestStatus.APPROVED
      ? "Your requested regional change has been approved and applied."
      : payload.comment?.trim()
        ? `Your requested regional change was rejected. ${payload.comment.trim()}`
        : "Your requested regional change was rejected.";

  await notificationsService.createForUser({
    userId: requesterId,
    title,
    message,
    type: NotificationType.SYSTEM,
    meta: {
      eventKey: `approval-request:${payload.status.toLowerCase()}`,
      approvalRequestId: payload.requestId,
      path: "/ops/notifications",
    },
    dedupeWindowMinutes: 15,
  });
};

const applyApprovedRequest = async (
  tx: Prisma.TransactionClient,
  request: Prisma.ApprovalRequestGetPayload<{ select: typeof approvalRequestSelect }>,
) => {
  if (request.actionType === ApprovalRequestActionType.USER_ASSIGNMENT_UPDATE) {
    const proposedChanges = parseSnapshot(request.proposedChanges) ?? {};
    const nextState =
      typeof proposedChanges.state === "string" && proposedChanges.state.trim()
        ? proposedChanges.state.trim()
        : null;
    const nextDistrict =
      typeof proposedChanges.district === "string" && proposedChanges.district.trim()
        ? proposedChanges.district.trim()
        : null;
    const nextNotes =
      typeof proposedChanges.notes === "string" && proposedChanges.notes.trim()
        ? proposedChanges.notes.trim()
        : null;
    const region = await resolveRegionIdForAssignment(tx, nextState, nextDistrict);

    const targetUser = await tx.user.findUnique({
      where: { id: request.targetEntityId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!targetUser) {
      throw new AppError(StatusCodes.NOT_FOUND, "Approval target not found", "APPROVAL_TARGET_NOT_FOUND");
    }

    await tx.user.update({
      where: { id: request.targetEntityId },
      data: {
        opsState: nextState,
        opsDistrict: nextDistrict,
        opsNotes: nextNotes,
        regionId: region?.id ?? null,
      },
    });

    if (targetUser.role === Role.RESTAURANT_OWNER) {
      await syncRestaurantsRegionForOwner(tx, targetUser.id, region?.id ?? null);
    }

    return;
  }

  throw new AppError(
    StatusCodes.BAD_REQUEST,
    "This approval action type is not supported yet",
    "APPROVAL_ACTION_UNSUPPORTED",
  );
};

export const approvalRequestsService = {
  async createUserAssignmentRequest(input: {
    requesterId: number;
    requesterRole: Role;
    targetUserId: number;
    currentState?: string | null;
    currentDistrict?: string | null;
    currentNotes?: string | null;
    nextState?: string | null;
    nextDistrict?: string | null;
    nextNotes?: string | null;
    regionId?: number | null;
  }) {
    const region =
      input.regionId != null
        ? { id: input.regionId }
        : await resolveRegionIdForAssignment(prisma, input.nextState, input.nextDistrict);

    const request = await prisma.approvalRequest.create({
      data: {
        requesterId: input.requesterId,
        requesterRole: input.requesterRole,
        targetEntityType: ApprovalRequestEntityType.USER,
        targetEntityId: input.targetUserId,
        regionId: region?.id ?? null,
        actionType: ApprovalRequestActionType.USER_ASSIGNMENT_UPDATE,
        beforeSnapshot: serializeSnapshot({
          state: input.currentState ?? null,
          district: input.currentDistrict ?? null,
          notes: input.currentNotes ?? null,
        }),
        proposedChanges: JSON.stringify({
          state: input.nextState ?? null,
          district: input.nextDistrict ?? null,
          notes: input.nextNotes ?? null,
        }),
        status: ApprovalRequestStatus.PENDING,
      },
      select: approvalRequestSelect,
    });

    await notifyAdminsAboutRequest(request);

    return toApprovalRequest(request);
  },

  async listForAdmin(filters?: {
    search?: string;
    status?: string;
    entityType?: string;
    requesterId?: number;
    regionId?: number;
  }) {
    const search = filters?.search?.trim();

    const requests = await prisma.approvalRequest.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.entityType ? { targetEntityType: filters.entityType } : {}),
        ...(filters?.requesterId ? { requesterId: filters.requesterId } : {}),
        ...(filters?.regionId ? { regionId: filters.regionId } : {}),
        ...(search
          ? {
              OR: [
                { actionType: { contains: search } },
                { targetEntityType: { contains: search } },
                {
                  requester: {
                    OR: [{ fullName: { contains: search } }, { email: { contains: search } }],
                  },
                },
                {
                  region: {
                    OR: [
                      { name: { contains: search } },
                      { stateName: { contains: search } },
                      { districtName: { contains: search } },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      select: approvalRequestSelect,
      orderBy: [{ createdAt: "desc" }],
    });

    return requests.map(toApprovalRequest);
  },

  async reviewByAdmin(
    reviewerId: number,
    requestId: number,
    input: {
      status: typeof ApprovalRequestStatus.APPROVED | typeof ApprovalRequestStatus.REJECTED;
      comment?: string;
    },
  ) {
    const existingRequest = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
      select: approvalRequestSelect,
    });

    if (!existingRequest) {
      throw new AppError(StatusCodes.NOT_FOUND, "Approval request not found", "APPROVAL_REQUEST_NOT_FOUND");
    }

    if (existingRequest.status !== ApprovalRequestStatus.PENDING) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "This approval request has already been reviewed",
        "APPROVAL_REQUEST_ALREADY_REVIEWED",
      );
    }

    const reviewedRequest = await prisma.$transaction(async (tx) => {
      if (input.status === ApprovalRequestStatus.APPROVED) {
        await applyApprovedRequest(tx, existingRequest);
      }

      return tx.approvalRequest.update({
        where: { id: requestId },
        data: {
          status: input.status,
          reviewComment: input.comment?.trim() || null,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          ...(input.status === ApprovalRequestStatus.APPROVED ? { appliedAt: new Date() } : {}),
        },
        select: approvalRequestSelect,
      });
    });

    await notifyRequesterAboutDecision(reviewedRequest.requesterId, {
      requestId: reviewedRequest.id,
      status: reviewedRequest.status,
      comment: reviewedRequest.reviewComment ?? undefined,
    });

    return toApprovalRequest(reviewedRequest);
  },
};

