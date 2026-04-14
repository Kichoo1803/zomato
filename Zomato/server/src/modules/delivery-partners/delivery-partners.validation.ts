import { DeliveryAvailabilityStatus } from "../../constants/enums.js";
import { z } from "zod";

export const listDeliveryPartnersQuerySchema = {
  query: z.object({
    search: z.string().trim().optional(),
    availabilityStatus: z
      .enum([
        DeliveryAvailabilityStatus.ONLINE,
        DeliveryAvailabilityStatus.OFFLINE,
        DeliveryAvailabilityStatus.BUSY,
      ])
      .optional(),
    isVerified: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  }),
};

const adminDeliveryPartnerBodySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().regex(/^\+?[1-9]\d{9,14}$/).optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[0-9]/, "Password must include a number")
    .regex(/[^A-Za-z0-9]/, "Password must include a special character")
    .optional(),
  profileImage: z.string().trim().url().optional(),
  vehicleType: z.enum(["BIKE", "CYCLE", "SCOOTER", "CAR"]),
  vehicleNumber: z.string().trim().max(50).optional(),
  licenseNumber: z.string().trim().max(120).optional(),
  availabilityStatus: z
    .enum([
      DeliveryAvailabilityStatus.ONLINE,
      DeliveryAvailabilityStatus.OFFLINE,
      DeliveryAvailabilityStatus.BUSY,
    ])
    .optional(),
  isVerified: z.boolean().optional(),
});

export const createDeliveryPartnerSchema = {
  body: adminDeliveryPartnerBodySchema.extend({
    password: adminDeliveryPartnerBodySchema.shape.password.unwrap(),
  }),
};

export const updateDeliveryPartnerSchema = {
  params: z.object({
    partnerId: z.coerce.number().int().positive(),
  }),
  body: adminDeliveryPartnerBodySchema.partial(),
};

export const deliveryPartnerIdParamSchema = {
  params: z.object({
    partnerId: z.coerce.number().int().positive(),
  }),
};

export const deliveryRequestOrderIdParamSchema = {
  params: z.object({
    orderId: z.coerce.number().int().positive(),
  }),
};

export const updateAvailabilitySchema = {
  body: z.object({
    availabilityStatus: z.enum([
      DeliveryAvailabilityStatus.ONLINE,
      DeliveryAvailabilityStatus.OFFLINE,
      DeliveryAvailabilityStatus.BUSY,
    ]),
  }),
};

export const updateLocationSchema = {
  body: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
};

export const updateMyDeliveryProfileSchema = {
  body: z.object({
    fullName: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().regex(/^\+?[1-9]\d{9,14}$/).optional(),
    vehicleNumber: z.string().trim().max(50).optional(),
    licenseNumber: z.string().trim().max(120).optional(),
  }),
};
