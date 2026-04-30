import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { cleanupUploadedFiles, getRequestBaseUrl } from "../../lib/uploads.js";
import { registrationApplicationsService } from "./registration-applications.service.js";

const getRegistrationFiles = (files: unknown) =>
  (files ?? {}) as Record<string, Express.Multer.File[] | undefined>;

export const submitRestaurantOwnerApplication = asyncHandler(async (req, res) => {
  try {
    const application = await registrationApplicationsService.submitRestaurantOwnerApplication(
      req.body,
      getRegistrationFiles(req.files),
      getRequestBaseUrl(req),
    );

    return sendSuccess(res, {
      statusCode: 201,
      message: "Restaurant owner application submitted successfully",
      data: { application },
    });
  } catch (error) {
    await cleanupUploadedFiles(getRegistrationFiles(req.files));
    throw error;
  }
});

export const submitDeliveryPartnerApplication = asyncHandler(async (req, res) => {
  try {
    const application = await registrationApplicationsService.submitDeliveryPartnerApplication(
      req.body,
      getRegistrationFiles(req.files),
      getRequestBaseUrl(req),
    );

    return sendSuccess(res, {
      statusCode: 201,
      message: "Delivery partner application submitted successfully",
      data: { application },
    });
  } catch (error) {
    await cleanupUploadedFiles(getRegistrationFiles(req.files));
    throw error;
  }
});

export const listRegistrationApplications = asyncHandler(async (req, res) => {
  const applications = await registrationApplicationsService.listForActor(req.user!, {
    search: req.query.search as string | undefined,
    roleType: req.query.roleType as string | undefined,
    status: req.query.status as string | undefined,
    regionId: req.query.regionId ? Number(req.query.regionId) : undefined,
    state: req.query.state as string | undefined,
    district: req.query.district as string | undefined,
    createdFrom: req.query.createdFrom as string | undefined,
    createdTo: req.query.createdTo as string | undefined,
    unassignedOnly:
      typeof req.query.unassignedOnly === "boolean" ? req.query.unassignedOnly : undefined,
  }, { endpoint: req.originalUrl });

  return sendSuccess(res, {
    message: "Registration applications fetched successfully",
    data: { applications },
  });
});

export const approveRegistrationApplication = asyncHandler(async (req, res) => {
  const application = await registrationApplicationsService.approve(
    req.user!,
    Number(req.params.applicationId),
    req.body,
    { endpoint: req.originalUrl },
  );

  return sendSuccess(res, {
    message: "Registration application approved successfully",
    data: { application },
  });
});

export const rejectRegistrationApplication = asyncHandler(async (req, res) => {
  const application = await registrationApplicationsService.reject(
    req.user!,
    Number(req.params.applicationId),
    req.body,
    { endpoint: req.originalUrl },
  );

  return sendSuccess(res, {
    message: "Registration application rejected successfully",
    data: { application },
  });
});
