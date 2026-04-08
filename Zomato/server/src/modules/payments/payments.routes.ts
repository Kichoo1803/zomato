import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { listPayments } from "./payments.controller.js";
import { paymentOrderQuerySchema } from "./payments.validation.js";

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);
paymentsRouter.get("/", validate(paymentOrderQuerySchema), listPayments);
