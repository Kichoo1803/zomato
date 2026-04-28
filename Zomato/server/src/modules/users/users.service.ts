import { Prisma } from "@prisma/client";
import { Role } from "../../constants/enums.js";
import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import {
  clearRegionalManagerAssignments,
  replaceRegionalManagerAssignments,
  resolveRegionIdForAssignment,
  syncRestaurantsRegionForOwner,
} from "../regions/regions.service.js";
import { notificationsService } from "../notifications/notifications.service.js";
import { AppError } from "../../utils/app-error.js";
import {
  areIndianPhoneNumbersEqual,
  getIndianPhoneSearchVariants,
  normalizeIndianPhoneNumber,
} from "../../utils/phone.js";

const userSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  regionId: true,
  opsState: true,
  opsDistrict: true,
  opsNotes: true,
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
  managedRegionIds?: number[];
  opsState?: string;
  opsDistrict?: string;
  opsNotes?: string;
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

const ensureAdminUserUniqueness = async (input: {
  email?: string;
  phone?: string;
  excludeUserId?: number;
}) => {
  const normalizedEmail = input.email?.trim();
  const normalizedPhone = normalizeIndianPhoneNumber(input.phone);
  const uniqueConditions = [
    ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
    ...getIndianPhoneSearchVariants(normalizedPhone).map((phone) => ({ phone })),
  ];

  if (!uniqueConditions.length) {
    return;
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: uniqueConditions,
      ...(input.excludeUserId
        ? {
            NOT: {
              id: input.excludeUserId,
            },
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      phone: true,
    },
  });

  if (!existingUser) {
    return;
  }

  const conflictsWithEmail = normalizedEmail && existingUser.email === normalizedEmail;
  const conflictsWithPhone = normalizedPhone && areIndianPhoneNumbersEqual(existingUser.phone, normalizedPhone);

  throw new AppError(
    StatusCodes.CONFLICT,
    conflictsWithEmail
      ? "An account with this email already exists"
      : conflictsWithPhone
        ? "An account with this phone number already exists"
        : "An account with these details already exists",
    "ACCOUNT_ALREADY_EXISTS",
  );
};

const assertRegionalManagerAssignmentInput = (input: {
  role: Role;
  isActive: boolean;
  managedRegionIds?: number[];
}) => {
  if (input.managedRegionIds === undefined) {
    return;
  }

  if (input.role !== Role.REGIONAL_MANAGER) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Region assignments can only be managed for regional manager accounts",
      "INVALID_REGION_MANAGER_ROLE",
    );
  }

  if (!input.isActive && input.managedRegionIds.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Inactive regional manager accounts cannot keep assigned regions",
      "REGIONAL_MANAGER_INACTIVE",
    );
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
    const normalizedPhone = normalizeIndianPhoneNumber(input.phone);

    await ensureAdminUserUniqueness({
      email: input.email,
      phone: normalizedPhone,
    });

    assertRegionalManagerAssignmentInput({
      role: input.role,
      isActive: input.isActive ?? true,
      managedRegionIds: input.managedRegionIds,
    });

    const passwordHash = await bcrypt.hash(input.password, 12);
    const region =
      input.role === Role.REGIONAL_MANAGER
        ? null
        : await resolveRegionIdForAssignment(prisma, input.opsState, input.opsDistrict);

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          phone: normalizedPhone,
          passwordHash,
          role: input.role,
          regionId: region?.id ?? null,
          opsState: input.role === Role.REGIONAL_MANAGER ? null : input.opsState?.trim() || null,
          opsDistrict: input.role === Role.REGIONAL_MANAGER ? null : input.opsDistrict?.trim() || null,
          opsNotes: input.opsNotes?.trim() || null,
          profileImage: input.profileImage,
          walletBalance: input.walletBalance ?? 0,
          isActive: input.isActive ?? true,
          emailVerified: input.emailVerified ?? false,
          phoneVerified: input.phoneVerified ?? false,
        },
        select: {
          id: true,
        },
      });

      if (input.role === Role.REGIONAL_MANAGER && input.managedRegionIds !== undefined) {
        await replaceRegionalManagerAssignments(tx, user.id, input.managedRegionIds);
      }

      return tx.user.findUniqueOrThrow({
        where: {
          id: user.id,
        },
        select: userSelect,
      });
    });
  },

  async updateByAdmin(userId: number, input: Partial<AdminUserInput>) {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    });

    if (!existingUser) {
      throw new AppError(StatusCodes.NOT_FOUND, "User not found", "USER_NOT_FOUND");
    }

    const normalizedPhone =
      input.phone !== undefined ? normalizeIndianPhoneNumber(input.phone) : undefined;

    await ensureAdminUserUniqueness({
      email: input.email,
      phone: normalizedPhone,
      excludeUserId: userId,
    });

    const nextRole = (input.role ?? existingUser.role) as Role;
    const nextIsActive = input.isActive ?? existingUser.isActive;

    assertRegionalManagerAssignmentInput({
      role: nextRole,
      isActive: nextIsActive,
      managedRegionIds: input.managedRegionIds,
    });

    const nextState = input.opsState !== undefined ? input.opsState : undefined;
    const nextDistrict = input.opsDistrict !== undefined ? input.opsDistrict : undefined;
    const shouldRecalculateRegion =
      nextRole !== Role.REGIONAL_MANAGER &&
      (input.opsState !== undefined || input.opsDistrict !== undefined);

    const region = shouldRecalculateRegion
      ? await resolveRegionIdForAssignment(prisma, nextState ?? null, nextDistrict ?? null)
      : null;
    const shouldClearManagedRegions =
      existingUser.role === Role.REGIONAL_MANAGER &&
      (nextRole !== Role.REGIONAL_MANAGER || !nextIsActive);
    const shouldInitializeRegionalManagerScope =
      nextRole === Role.REGIONAL_MANAGER &&
      existingUser.role !== Role.REGIONAL_MANAGER &&
      input.managedRegionIds === undefined;

    return prisma.$transaction(async (tx) => {
      if (shouldClearManagedRegions) {
        await clearRegionalManagerAssignments(tx, userId);
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.phone !== undefined ? { phone: normalizedPhone } : {}),
          ...(input.password !== undefined ? { passwordHash: await bcrypt.hash(input.password, 12) } : {}),
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(nextRole !== Role.REGIONAL_MANAGER && input.opsState !== undefined
            ? { opsState: input.opsState?.trim() || null }
            : {}),
          ...(nextRole !== Role.REGIONAL_MANAGER && input.opsDistrict !== undefined
            ? { opsDistrict: input.opsDistrict?.trim() || null }
            : {}),
          ...(input.opsNotes !== undefined ? { opsNotes: input.opsNotes?.trim() || null } : {}),
          ...(shouldRecalculateRegion ? { regionId: region?.id ?? null } : {}),
          ...(input.profileImage !== undefined ? { profileImage: input.profileImage } : {}),
          ...(input.walletBalance !== undefined ? { walletBalance: input.walletBalance } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.emailVerified !== undefined ? { emailVerified: input.emailVerified } : {}),
          ...(input.phoneVerified !== undefined ? { phoneVerified: input.phoneVerified } : {}),
        },
      });

      if (
        shouldRecalculateRegion &&
        (existingUser.role === Role.RESTAURANT_OWNER || nextRole === Role.RESTAURANT_OWNER)
      ) {
        await syncRestaurantsRegionForOwner(tx, userId, region?.id ?? null);
      }

      if (nextRole === Role.REGIONAL_MANAGER) {
        if (input.managedRegionIds !== undefined) {
          await replaceRegionalManagerAssignments(tx, userId, input.managedRegionIds);
        } else if (shouldInitializeRegionalManagerScope) {
          await clearRegionalManagerAssignments(tx, userId);
        }
      }

      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: userSelect,
      });
    });
  },

  async deactivate(actorId: number, userId: number) {
    if (actorId === userId) {
      throw new AppError(StatusCodes.BAD_REQUEST, "You cannot disable your own account", "SELF_DISABLE_FORBIDDEN");
    }

    return prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          role: true,
        },
      });

      if (!targetUser) {
        throw new AppError(StatusCodes.NOT_FOUND, "User not found", "USER_NOT_FOUND");
      }

      if (targetUser.role === Role.REGIONAL_MANAGER) {
        await clearRegionalManagerAssignments(tx, userId);
      }

      return tx.user.update({
        where: { id: userId },
        data: {
          isActive: false,
        },
        select: userSelect,
      });
    });
  },

  async updateProfile(userId: number, input: { fullName?: string; phone?: string; profileImage?: string }) {
    const normalizedPhone =
      input.phone !== undefined ? normalizeIndianPhoneNumber(input.phone) : undefined;

    await ensureAdminUserUniqueness({
      phone: normalizedPhone,
      excludeUserId: userId,
    });

    return prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.phone !== undefined ? { phone: normalizedPhone } : {}),
        ...(input.profileImage !== undefined ? { profileImage: input.profileImage } : {}),
      },
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
