import type { CorsOptions } from "cors";
import { getAllowedClientOrigins, isAllowedClientOrigin } from "./client-origins.js";

export const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (isAllowedClientOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin is not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Request-Id"],
};

export const allowedClientOrigins = getAllowedClientOrigins();
