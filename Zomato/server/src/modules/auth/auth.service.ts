import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { Role } from "../../constants/enums.js";
import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { sendMail } from "../../lib/mailer.js";
import { AppError } from "../../utils/app-error.js";
import { durationToMs } from "../../utils/cookies.js";
import { hashValue } from "../../utils/hash.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";

const publicUserSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  profileImage: true,
  role: true,
  membershipTier: true,
  membershipStatus: true,
  membershipStartedAt: true,
  membershipExpiresAt: true,
  isActive: true,
  emailVerified: true,
  phoneVerified: true,
  walletBalance: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const authUserSelect = {
  ...publicUserSelect,
  passwordHash: true,
} satisfies Prisma.UserSelect;

type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
type AuthUser = Prisma.UserGetPayload<{ select: typeof authUserSelect }>;

type SessionMeta = {
  userAgent?: string;
  ipAddress?: string;
  origin?: string;
};

const createSession = async (user: PublicUser, meta?: SessionMeta) => {
  const refreshToken = generateRefreshToken(user.id, crypto.randomUUID());
  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role as Role,
  });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashValue(refreshToken),
      userAgent: meta?.userAgent?.slice(0, 255),
      ipAddress: meta?.ipAddress?.slice(0, 64),
      expiresAt: new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN)),
    },
  });

  return {
    accessToken,
    refreshToken,
  };
};

function ensureActiveUser<T extends { isActive: boolean }>(user: T | null): asserts user is T {
  if (!user) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  if (!user.isActive) {
    throw new AppError(StatusCodes.FORBIDDEN, "Your account is currently disabled", "ACCOUNT_DISABLED");
  }
}

export const authService = {
  async register(
    input: {
      fullName: string;
      email: string;
      phone?: string;
      password: string;
      role: Role;
    },
    meta?: SessionMeta,
  ) {
    const email = input.email.trim().toLowerCase();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, ...(input.phone ? [{ phone: input.phone }] : [])],
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "An account with these details already exists",
        "ACCOUNT_ALREADY_EXISTS",
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        fullName: input.fullName,
        email,
        phone: input.phone,
        passwordHash,
        role: input.role,
        emailVerified: false,
        phoneVerified: false,
      },
      select: publicUserSelect,
    });

    void sendMail({
      to: user.email,
      subject: "Welcome to Zomato Luxe",
      html: `<p>Hi ${user.fullName}, your Zomato Luxe account is ready. You can now explore restaurants, offers, and live order tracking.</p>`,
      text: `Hi ${user.fullName}, your Zomato Luxe account is ready.`,
    }).catch((error) => {
      logger.warn("Welcome email failed to send", {
        userId: user.id,
        error: error instanceof Error ? error.message : "Unknown mailer error",
      });
    });

    const session = await createSession(user, meta);

    return {
      user,
      ...session,
    };
  },

  async login(input: { email: string; password: string }, meta?: SessionMeta) {
    const email = input.email.trim().toLowerCase();

    logger.info("Login attempt received", {
      email,
      ipAddress: meta?.ipAddress,
      origin: meta?.origin,
    });

    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: authUserSelect,
      });

      logger.info("Login user lookup completed", {
        email,
        userFound: Boolean(user),
      });

      ensureActiveUser(user);

      const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
      logger.info("Login password verification completed", {
        email,
        userId: user.id,
        isPasswordValid,
      });

      if (!isPasswordValid) {
        throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid credentials", "INVALID_CREDENTIALS");
      }

      const { passwordHash: _passwordHash, ...safeUser } = user;

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const session = await createSession(safeUser, meta);
      logger.info("Login session created", {
        userId: safeUser.id,
        email,
      });

      logger.info("Login successful", {
        userId: safeUser.id,
        email,
        role: safeUser.role,
        ipAddress: meta?.ipAddress,
        origin: meta?.origin,
      });

      return {
        user: safeUser,
        ...session,
      };
    } catch (error) {
      if (error instanceof AppError) {
        logger.warn("Login request rejected", {
          email,
          code: error.code,
          statusCode: error.statusCode,
          ipAddress: meta?.ipAddress,
          origin: meta?.origin,
        });
        throw error;
      }

      logger.error("Unexpected login failure", {
        email,
        ipAddress: meta?.ipAddress,
        origin: meta?.origin,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw new AppError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "The server couldn't complete sign-in right now. Please try again in a moment.",
        "LOGIN_FAILED",
      );
    }
  },

  async refresh(refreshToken: string, meta?: SessionMeta) {
    const payload = verifyRefreshToken(refreshToken);

    if (payload.type !== "refresh") {
      throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashValue(refreshToken) },
      include: {
        user: {
          select: publicUserSelect,
        },
      },
    });

    if (!storedToken || storedToken.userId !== Number(payload.sub)) {
      throw new AppError(StatusCodes.UNAUTHORIZED, "Refresh session not found", "INVALID_REFRESH_TOKEN");
    }

    if (storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new AppError(StatusCodes.UNAUTHORIZED, "Refresh session has expired", "EXPIRED_REFRESH_TOKEN");
    }

    ensureActiveUser(storedToken.user);

    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const session = await createSession(storedToken.user, meta);

    return {
      user: storedToken.user,
      ...session,
    };
  },

  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return;
    }

    await prisma.refreshToken.updateMany({
      where: {
        tokenHash: hashValue(refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  },

  async getProfile(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });

    ensureActiveUser(user);

    return user;
  },
};
