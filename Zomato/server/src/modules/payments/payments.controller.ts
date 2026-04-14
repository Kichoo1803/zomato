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

export const listPaymentMethods = asyncHandler(async (req, res) => {
  const paymentMethods = await paymentsService.listMethods(req.user!.id);

  return sendSuccess(res, {
    message: "Payment methods fetched successfully",
    data: { paymentMethods },
  });
});

export const createPaymentMethod = asyncHandler(async (req, res) => {
  const paymentMethod = await paymentsService.createMethod(req.user!.id, req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Payment method created successfully",
    data: { paymentMethod },
  });
});

export const updatePaymentMethod = asyncHandler(async (req, res) => {
  const paymentMethod = await paymentsService.updateMethod(req.user!.id, Number(req.params.paymentMethodId), req.body);

  return sendSuccess(res, {
    message: "Payment method updated successfully",
    data: { paymentMethod },
  });
});
