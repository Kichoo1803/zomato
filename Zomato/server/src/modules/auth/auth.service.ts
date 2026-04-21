import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
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
import { getPrismaRuntimeErrorResponse } from "../../utils/prisma-runtime-errors.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";
import { normalizeRoleValue } from "../../utils/roles.js";

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

type AuthDebugContext = {
  label: "login";
  email: string;
  requestStartedAt: number;
  meta?: SessionMeta;
};

const genericLoginFailureMessage = "The server couldn't complete sign-in right now. Please try again in a moment.";
const getDurationMs = (startedAt: number) => Number((performance.now() - startedAt).toFixed(1));

const getNormalizedUserRole = (role?: string | null) => {
  const normalizedRole = normalizeRoleValue(role);

  if (!normalizedRole) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "This account has an unsupported role configuration",
      "INVALID_ACCOUNT_ROLE",
    );
  }

  return normalizedRole;
};

const normalizePublicUser = (user: PublicUser) => ({
  ...user,
  role: getNormalizedUserRole(user.role),
});

const getAuthDebugLogContext = (
  debugContext: AuthDebugContext | undefined,
  {
    userId,
    stepStartedAt,
    extra,
  }: {
    userId?: number;
    stepStartedAt?: number;
    extra?: Record<string, unknown>;
  } = {},
) => ({
  email: debugContext?.email,
  ...(userId !== undefined ? { userId } : {}),
  ipAddress: debugContext?.meta?.ipAddress,
  origin: debugContext?.meta?.origin,
  ...(stepStartedAt !== undefined ? { stepDurationMs: getDurationMs(stepStartedAt) } : {}),
  ...(debugContext ? { totalDurationMs: getDurationMs(debugContext.requestStartedAt) } : {}),
  ...(extra ?? {}),
});

const getLoginServerError = (error: unknown) => {
  const prismaRuntimeError = getPrismaRuntimeErrorResponse(error, {
    isDevelopment: env.isDevelopment,
    fallbackMessage: genericLoginFailureMessage,
  });

  if (prismaRuntimeError) {
    return new AppError(
      prismaRuntimeError.statusCode,
      prismaRuntimeError.message,
      prismaRuntimeError.code,
      prismaRuntimeError.details,
    );
  }

  return new AppError(StatusCodes.INTERNAL_SERVER_ERROR, genericLoginFailureMessage, "LOGIN_FAILED");
};

const createSession = async (user: ReturnType<typeof normalizePublicUser>, meta?: SessionMeta, debugContext?: AuthDebugContext) => {
  const tokenGenerationStartedAt = performance.now();
  if (debugContext?.label === "login") {
    logger.info("Login token generation started", getAuthDebugLogContext(debugContext, { userId: user.id }));
  }

  const refreshToken = generateRefreshToken(user.id, crypto.randomUUID());
  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  if (debugContext?.label === "login") {
    logger.info(
      "Login token generation completed",
      getAuthDebugLogContext(debugContext, {
        userId: user.id,
        stepStartedAt: tokenGenerationStartedAt,
      }),
    );
  }

  const sessionSaveStartedAt = performance.now();
  if (debugContext?.label === "login") {
    logger.info("Login refresh session save started", getAuthDebugLogContext(debugContext, { userId: user.id }));
  }

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashValue(refreshToken),
      userAgent: meta?.userAgent?.slice(0, 255),
      ipAddress: meta?.ipAddress?.slice(0, 64),
      expiresAt: new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN)),
    },
  });

  if (debugContext?.label === "login") {
    logger.info(
      "Login refresh session save completed",
      getAuthDebugLogContext(debugContext, {
        userId: user.id,
        stepStartedAt: sessionSaveStartedAt,
      }),
    );
  }

  return {
    accessToken,
    refreshToken,
  };
};

function ensureLoginEligibleUser<T extends { isActive: boolean }>(user: T | null): asserts user is T {
  if (!user) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Account not found", "ACCOUNT_NOT_FOUND");
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
    const normalizedUser = normalizePublicUser(user);

    void sendMail({
      to: normalizedUser.email,
      subject: "Welcome to Zomato Luxe",
      html: `<p>Hi ${normalizedUser.fullName}, your Zomato Luxe account is ready. You can now explore restaurants, offers, and live order tracking.</p>`,
      text: `Hi ${normalizedUser.fullName}, your Zomato Luxe account is ready.`,
    }).catch((error) => {
      logger.warn("Welcome email failed to send", {
        userId: normalizedUser.id,
        error: error instanceof Error ? error.message : "Unknown mailer error",
      });
    });

    const session = await createSession(normalizedUser, meta);

    return {
      user: normalizedUser,
      ...session,
    };
  },

  async login(input: { email: string; password: string }, meta?: SessionMeta) {
    const loginStartedAt = performance.now();
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input.password === "string" ? input.password : "";
    const debugContext: AuthDebugContext = {
      label: "login",
      email,
      requestStartedAt: loginStartedAt,
      meta,
    };

    logger.info("Login request received", getAuthDebugLogContext(debugContext));

    try {
      const validationStartedAt = performance.now();
      logger.info("Login validation started", getAuthDebugLogContext(debugContext));

      if (!email || !password.trim()) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Email and password are required", "MISSING_CREDENTIALS");
      }

      logger.info(
        "Login validation completed",
        getAuthDebugLogContext(debugContext, {
          stepStartedAt: validationStartedAt,
        }),
      );

      const userLookupStartedAt = performance.now();
      logger.info("Login user lookup started", getAuthDebugLogContext(debugContext));
      const user = await prisma.user.findUnique({
        where: { email },
        select: authUserSelect,
      });

      logger.info(
        "Login user lookup completed",
        getAuthDebugLogContext(debugContext, {
          stepStartedAt: userLookupStartedAt,
          extra: {
            userFound: Boolean(user),
          },
        }),
      );

      ensureLoginEligibleUser(user);

      const passwordCompareStartedAt = performance.now();
      logger.info("Login password compare started", getAuthDebugLogContext(debugContext, { userId: user.id }));

      if (typeof user.passwordHash !== "string" || !user.passwordHash) {
        logger.warn(
          "Login password hash missing",
          getAuthDebugLogContext(debugContext, {
            userId: user.id,
            stepStartedAt: passwordCompareStartedAt,
          }),
        );
        throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid email or password", "INVALID_CREDENTIALS");
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      logger.info(
        "Login password compare completed",
        getAuthDebugLogContext(debugContext, {
          userId: user.id,
          stepStartedAt: passwordCompareStartedAt,
          extra: {
            isPasswordValid,
          },
        }),
      );

      if (!isPasswordValid) {
        throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid email or password", "INVALID_CREDENTIALS");
      }

      const lastLoginUpdateStartedAt = performance.now();
      logger.info("Login last-login update started", getAuthDebugLogContext(debugContext, { userId: user.id }));
      const safeUser = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
        select: publicUserSelect,
      });
      const normalizedUser = normalizePublicUser(safeUser);
      logger.info(
        "Login last-login update completed",
        getAuthDebugLogContext(debugContext, {
          userId: normalizedUser.id,
          stepStartedAt: lastLoginUpdateStartedAt,
        }),
      );

      const session = await createSession(normalizedUser, meta, debugContext);
      logger.info("Login session created", getAuthDebugLogContext(debugContext, { userId: normalizedUser.id }));

      logger.info(
        "Login successful",
        getAuthDebugLogContext(debugContext, {
          userId: normalizedUser.id,
          extra: {
            role: normalizedUser.role,
          },
        }),
      );

      return {
        user: normalizedUser,
        ...session,
      };
    } catch (error) {
      if (error instanceof AppError) {
        logger.warn(
          "Login request rejected",
          getAuthDebugLogContext(debugContext, {
            extra: {
              code: error.code,
              statusCode: error.statusCode,
            },
          }),
        );
        throw error;
      }

      logger.error("Unexpected login failure", {
        email,
        ipAddress: meta?.ipAddress,
        origin: meta?.origin,
        totalDurationMs: getDurationMs(loginStartedAt),
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw getLoginServerError(error);
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

    ensureLoginEligibleUser(storedToken.user);

    const normalizedUser = normalizePublicUser(storedToken.user);

    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const session = await createSession(normalizedUser, meta);

    return {
      user: normalizedUser,
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

    ensureLoginEligibleUser(user);

    return normalizePublicUser(user);
  },
};
