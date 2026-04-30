import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { operationsService } from "./operations.service.js";

export const getOperationsDashboard = asyncHandler(async (req, res) => {
  const dashboard = await operationsService.getDashboard(req.user!, {
    state: req.query.state as string | undefined,
    district: req.query.district as string | undefined,
  }, { endpoint: req.originalUrl });

  return sendSuccess(res, {
    message: "Operations dashboard fetched successfully",
    data: dashboard,
  });
});

export const getOperationsRegions = asyncHandler(async (req, res) => {
  const regions = await operationsService.getRegions(req.user!, {
    state: req.query.state as string | undefined,
    district: req.query.district as string | undefined,
  }, { endpoint: req.originalUrl });

  return sendSuccess(res, {
    message: "Operations regions fetched successfully",
    data: regions,
  });
});

export const listOperationsOwners = asyncHandler(async (req, res) => {
  const owners = await operationsService.listOwners(req.user!, {
    state: req.query.state as string | undefined,
    district: req.query.district as string | undefined,
    search: req.query.search as string | undefined,
    status: req.query.status as "ACTIVE" | "INACTIVE" | undefined,
    assignmentStatus: req.query.assignmentStatus as "ASSIGNED" | "UNASSIGNED" | "PARTIAL" | undefined,
  }, { endpoint: req.originalUrl });

  return sendSuccess(res, {
    message: "Operations owners fetched successfully",
    data: { owners },
  });
});

export const createOperationsOwner = asyncHandler(async (req, res) => {
  const owner = await operationsService.createOwner(req.user!, req.body, {
    endpoint: req.originalUrl,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Operations owner created successfully",
    data: { owner },
  });
});

export const listOperationsDeliveryPartners = asyncHandler(async (req, res) => {
  const partners = await operationsService.listDeliveryPartners(req.user!, {
    state: req.query.state as string | undefined,
    district: req.query.district as string | undefined,
    search: req.query.search as string | undefined,
    availabilityStatus: req.query.availabilityStatus as string | undefined,
    assignmentStatus: req.query.assignmentStatus as "ASSIGNED" | "UNASSIGNED" | "PARTIAL" | undefined,
  }, { endpoint: req.originalUrl });

  return sendSuccess(res, {
    message: "Operations delivery partners fetched successfully",
    data: { partners },
  });
});

export const createOperationsDeliveryPartner = asyncHandler(async (req, res) => {
  const partner = await operationsService.createDeliveryPartner(req.user!, req.body, {
    endpoint: req.originalUrl,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Operations delivery partner created successfully",
    data: { partner },
  });
});

export const updateOperationsAssignment = asyncHandler(async (req, res) => {
  const assignment = await operationsService.updateUserAssignment(
    req.user!,
    Number(req.params.userId),
    req.body,
    {
      endpoint: req.originalUrl,
    },
  );

  return sendSuccess(res, {
    message: "Operations assignment updated successfully",
    data: assignment,
  });
});

export const listOperationsCommunications = asyncHandler(async (req, res) => {
  const communications = await operationsService.listCommunications(req.user!, {
    state: req.query.state as string | undefined,
    district: req.query.district as string | undefined,
    search: req.query.search as string | undefined,
  }, { endpoint: req.originalUrl });

  return sendSuccess(res, {
    message: "Operations communications fetched successfully",
    data: communications,
  });
});

export const createOperationsRegionNote = asyncHandler(async (req, res) => {
  const note = await operationsService.createRegionNote(req.user!, req.body, {
    endpoint: req.originalUrl,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Operations region note created successfully",
    data: { note },
  });
});

export const updateOperationsRegionNote = asyncHandler(async (req, res) => {
  const note = await operationsService.updateRegionNote(
    req.user!,
    Number(req.params.noteId),
    req.body,
    {
      endpoint: req.originalUrl,
    },
  );

  return sendSuccess(res, {
    message: "Operations region note updated successfully",
    data: { note },
  });
});
