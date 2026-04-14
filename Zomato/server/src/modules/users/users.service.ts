import { Prisma } from "@prisma/client";
import { Role } from "../../constants/enums.js";
import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { notificationsService } from "../notifications/notifications.service.js";
import { AppError } from "../../utils/app-error.js";

const userSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  profileImage: true,
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

type AdminUserInput = {
  fullName: string;
  email: string;
  phone?: string;
  password?: string;
  role: Role;
  profileImage?: string;
  walletBalance?: number;
  isActive?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
};

const paidMembershipTiers = new Set(["GOLD", "PLATINUM"]);
const membershipTierRanks = {
  CLASSIC: 0,
  GOLD: 1,
  PLATINUM: 2,
} as const;

const getMembershipTierRank = (tier?: string | null) => {
  const normalizedTier = tier?.trim().toUpperCase();

  if (normalizedTier && normalizedTier in membershipTierRanks) {
    return membershipTierRanks[normalizedTier as keyof typeof membershipTierRanks];
  }

  return membershipTierRanks.CLASSIC;
};

const getMembershipTierLabel = (tier: "CLASSIC" | "GOLD" | "PLATINUM") => {
  switch (tier) {
    case "PLATINUM":
      return "Luxe Circle Platinum";
    case "GOLD":
      return "Luxe Circle Gold";
    case "CLASSIC":
    default:
      return "Luxe Circle Classic";
  }
};

export const usersService = {
  async list(filters?: { role?: Role; search?: string; isActive?: boolean }) {
    const search = filters?.search?.trim();

    return prisma.user.findMany({
      where: {
        ...(filters?.role ? { role: filters.role } : {}),
        ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
        ...(search
          ? {
              OR: [
                { fullName: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      select: userSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async getById(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });

    if (!user) {
      throw new AppError(StatusCodes.NOT_FOUND, "User not found", "USER_NOT_FOUND");
    }

    return user;
  },

  async create(input: AdminUserInput & { password: string }) {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: input.email }, ...(input.phone ? [{ phone: input.phone }] : [])],
      },
      select: { id: true },
    });

    if (existingUser) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "An account with these details already exists",
        "ACCOUNT_ALREADY_EXISTS",
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    return prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: input.role,
        profileImage: input.profileImage,
        walletBalance: input.walletBalance ?? 0,
        isActive: input.isActive ?? true,
        emailVerified: input.emailVerified ?? false,
        phoneVerified: input.phoneVerified ?? false,
      },
      select: userSelect,
    });
  },

  async updateByAdmin(userId: number, input: Partial<AdminUserInput>) {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existingUser) {
      throw new AppError(StatusCodes.NOT_FOUND, "User not found", "USER_NOT_FOUND");
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.password !== undefined ? { passwordHash: await bcrypt.hash(input.password, 12) } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.profileImage !== undefined ? { profileImage: input.profileImage } : {}),
        ...(input.walletBalance !== undefined ? { walletBalance: input.walletBalance } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.emailVerified !== undefined ? { emailVerified: input.emailVerified } : {}),
        ...(input.phoneVerified !== undefined ? { phoneVerified: input.phoneVerified } : {}),
      },
      select: userSelect,
    });
  },

  async deactivate(actorId: number, userId: number) {
    if (actorId === userId) {
      throw new AppError(StatusCodes.BAD_REQUEST, "You cannot disable your own account", "SELF_DISABLE_FORBIDDEN");
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
      },
      select: userSelect,
    });
  },

  async updateProfile(userId: number, input: { fullName?: string; phone?: string; profileImage?: string }) {
    return prisma.user.update({
      where: { id: userId },
      data: input,
      select: userSelect,
    });
  },

  async updateMembership(
    actor: { id: number; role: Role },
    input: {
      tier: "CLASSIC" | "GOLD" | "PLATINUM";
      paymentMode?: "CARD" | "UPI";
      paymentMethodId?: number;
    },
  ) {
    if (actor.role !== Role.CUSTOMER) {
      throw new AppError(StatusCodes.FORBIDDEN, "Only customers can upgrade membership", "ACCESS_DENIED");
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        membershipTier: true,
      },
    });

    if (!existingUser) {
      throw new AppError(StatusCodes.NOT_FOUND, "User not found", "USER_NOT_FOUND");
    }

    const currentTierRank = getMembershipTierRank(existingUser.membershipTier);
    const targetTierRank = getMembershipTierRank(input.tier);
    const isTargetPaidPlan = paidMembershipTiers.has(input.tier);

    if (targetTierRank < currentTierRank) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "Downgrade is not allowed from the upgrade flow",
        "MEMBERSHIP_DOWNGRADE_NOT_ALLOWED",
      );
    }

    if (targetTierRank === currentTierRank) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "You are already on this plan",
        "MEMBERSHIP_ALREADY_ACTIVE",
      );
    }

    if (isTargetPaidPlan) {
      if (!input.paymentMode) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          "Select a payment mode before continuing",
          "PAYMENT_MODE_REQUIRED",
        );
      }

      if (!input.paymentMethodId) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          "Add a payment method to upgrade this plan",
          "PAYMENT_METHOD_REQUIRED",
        );
      }

      const paymentMethod = await prisma.savedPaymentMethod.findFirst({
        where: {
          id: input.paymentMethodId,
          userId: actor.id,
        },
        select: {
          id: true,
          type: true,
        },
      });

      if (!paymentMethod) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          "Select a valid saved card or UPI ID before continuing",
          "PAYMENT_METHOD_INVALID",
        );
      }

      if (paymentMethod.type !== input.paymentMode) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          "Selected payment details do not match the chosen payment mode",
          "PAYMENT_METHOD_MODE_MISMATCH",
        );
      }
    }

    if (input.tier === "CLASSIC") {
      const updatedUser = await prisma.user.update({
        where: { id: actor.id },
        data: {
          membershipTier: input.tier,
          membershipStatus: "ACTIVE",
          membershipStartedAt: null,
          membershipExpiresAt: null,
        },
        select: userSelect,
      });

      await notificationsService.createForUser({
        userId: actor.id,
        title: "Membership updated",
        message: `Your membership has been switched to ${getMembershipTierLabel(input.tier)}.`,
        meta: {
          eventKey: "customer:membership-updated",
          membershipTier: input.tier,
          path: "/membership",
        },
        dedupeWindowMinutes: 30,
      });

      return updatedUser;
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    const updatedUser = await prisma.user.update({
      where: { id: actor.id },
      data: {
        membershipTier: input.tier,
        membershipStatus: "ACTIVE",
        membershipStartedAt: startedAt,
        membershipExpiresAt: expiresAt,
      },
      select: userSelect,
    });

    await notificationsService.createForUser({
      userId: actor.id,
      title: "Membership updated",
      message: `You are now on ${getMembershipTierLabel(input.tier)} until ${expiresAt.toLocaleDateString("en-IN")}.`,
      meta: {
        eventKey: "customer:membership-updated",
        membershipTier: input.tier,
        membershipExpiresAt: expiresAt.toISOString(),
        path: "/membership",
      },
      dedupeWindowMinutes: 30,
    });

    return updatedUser;
  },
};
