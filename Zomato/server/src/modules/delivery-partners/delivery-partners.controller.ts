import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { deliveryPartnersService } from "./delivery-partners.service.js";

export const getDeliveryProfile = asyncHandler(async (req, res) => {
  const profile = await deliveryPartnersService.getProfile(req.user!.id);

  return sendSuccess(res, {
    message: "Delivery profile fetched successfully",
    data: { profile },
  });
});

export const updateAvailability = asyncHandler(async (req, res) => {
  const profile = await deliveryPartnersService.updateAvailability(req.user!.id, req.body.availabilityStatus);

  return sendSuccess(res, {
    message: "Availability updated successfully",
    data: { profile },
  });
});

export const updateLocation = asyncHandler(async (req, res) => {
  const profile = await deliveryPartnersService.updateLocation(
    req.user!.id,
    req.body.latitude,
    req.body.longitude,
  );

  return sendSuccess(res, {
    message: "Location updated successfully",
    data: { profile },
  });
});

export const listNewRequests = asyncHandler(async (_req, res) => {
  const requests = await deliveryPartnersService.listNewRequests();

  return sendSuccess(res, {
    message: "Delivery requests fetched successfully",
    data: { requests },
  });
});

export const listActiveDeliveries = asyncHandler(async (req, res) => {
  const deliveries = await deliveryPartnersService.listActiveDeliveries(req.user!.id);

  return sendSuccess(res, {
    message: "Active deliveries fetched successfully",
    data: { deliveries },
  });
});

export const listDeliveryHistory = asyncHandler(async (req, res) => {
  const deliveries = await deliveryPartnersService.listHistory(req.user!.id);

  return sendSuccess(res, {
    message: "Delivery history fetched successfully",
    data: { deliveries },
  });
});
