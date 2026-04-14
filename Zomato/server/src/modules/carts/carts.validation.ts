import { z } from "zod";

export const addCartItemSchema = {
  body: z
    .object({
      restaurantId: z.coerce.number().int().positive(),
      menuItemId: z.coerce.number().int().positive().optional(),
      comboId: z.coerce.number().int().positive().optional(),
      quantity: z.coerce.number().int().positive().default(1),
      addonIds: z.array(z.coerce.number().int().positive()).optional(),
      specialInstructions: z.string().trim().max(500).optional(),
    })
    .refine((value) => Boolean(value.menuItemId) !== Boolean(value.comboId), {
      message: "Choose either a menu item or a combo.",
      path: ["menuItemId"],
    }),
};

export const updateCartItemSchema = {
  params: z.object({
    cartItemId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    quantity: z.coerce.number().int().positive().optional(),
    addonIds: z.array(z.coerce.number().int().positive()).optional(),
    specialInstructions: z.string().trim().max(500).optional(),
  }),
};

export const cartIdParamSchema = {
  params: z.object({
    cartId: z.coerce.number().int().positive(),
  }),
};

export const applyOfferSchema = {
  params: z.object({
    cartId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    code: z.string().trim().min(2).max(50),
  }),
};
