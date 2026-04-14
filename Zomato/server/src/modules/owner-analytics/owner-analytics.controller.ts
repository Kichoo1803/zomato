import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ownerAnalyticsService } from "./owner-analytics.service.js";

export const getOwnerDashboard = asyncHandler(async (req, res) => {
  const dashboard = await ownerAnalyticsService.getDashboard(req.user!.id);

  return sendSuccess(res, {
    message: "Owner analytics fetched successfully",
    data: dashboard,
  });
});
