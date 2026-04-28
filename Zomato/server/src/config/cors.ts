import type { CorsOptions } from "cors";
import { getAllowedClientOrigins, isAllowedClientOrigin } from "./client-origins.js";

export const isCorsOriginAllowed = (origin?: string | null) => {
  // allow Postman / curl / same-server requests with no origin
  if (!origin) {
    return true;
  }

  return isAllowedClientOrigin(origin);
};

export const validateCorsOrigin: CorsOptions["origin"] = (origin, callback) => {
  if (isCorsOriginAllowed(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error("Origin is not allowed by CORS"));
};

export const corsOptions: CorsOptions = {
  credentials: true,
  origin: validateCorsOrigin,

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Request-Id",
  ],
};

export const allowedClientOrigins = getAllowedClientOrigins();
