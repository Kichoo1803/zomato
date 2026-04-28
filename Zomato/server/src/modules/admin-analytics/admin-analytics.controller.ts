import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { adminAnalyticsService } from "./admin-analytics.service.js";

export const getAdminDashboard = asyncHandler(async (req, res) => {
  const dashboard = await adminAnalyticsService.getDashboard({
    regionId: req.query.regionId ? Number(req.query.regionId) : undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
  });

  return sendSuccess(res, {
    message: "Admin analytics fetched successfully",
    data: dashboard,
  });
});
