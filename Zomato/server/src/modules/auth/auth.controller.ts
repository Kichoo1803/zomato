import type { Request } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../../utils/app-error.js";
import { getClearRefreshCookieOptions, getRefreshCookieOptions, REFRESH_COOKIE_NAME } from "../../utils/cookies.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { authService } from "./auth.service.js";

const getSessionMeta = (req: Request) => ({
  userAgent: req.get("user-agent") ?? undefined,
  ipAddress: req.ip,
});

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, getSessionMeta(req));

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: "Account created successfully",
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, getSessionMeta(req));

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

  return sendSuccess(res, {
    message: "Login successful",
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;
  if (!refreshToken) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Refresh token cookie is missing", "REFRESH_TOKEN_MISSING");
  }

  const result = await authService.refresh(refreshToken ?? "", getSessionMeta(req));

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

  return sendSuccess(res, {
    message: "Token refreshed successfully",
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;

  await authService.logout(refreshToken);
  res.clearCookie(REFRESH_COOKIE_NAME, getClearRefreshCookieOptions());

  return sendSuccess(res, {
    message: "Logged out successfully",
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user!.id);

  return sendSuccess(res, {
    message: "Profile fetched successfully",
    data: { user },
  });
});
