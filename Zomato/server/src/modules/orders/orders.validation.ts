import { OrderStatus, PaymentMethod } from "../../constants/enums.js";
import { z } from "zod";

export const placeOrderSchema = {
  body: z
    .object({
      cartId: z.coerce.number().int().positive(),
      addressId: z.coerce.number().int().positive(),
      paymentMethod: z.enum([
        PaymentMethod.COD,
        PaymentMethod.CARD,
        PaymentMethod.UPI,
        PaymentMethod.WALLET,
      ]),
      paymentMethodId: z.coerce.number().int().positive().optional(),
      savedPaymentMethodId: z.coerce.number().int().positive().optional(),
      tipAmount: z.coerce.number().min(0).max(500).optional(),
      specialInstructions: z.string().trim().max(500).optional(),
    })
    .superRefine((values, context) => {
      if (
        (values.paymentMethod === PaymentMethod.CARD || values.paymentMethod === PaymentMethod.UPI) &&
        !values.paymentMethodId &&
        !values.savedPaymentMethodId
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select a saved card or UPI ID before continuing.",
          path: ["savedPaymentMethodId"],
        });
      }
    }),
};

export const ordersListQuerySchema = {
  query: z.object({
    status: z.nativeEnum(OrderStatus).optional(),
  }),
};

export const orderIdParamSchema = {
  params: z.object({
    orderId: z.coerce.number().int().positive(),
  }),
};

export const updateOrderStatusSchema = {
  params: z.object({
    orderId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    status: z.nativeEnum(OrderStatus),
    note: z.string().trim().max(500).optional(),
  }),
};

export const assignDeliveryPartnerSchema = {
  params: z.object({
    orderId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    deliveryPartnerId: z.coerce.number().int().positive(),
    emergencyOverride: z.literal(true),
    overrideReason: z.string().trim().max(300).optional(),
  }),
};
