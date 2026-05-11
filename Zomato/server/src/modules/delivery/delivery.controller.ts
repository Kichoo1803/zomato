import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPublicDeliveryAvailabilityForRestaurant } from "../orders/order-assignment.service.js";

export const getDeliveryAvailability = asyncHandler(async (req, res) => {
  const availability = await getPublicDeliveryAvailabilityForRestaurant({
    restaurantId: Number(req.query.restaurantId),
    addressId:
      typeof req.query.addressId === "string" && req.query.addressId.trim()
        ? Number(req.query.addressId)
        : undefined,
    userId: req.user?.id,
  });

  return sendSuccess(res, {
    message: "Delivery availability fetched successfully",
    data: { availability },
  });
});
