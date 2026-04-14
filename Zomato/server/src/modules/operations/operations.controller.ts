import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { operationsService } from "./operations.service.js";

export const getOperationsDashboard = asyncHandler(async (req, res) => {
  const dashboard = await operationsService.getDashboard({
    state: req.query.state as string | undefined,
    district: req.query.district as string | undefined,
  });

  return sendSuccess(res, {
    message: "Operations dashboard fetched successfully",
    data: dashboard,
  });
});

export const getOperationsRegions = asyncHandler(async (req, res) => {
  const regions = await operationsService.getRegions({
    state: req.query.state as string | undefined,
    district: req.query.district as string | undefined,
  });

  return sendSuccess(res, {
    message: "Operations regions fetched successfully",
    data: regions,
  });
});

export const listOperationsOwners = asyncHandler(async (req, res) => {
  const owners = await operationsService.listOwners({
    state: req.query.state as string | undefined,
    district: req.query.district as string | undefined,
    search: req.query.search as string | undefined,
    status: req.query.status as "ACTIVE" | "INACTIVE" | undefined,
    assignmentStatus: req.query.assignmentStatus as "ASSIGNED" | "UNASSIGNED" | "PARTIAL" | undefined,
  });

  return sendSuccess(res, {
    message: "Operations owners fetched successfully",
    data: { owners },
  });
});

export const listOperationsDeliveryPartners = asyncHandler(async (req, res) => {
  const partners = await operationsService.listDeliveryPartners({
    state: req.query.state as string | undefined,
    district: req.query.district as string | undefined,
    search: req.query.search as string | undefined,
    availabilityStatus: req.query.availabilityStatus as string | undefined,
    assignmentStatus: req.query.assignmentStatus as "ASSIGNED" | "UNASSIGNED" | "PARTIAL" | undefined,
  });

  return sendSuccess(res, {
    message: "Operations delivery partners fetched successfully",
    data: { partners },
  });
});

export const updateOperationsAssignment = asyncHandler(async (req, res) => {
  const assignment = await operationsService.updateUserAssignment(Number(req.params.userId), req.body);

  return sendSuccess(res, {
    message: "Operations assignment updated successfully",
    data: { assignment },
  });
});

export const listOperationsCommunications = asyncHandler(async (req, res) => {
  const communications = await operationsService.listCommunications({
    state: req.query.state as string | undefined,
    district: req.query.district as string | undefined,
    search: req.query.search as string | undefined,
  });

  return sendSuccess(res, {
    message: "Operations communications fetched successfully",
    data: communications,
  });
});

export const createOperationsRegionNote = asyncHandler(async (req, res) => {
  const note = await operationsService.createRegionNote(req.user!.id, req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Operations region note created successfully",
    data: { note },
  });
});

export const updateOperationsRegionNote = asyncHandler(async (req, res) => {
  const note = await operationsService.updateRegionNote(Number(req.params.noteId), req.user!.id, req.body);

  return sendSuccess(res, {
    message: "Operations region note updated successfully",
    data: { note },
  });
});
