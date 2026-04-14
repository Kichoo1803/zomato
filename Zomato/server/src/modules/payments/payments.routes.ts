import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createPaymentMethod, listPaymentMethods, listPayments, updatePaymentMethod } from "./payments.controller.js";
import { createPaymentMethodSchema, paymentOrderQuerySchema, updatePaymentMethodSchema } from "./payments.validation.js";

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);
paymentsRouter.get("/methods", listPaymentMethods);
paymentsRouter.post("/methods", validate(createPaymentMethodSchema), createPaymentMethod);
paymentsRouter.patch("/methods/:paymentMethodId", validate(updatePaymentMethodSchema), updatePaymentMethod);
paymentsRouter.get("/", validate(paymentOrderQuerySchema), listPayments);
