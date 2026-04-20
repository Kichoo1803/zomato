import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { approvalRequestsService } from "./approval-requests.service.js";

export const listApprovalRequests = asyncHandler(async (req, res) => {
  const requests = await approvalRequestsService.listForAdmin({
    search: req.query.search as string | undefined,
    status: req.query.status as string | undefined,
    entityType: req.query.entityType as string | undefined,
    requesterId: req.query.requesterId ? Number(req.query.requesterId) : undefined,
    regionId: req.query.regionId ? Number(req.query.regionId) : undefined,
  });

  return sendSuccess(res, {
    message: "Approval requests fetched successfully",
    data: { requests },
  });
});

export const reviewApprovalRequest = asyncHandler(async (req, res) => {
  const request = await approvalRequestsService.reviewByAdmin(req.user!.id, Number(req.params.requestId), req.body);

  return sendSuccess(res, {
    message: "Approval request reviewed successfully",
    data: { request },
  });
});

