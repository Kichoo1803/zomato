import { AddressType } from "../../constants/enums.js";
import { requiredIndianPhoneSchema } from "../../utils/phone.js";
import { z } from "zod";

const addressBodySchema = z.object({
  addressType: z.enum([AddressType.HOME, AddressType.WORK, AddressType.OTHER]).default(AddressType.HOME),
  title: z.string().trim().min(1).max(80).optional(),
  recipientName: z.string().trim().min(2).max(120),
  contactPhone: requiredIndianPhoneSchema("Enter a valid 10-digit contact phone number."),
  houseNo: z.string().trim().min(1).max(80).optional(),
  street: z.string().trim().min(2).max(150),
  landmark: z.string().trim().max(150).optional(),
  area: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(120),
  pincode: z.string().trim().min(4).max(20),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isDefault: z.boolean().optional(),
});

export const createAddressSchema = {
  body: addressBodySchema,
};

export const updateAddressSchema = {
  params: z.object({
    addressId: z.coerce.number().int().positive(),
  }),
  body: addressBodySchema.partial(),
};

export const addressIdParamSchema = {
  params: z.object({
    addressId: z.coerce.number().int().positive(),
  }),
};
