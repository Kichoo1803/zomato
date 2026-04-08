import { Prisma } from "@prisma/client";
import { Role } from "../../constants/enums.js";
import { prisma } from "../../lib/prisma.js";

const userSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  profileImage: true,
  isActive: true,
  emailVerified: true,
  phoneVerified: true,
  walletBalance: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const usersService = {
  async list(role?: Role) {
    return prisma.user.findMany({
      where: role ? { role } : undefined,
      select: userSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async updateProfile(userId: number, input: { fullName?: string; phone?: string; profileImage?: string }) {
    return prisma.user.update({
      where: { id: userId },
      data: input,
      select: userSelect,
    });
  },
};
