import { Role } from "../../constants/enums.js";
import { z } from "zod";

export const updateProfileSchema = {
  body: z.object({
    fullName: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().regex(/^\+?[1-9]\d{9,14}$/).optional(),
    profileImage: z.string().trim().url().optional(),
  }),
};

export const listUsersQuerySchema = {
  query: z.object({
    role: z.nativeEnum(Role).optional(),
  }),
};
