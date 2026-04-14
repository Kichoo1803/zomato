import { AddonType } from "../../constants/enums.js";
import { z } from "zod";

const addonBodyBaseSchema = z.object({
  menuItemId: z.coerce.number().int().positive().optional(),
  comboId: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional(),
  addonType: z
    .enum([
      AddonType.EXTRA,
      AddonType.UPGRADE,
      AddonType.DIP,
      AddonType.DRINK,
      AddonType.SIDE,
      AddonType.DESSERT,
    ])
    .default(AddonType.EXTRA),
  price: z.coerce.number().min(0),
  isActive: z.boolean().optional(),
});

const createAddonBodySchema = addonBodyBaseSchema.superRefine((value, ctx) => {
  if (Boolean(value.menuItemId) === Boolean(value.comboId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["menuItemId"],
      message: "Choose either a menu item or a combo for this addon.",
    });
  }
});

const updateAddonBodySchema = addonBodyBaseSchema.partial().superRefine((value, ctx) => {
  const hasMenuItemId = value.menuItemId !== undefined;
  const hasComboId = value.comboId !== undefined;

  if (hasMenuItemId && hasComboId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["menuItemId"],
      message: "Choose either a menu item or a combo for this addon.",
    });
  }
});

export const listAddonsQuerySchema = {
  query: z.object({
    search: z.string().trim().optional(),
    restaurantId: z.coerce.number().int().positive().optional(),
    isActive: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    parentType: z.enum(["MENU_ITEM", "COMBO"]).optional(),
  }),
};

export const createAddonSchema = {
  body: createAddonBodySchema,
};

export const updateAddonSchema = {
  params: z.object({
    addonId: z.coerce.number().int().positive(),
  }),
  body: updateAddonBodySchema,
};
