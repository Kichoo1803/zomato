import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../utils/app-error.js";

const { JsonWebTokenError, TokenExpiredError } = jwt;

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const logLevel =
    error instanceof AppError
      ? error.statusCode >= StatusCodes.INTERNAL_SERVER_ERROR
        ? "error"
        : "warn"
      : error instanceof ZodError ||
          error instanceof TokenExpiredError ||
          error instanceof JsonWebTokenError
        ? "warn"
        : error instanceof Prisma.PrismaClientKnownRequestError
          ? ["P2002"].includes(error.code)
            ? "warn"
            : "error"
          : error instanceof Prisma.PrismaClientInitializationError ||
              error instanceof Prisma.PrismaClientValidationError
            ? "error"
            : "error";

  logger[logLevel](error.message, {
    path: req.originalUrl,
    method: req.method,
    stack: env.isProduction ? undefined : error instanceof Error ? error.stack : undefined,
  });

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return;
  }

  if (error instanceof Error && error.message === "Origin is not allowed by CORS") {
    res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      code: "CORS_NOT_ALLOWED",
      message: "This frontend origin is not allowed to access the API",
    });
    return;
  }

  if (error instanceof ZodError) {
    const isAuthRequest = req.originalUrl.startsWith("/api/v1/auth/");

    if (isAuthRequest) {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        code: "BAD_REQUEST",
        message: "Request validation failed",
        details: error.flatten(),
      });
      return;
    }

    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: error.flatten(),
    });
    return;
  }

  if (error instanceof TokenExpiredError) {
    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      code: "TOKEN_EXPIRED",
      message: "Authentication token has expired",
    });
    return;
  }

  if (error instanceof JsonWebTokenError) {
    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      code: "INVALID_TOKEN",
      message: "Authentication token is invalid",
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(StatusCodes.CONFLICT).json({
        success: false,
        code: error.code,
        message: "A unique field conflict occurred",
        details: error.meta,
      });
      return;
    }

    if (["P2021", "P2022"].includes(error.code)) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: error.code,
        message: env.isDevelopment
          ? "The database schema is out of date. Run `npm run prisma:sync` for local SQLite development, or `npm run prisma:migrate:deploy` for a migrated deployment target, then restart the server."
          : "A database request failed",
        details: env.isDevelopment ? error.meta : undefined,
      });
      return;
    }

    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      code: error.code,
      message: "A database request failed",
      details: error.meta,
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      code: "DATABASE_CONNECTION_FAILED",
      message: env.isDevelopment
        ? "The server could not connect to the database. Check DATABASE_URL and make sure the database is reachable."
        : "A database request failed",
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      code: "PRISMA_CLIENT_OUT_OF_SYNC",
      message: env.isDevelopment
        ? "The Prisma client is out of sync with the schema. Run `npm run prisma:generate` and restart the server."
        : "A database request failed",
    });
    return;
  }

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    code: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong on the server",
  });
};
