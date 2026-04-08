import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { adminAnalyticsService } from "./admin-analytics.service.js";

export const getAdminDashboard = asyncHandler(async (_req, res) => {
  const dashboard = await adminAnalyticsService.getDashboard();

  return sendSuccess(res, {
    message: "Admin analytics fetched successfully",
    data: dashboard,
  });
});
