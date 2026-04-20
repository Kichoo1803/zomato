import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { regionsAdminService } from "./regions.service.js";

export const listRegions = asyncHandler(async (req, res) => {
  const regions = await regionsAdminService.list({
    search: req.query.search as string | undefined,
    isActive: typeof req.query.isActive === "boolean" ? req.query.isActive : undefined,
    assignmentStatus: req.query.assignmentStatus as "ASSIGNED" | "UNASSIGNED" | undefined,
  });

  return sendSuccess(res, {
    message: "Regions fetched successfully",
    data: { regions },
  });
});

export const createRegion = asyncHandler(async (req, res) => {
  const region = await regionsAdminService.create(req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Region created successfully",
    data: { region },
  });
});

export const updateRegion = asyncHandler(async (req, res) => {
  const region = await regionsAdminService.update(Number(req.params.regionId), req.body);

  return sendSuccess(res, {
    message: "Region updated successfully",
    data: { region },
  });
});
