import { Role } from "../constants/enums.js";
import type { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/app-error.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { normalizeRoleValue } from "../utils/roles.js";

const extractBearerToken = (authorizationHeader?: string) => {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice(7).trim();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    next(new AppError(StatusCodes.UNAUTHORIZED, "Authentication required", "AUTH_REQUIRED"));
    return;
  }

  const payload = verifyAccessToken(token);
  const normalizedRole = normalizeRoleValue(payload.role);

  if (!normalizedRole) {
    next(new AppError(StatusCodes.UNAUTHORIZED, "Invalid access token", "INVALID_ACCESS_TOKEN"));
    return;
  }

  req.user = {
    id: Number(payload.sub),
    email: payload.email,
    role: normalizedRole,
  };

  next();
};

export const authorize = (...roles: Role[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) {
      next(new AppError(StatusCodes.UNAUTHORIZED, "Authentication required", "AUTH_REQUIRED"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED"));
      return;
    }

    next();
  };
};
