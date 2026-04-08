import { DiscountType, OfferScope } from "../../constants/enums.js";
import { z } from "zod";

const offerBodySchema = z.object({
  code: z.string().trim().max(50).optional(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  discountType: z.enum([DiscountType.PERCENTAGE, DiscountType.FLAT]),
  discountValue: z.number().positive(),
  minOrderAmount: z.number().min(0).default(0),
  maxDiscount: z.number().positive().optional(),
  scope: z.enum([OfferScope.PLATFORM, OfferScope.RESTAURANT]).default(OfferScope.PLATFORM),
  usageLimit: z.number().int().positive().optional(),
  perUserLimit: z.number().int().positive().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

export const createOfferSchema = {
  body: offerBodySchema,
};

export const updateOfferSchema = {
  params: z.object({
    offerId: z.coerce.number().int().positive(),
  }),
  body: offerBodySchema.partial(),
};
