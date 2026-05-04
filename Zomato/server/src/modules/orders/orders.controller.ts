import { StatusCodes } from "http-status-codes";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ordersService } from "./orders.service.js";

export const listOrders = asyncHandler(async (req, res) => {
  const orders = await ordersService.list(req.user!, req.query.status as string | undefined);

  return sendSuccess(res, {
    message: "Orders fetched successfully",
    data: { orders },
  });
});

export const getOrderById = asyncHandler(async (req, res) => {
  const order = await ordersService.getById(req.user!, Number(req.params.orderId));

  return sendSuccess(res, {
    message: "Order fetched successfully",
    data: { order },
  });
});

export const placeOrder = asyncHandler(async (req, res) => {
  const order = await ordersService.place(req.user!, req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Order placed successfully",
    data: { order },
  });
});

export const previewOrderPlacement = asyncHandler(async (req, res) => {
  const availability = await ordersService.previewPlacement(req.user!, req.body);

  return sendSuccess(res, {
    message: "Order placement availability checked successfully",
    data: { availability },
  });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await ordersService.updateStatus(req.user!, Number(req.params.orderId), req.body);

  return sendSuccess(res, {
    message: "Order status updated successfully",
    data: { order },
  });
});

export const assignDeliveryPartner = asyncHandler(async (req, res) => {
  const order = await ordersService.assignDeliveryPartner(
    req.user!,
    Number(req.params.orderId),
    Number(req.body.deliveryPartnerId),
    req.body,
  );

  return sendSuccess(res, {
    message: "Emergency delivery override applied successfully",
    data: { order },
  });
});
