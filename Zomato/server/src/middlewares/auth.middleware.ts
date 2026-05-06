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
  try {
    const didAttachUser = attachUserFromToken(req);

    if (!didAttachUser) {
      next(new AppError(StatusCodes.UNAUTHORIZED, "Authentication required", "AUTH_REQUIRED"));
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

const assignAuthenticatedUser = (
  req: Parameters<RequestHandler>[0],
  email: string,
  role: Role,
  userId: number,
) => {
  req.user = {
    id: userId,
    email,
    role,
  };
};

const attachUserFromToken = (req: Parameters<RequestHandler>[0]) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return false;
  }

  const payload = verifyAccessToken(token);
  const normalizedRole = normalizeRoleValue(payload.role);

  if (!normalizedRole) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid access token", "INVALID_ACCESS_TOKEN");
  }

  assignAuthenticatedUser(req, payload.email, normalizedRole, Number(payload.sub));
  return true;
};

export const optionalAuth: RequestHandler = (req, _res, next) => {
  try {
    attachUserFromToken(req);
    next();
  } catch (error) {
    next(error);
  }
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
