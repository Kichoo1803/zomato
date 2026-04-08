import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  addCartItem,
  applyCartOffer,
  clearCart,
  listCarts,
  removeCartItem,
  removeCartOffer,
  updateCartItem,
} from "./carts.controller.js";
import { addCartItemSchema, applyOfferSchema, cartIdParamSchema, updateCartItemSchema } from "./carts.validation.js";

export const cartsRouter = Router();

cartsRouter.use(requireAuth);
cartsRouter.get("/", listCarts);
cartsRouter.post("/items", validate(addCartItemSchema), addCartItem);
cartsRouter.patch("/items/:cartItemId", validate(updateCartItemSchema), updateCartItem);
cartsRouter.delete("/items/:cartItemId", removeCartItem);
cartsRouter.post("/:cartId/apply-offer", validate(applyOfferSchema), applyCartOffer);
cartsRouter.post("/:cartId/remove-offer", validate(cartIdParamSchema), removeCartOffer);
cartsRouter.delete("/:cartId", validate(cartIdParamSchema), clearCart);
