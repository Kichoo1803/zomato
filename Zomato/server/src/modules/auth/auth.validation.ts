import { Role } from "../../constants/enums.js";
import { optionalIndianPhoneSchema } from "../../utils/phone.js";
import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character");

export const registerSchema = {
  body: z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    phone: optionalIndianPhoneSchema(),
    password: passwordSchema,
    role: z
      .enum([Role.CUSTOMER, Role.RESTAURANT_OWNER, Role.DELIVERY_PARTNER])
      .default(Role.CUSTOMER),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    password: z.string().min(1, "Password is required"),
  }),
};
