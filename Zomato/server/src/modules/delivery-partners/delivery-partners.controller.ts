import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ordersService } from "../orders/orders.service.js";
import { deliveryPartnersService } from "./delivery-partners.service.js";

export const listDeliveryPartners = asyncHandler(async (req, res) => {
  const partners = await deliveryPartnersService.listAll({
    search: req.query.search as string | undefined,
    availabilityStatus: req.query.availabilityStatus as string | undefined,
    isVerified: typeof req.query.isVerified === "boolean" ? req.query.isVerified : undefined,
  });

  return sendSuccess(res, {
    message: "Delivery partners fetched successfully",
    data: { partners },
  });
});

export const createDeliveryPartner = asyncHandler(async (req, res) => {
  const partner = await deliveryPartnersService.createByAdmin(req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Delivery partner created successfully",
    data: { partner },
  });
});

export const updateDeliveryPartner = asyncHandler(async (req, res) => {
  const partner = await deliveryPartnersService.updateByAdmin(Number(req.params.partnerId), req.body);

  return sendSuccess(res, {
    message: "Delivery partner updated successfully",
    data: { partner },
  });
});

export const deleteDeliveryPartner = asyncHandler(async (req, res) => {
  const partner = await deliveryPartnersService.archiveByAdmin(Number(req.params.partnerId));

  return sendSuccess(res, {
    message: "Delivery partner disabled successfully",
    data: { partner },
  });
});

export const getDeliveryProfile = asyncHandler(async (req, res) => {
  const profile = await deliveryPartnersService.getProfile(req.user!.id);

  return sendSuccess(res, {
    message: "Delivery profile fetched successfully",
    data: { profile },
  });
});

export const updateMyDeliveryProfile = asyncHandler(async (req, res) => {
  const profile = await deliveryPartnersService.updateProfile(req.user!.id, req.body);

  return sendSuccess(res, {
    message: "Delivery profile updated successfully",
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

export const acceptDeliveryRequest = asyncHandler(async (req, res) => {
  const order = await ordersService.acceptDeliveryRequest(req.user!, Number(req.params.orderId));

  return sendSuccess(res, {
    message: "Delivery request accepted successfully",
    data: { order },
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
