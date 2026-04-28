import { PaymentMethod } from "../../constants/enums.js";
import { z } from "zod";

export const paymentOrderQuerySchema = {
  query: z.object({
    orderId: z.coerce.number().int().positive().optional(),
  }),
};

const normalizePaymentMethodBody = (input: unknown) => {
  if (!input || typeof input !== "object") {
    return input;
  }

  const record = input as Record<string, unknown>;
  return {
    ...record,
    holderName:
      typeof record.cardholderName === "string" && record.holderName == null
        ? record.cardholderName
        : record.holderName,
    maskedEnding:
      typeof record.cardLast4 === "string" && record.maskedEnding == null
        ? record.cardLast4
        : record.maskedEnding,
    isPrimary:
      typeof record.isDefault === "boolean" && record.isPrimary == null
        ? record.isDefault
        : record.isPrimary,
  };
};

const cardPaymentMethodSchema = z.object({
  type: z.literal(PaymentMethod.CARD),
  label: z.string().trim().min(2).max(40),
  holderName: z.string().trim().min(2).max(80),
  maskedEnding: z.string().trim().regex(/^\d{4}$/, "Enter the last 4 digits only."),
  cardBrand: z.string().trim().max(30).optional(),
  expiryMonth: z.string().trim().regex(/^(0[1-9]|1[0-2])$/, "Use a valid month like 08."),
  expiryYear: z.string().trim().regex(/^\d{2,4}$/, "Use a valid expiry year."),
  isPrimary: z.boolean().optional(),
});

const upiPaymentMethodSchema = z.object({
  type: z.literal(PaymentMethod.UPI),
  label: z.string().trim().max(40).optional(),
  upiId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/, "Enter a valid UPI ID."),
  isPrimary: z.boolean().optional(),
});

const paymentMethodBodySchema = z.preprocess(
  normalizePaymentMethodBody,
  z.discriminatedUnion("type", [cardPaymentMethodSchema, upiPaymentMethodSchema]),
);

export const createPaymentMethodSchema = {
  body: paymentMethodBodySchema,
};

export const updatePaymentMethodSchema = {
  params: z.object({
    paymentMethodId: z.coerce.number().int().positive(),
  }),
  body: paymentMethodBodySchema,
};

export const paymentMethodIdParamSchema = {
  params: z.object({
    paymentMethodId: z.coerce.number().int().positive(),
  }),
};
