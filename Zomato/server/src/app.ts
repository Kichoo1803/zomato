import crypto from "node:crypto";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { corsOptions } from "./config/cors.js";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { notFoundHandler } from "./middlewares/not-found.middleware.js";
import { loggerStream } from "./lib/logger.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.set("trust proxy", 1);

app.use((req, res, next) => {
  const requestId = req.header("x-request-id") ?? crypto.randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
app.use(cors(corsOptions));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(
  morgan(env.isProduction ? "combined" : "dev", {
    stream: loggerStream,
  }),
);

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to the Zomato Luxe API",
  });
});

app.use("/api/v1", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
