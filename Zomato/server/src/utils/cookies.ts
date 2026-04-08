import type { CookieOptions } from "express";
import { env } from "../config/env.js";

export const durationToMs = (duration: string) => {
  const match = duration.trim().match(/^(\d+)([smhd])$/i);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
    default:
      return amount * 24 * 60 * 60 * 1000;
  }
};

export const REFRESH_COOKIE_NAME = "zl_refresh_token";

export const getRefreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? "none" : "lax",
  domain: env.COOKIE_DOMAIN || undefined,
  path: "/",
  maxAge: durationToMs(env.JWT_REFRESH_EXPIRES_IN),
});

export const getClearRefreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? "none" : "lax",
  domain: env.COOKIE_DOMAIN || undefined,
  path: "/",
});
