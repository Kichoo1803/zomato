import { Role } from "../../constants/enums.js";
import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  assignDeliveryPartner,
  getOrderById,
  listOrders,
  placeOrder,
  previewOrderPlacement,
  updateOrderStatus,
} from "./orders.controller.js";
import {
  assignDeliveryPartnerSchema,
  orderIdParamSchema,
  ordersListQuerySchema,
  placeOrderSchema,
  previewOrderPlacementSchema,
  updateOrderStatusSchema,
} from "./orders.validation.js";

export const ordersRouter = Router();

ordersRouter.use(requireAuth);
ordersRouter.get("/", validate(ordersListQuerySchema), listOrders);
ordersRouter.get("/:orderId", validate(orderIdParamSchema), getOrderById);
ordersRouter.post("/placement-preview", validate(previewOrderPlacementSchema), previewOrderPlacement);
ordersRouter.post("/", validate(placeOrderSchema), placeOrder);
ordersRouter.patch("/:orderId/status", validate(updateOrderStatusSchema), updateOrderStatus);
ordersRouter.patch(
  "/:orderId/assign-delivery",
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate(assignDeliveryPartnerSchema),
  assignDeliveryPartner,
);
