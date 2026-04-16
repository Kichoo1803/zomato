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

  logger.error(error.message, {
    path: req.originalUrl,
    method: req.method,
    stack: env.isProduction ? undefined : error.stack,
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
    const statusCode =
      error.code === "P2002" ? StatusCodes.CONFLICT : StatusCodes.BAD_REQUEST;

    res.status(statusCode).json({
      success: false,
      code: error.code,
      message:
        error.code === "P2002"
          ? "A unique field conflict occurred"
          : "A database request failed",
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
