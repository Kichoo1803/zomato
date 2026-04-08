import { z } from "zod";

const addonBodySchema = z.object({
  menuItemId: z.coerce.number().int().positive(),
  name: z.string().trim().min(2).max(120),
  price: z.number().min(0),
  isActive: z.boolean().optional(),
});

export const createAddonSchema = {
  body: addonBodySchema,
};

export const updateAddonSchema = {
  params: z.object({
    addonId: z.coerce.number().int().positive(),
  }),
  body: addonBodySchema.omit({ menuItemId: true }).partial(),
};
