import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../utils/app-error.js";
import { getPrismaRuntimeErrorResponse } from "../utils/prisma-runtime-errors.js";

const { JsonWebTokenError, TokenExpiredError } = jwt;

const isJsonBodySyntaxError = (error: unknown) =>
  error instanceof SyntaxError &&
  typeof error.message === "string" &&
  "body" in error;

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
          isJsonBodySyntaxError(error) ||
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

  if (isJsonBodySyntaxError(error)) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      code: "BAD_REQUEST",
      message: "Request body must be valid JSON",
    });
    return;
  }

  if (error instanceof ZodError) {
    const isAuthRequest = req.originalUrl.startsWith("/api/v1/auth/");
    const flattenedError = error.flatten();

    if (isAuthRequest) {
      const isLoginRequest = req.originalUrl === "/api/v1/auth/login";

      if (isLoginRequest) {
        const emailErrors = flattenedError.fieldErrors.email ?? [];
        const passwordErrors = flattenedError.fieldErrors.password ?? [];
        const hasMissingCredentials = [...emailErrors, ...passwordErrors].some((message) =>
          message.toLowerCase().includes("required"),
        );

        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          code: hasMissingCredentials ? "MISSING_CREDENTIALS" : "BAD_REQUEST",
          message: hasMissingCredentials ? "Email and password are required" : "Request validation failed",
          details: flattenedError,
        });
        return;
      }

      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        code: "BAD_REQUEST",
        message: "Request validation failed",
        details: flattenedError,
      });
      return;
    }

    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: flattenedError,
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

  const prismaRuntimeError = getPrismaRuntimeErrorResponse(error, {
    isDevelopment: env.isDevelopment,
  });

  if (prismaRuntimeError) {
    res.status(prismaRuntimeError.statusCode).json({
      success: false,
      code: prismaRuntimeError.code,
      message: prismaRuntimeError.message,
      details: prismaRuntimeError.details,
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
          ? "The database schema is out of date. Run `npm run prisma:push` and `npm run prisma:generate`, then restart the server."
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

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    code: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong on the server",
  });
};
