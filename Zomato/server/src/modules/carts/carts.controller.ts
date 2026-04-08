import { StatusCodes } from "http-status-codes";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { cartsService } from "./carts.service.js";

export const listCarts = asyncHandler(async (req, res) => {
  const carts = await cartsService.list(req.user!.id);

  return sendSuccess(res, {
    message: "Carts fetched successfully",
    data: { carts },
  });
});

export const addCartItem = asyncHandler(async (req, res) => {
  const cart = await cartsService.addItem(req.user!.id, req.body);

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Item added to cart",
    data: { cart },
  });
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const cart = await cartsService.updateItem(req.user!.id, Number(req.params.cartItemId), req.body);

  return sendSuccess(res, {
    message: "Cart updated successfully",
    data: { cart },
  });
});

export const removeCartItem = asyncHandler(async (req, res) => {
  const cart = await cartsService.removeItem(req.user!.id, Number(req.params.cartItemId));

  return sendSuccess(res, {
    message: "Cart item removed successfully",
    data: { cart },
  });
});

export const applyCartOffer = asyncHandler(async (req, res) => {
  const cart = await cartsService.applyOffer(req.user!.id, Number(req.params.cartId), req.body.code);

  return sendSuccess(res, {
    message: "Offer applied successfully",
    data: { cart },
  });
});

export const removeCartOffer = asyncHandler(async (req, res) => {
  const cart = await cartsService.removeOffer(req.user!.id, Number(req.params.cartId));

  return sendSuccess(res, {
    message: "Offer removed successfully",
    data: { cart },
  });
});

export const clearCart = asyncHandler(async (req, res) => {
  await cartsService.clearCart(req.user!.id, Number(req.params.cartId));

  return sendSuccess(res, {
    message: "Cart cleared successfully",
  });
});
