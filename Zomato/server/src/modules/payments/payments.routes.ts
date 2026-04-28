import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createPaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
  listPayments,
  setDefaultPaymentMethod,
  updatePaymentMethod,
} from "./payments.controller.js";
import {
  createPaymentMethodSchema,
  paymentMethodIdParamSchema,
  paymentOrderQuerySchema,
  updatePaymentMethodSchema,
} from "./payments.validation.js";

export const paymentsRouter = Router();
export const savedPaymentMethodsRouter = Router();

paymentsRouter.use(requireAuth);
paymentsRouter.get("/methods", listPaymentMethods);
paymentsRouter.post("/methods", validate(createPaymentMethodSchema), createPaymentMethod);
paymentsRouter.patch("/methods/:paymentMethodId", validate(updatePaymentMethodSchema), updatePaymentMethod);
paymentsRouter.patch("/methods/:paymentMethodId/default", validate(paymentMethodIdParamSchema), setDefaultPaymentMethod);
paymentsRouter.delete("/methods/:paymentMethodId", validate(paymentMethodIdParamSchema), deletePaymentMethod);
paymentsRouter.get("/", validate(paymentOrderQuerySchema), listPayments);

savedPaymentMethodsRouter.use(requireAuth);
savedPaymentMethodsRouter.get("/", listPaymentMethods);
savedPaymentMethodsRouter.post("/", validate(createPaymentMethodSchema), createPaymentMethod);
savedPaymentMethodsRouter.patch("/:paymentMethodId", validate(updatePaymentMethodSchema), updatePaymentMethod);
savedPaymentMethodsRouter.patch("/:paymentMethodId/default", validate(paymentMethodIdParamSchema), setDefaultPaymentMethod);
savedPaymentMethodsRouter.delete("/:paymentMethodId", validate(paymentMethodIdParamSchema), deletePaymentMethod);
