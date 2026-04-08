import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { paymentsService } from "./payments.service.js";

export const listPayments = asyncHandler(async (req, res) => {
  const payments = await paymentsService.list(req.user!, req.query.orderId ? Number(req.query.orderId) : undefined);

  return sendSuccess(res, {
    message: "Payments fetched successfully",
    data: { payments },
  });
});
