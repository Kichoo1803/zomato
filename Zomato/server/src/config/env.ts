import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().trim().min(1).optional(),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  CORS_ORIGINS: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  COOKIE_DOMAIN: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  RESTAURANT_DISCOVERY_DEFAULT_RADIUS_KM: z.coerce.number().positive().default(5),
  RESTAURANT_DISCOVERY_MAX_RADIUS_KM: z.coerce.number().positive().default(10),
  DELIVERY_ASSIGNMENT_RADII_KM: z.string().default("2,3,5"),
  DELIVERY_ASSIGNMENT_OFFER_TTL_SECONDS: z.coerce.number().int().positive().default(45),
  DELIVERY_ASSIGNMENT_STALE_LOCATION_MINUTES: z.coerce.number().int().positive().default(10),
  DELIVERY_ASSIGNMENT_MAX_ACTIVE_ORDERS: z.coerce.number().int().positive().default(1),
  DELIVERY_ASSIGNMENT_MAX_BROADCAST_PARTNERS: z.coerce.number().int().positive().default(6),
  DELIVERY_ASSIGNMENT_REASSIGN_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(4),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid server environment variables", parsedEnv.error.flatten().fieldErrors);
  throw new Error("Environment validation failed");
}

export const env = {
  ...parsedEnv.data,
  isDevelopment: parsedEnv.data.NODE_ENV === "development",
  isProduction: parsedEnv.data.NODE_ENV === "production",
  isTest: parsedEnv.data.NODE_ENV === "test",
};
