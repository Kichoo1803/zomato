import type { CorsOptions } from "cors";
import { env } from "./env.js";

const allowedOrigins = Array.from(
  new Set([env.CLIENT_URL, "http://localhost:5173", "http://127.0.0.1:5173"].filter(Boolean)),
);

export const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Request-Id"],
};
