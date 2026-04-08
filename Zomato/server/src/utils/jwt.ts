import { Role } from "../constants/enums.js";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: Role;
  type: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  sessionId: string;
  type: "refresh";
};

export const generateAccessToken = (user: { id: number; email: string; role: Role }) => {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role,
      type: "access",
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"] },
  );
};

export const generateRefreshToken = (userId: number, sessionId: string) => {
  return jwt.sign(
    {
      sub: String(userId),
      sessionId,
      type: "refresh",
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"] },
  );
};

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
