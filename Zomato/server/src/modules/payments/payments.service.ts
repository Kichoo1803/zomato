import { Prisma } from "@prisma/client";
import { PaymentMethod, Role } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";

const savedPaymentMethodSelect = {
  id: true,
  type: true,
  label: true,
  holderName: true,
  maskedEnding: true,
  expiryMonth: true,
  expiryYear: true,
  upiId: true,
  isPrimary: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SavedPaymentMethodSelect;

type SavedCardPaymentMethodInput = {
  type: typeof PaymentMethod.CARD;
  label: string;
  holderName: string;
  maskedEnding: string;
  expiryMonth: string;
  expiryYear: string;
  isPrimary?: boolean;
};

type SavedUpiPaymentMethodInput = {
  type: typeof PaymentMethod.UPI;
  label?: string;
  upiId: string;
  isPrimary?: boolean;
};

type SavedPaymentMethodInput = SavedCardPaymentMethodInput | SavedUpiPaymentMethodInput;

const toSavedPaymentMethodData = (userId: number, input: SavedPaymentMethodInput, isPrimary: boolean) => ({
  userId,
  type: input.type,
  label: input.label?.trim() || null,
  holderName: input.type === PaymentMethod.CARD ? input.holderName.trim() : null,
  maskedEnding: input.type === PaymentMethod.CARD ? input.maskedEnding.trim() : null,
  expiryMonth: input.type === PaymentMethod.CARD ? input.expiryMonth.trim() : null,
  expiryYear: input.type === PaymentMethod.CARD ? input.expiryYear.trim() : null,
  upiId: input.type === PaymentMethod.UPI ? input.upiId.trim() : null,
  isPrimary,
});

export const paymentsService = {
  async list(user: { id: number; role: Role }, orderId?: number) {
    if (user.role === Role.ADMIN) {
      return prisma.payment.findMany({
        where: orderId ? { orderId } : undefined,
        include: {
          order: {
            include: {
              restaurant: true,
              user: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return prisma.payment.findMany({
      where: {
        ...(orderId ? { orderId } : {}),
        order: {
          userId: user.id,
        },
      },
      include: {
        order: {
          include: {
            restaurant: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async listMethods(userId: number) {
    return prisma.savedPaymentMethod.findMany({
      where: { userId },
      select: savedPaymentMethodSelect,
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
    });
  },

  async createMethod(userId: number, input: SavedPaymentMethodInput) {
    return prisma.$transaction(async (tx) => {
      const existingPrimaryCandidate = await tx.savedPaymentMethod.findFirst({
        where: {
          userId,
          type: input.type,
        },
        select: { id: true },
      });
      const isPrimary = input.isPrimary ?? !existingPrimaryCandidate;

      if (isPrimary) {
        await tx.savedPaymentMethod.updateMany({
          where: {
            userId,
            type: input.type,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      return tx.savedPaymentMethod.create({
        data: toSavedPaymentMethodData(userId, input, isPrimary),
        select: savedPaymentMethodSelect,
      });
    });
  },

  async updateMethod(userId: number, paymentMethodId: number, input: SavedPaymentMethodInput) {
    const existingMethod = await prisma.savedPaymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        userId,
      },
      select: {
        id: true,
        type: true,
        isPrimary: true,
      },
    });

    if (!existingMethod) {
      throw new AppError(StatusCodes.NOT_FOUND, "Payment method not found", "PAYMENT_METHOD_NOT_FOUND");
    }

    if (existingMethod.type !== input.type) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Payment method type cannot be changed",
        "PAYMENT_METHOD_TYPE_MISMATCH",
      );
    }

    const isPrimary = input.isPrimary ?? existingMethod.isPrimary;

    return prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.savedPaymentMethod.updateMany({
          where: {
            userId,
            type: input.type,
            id: {
              not: paymentMethodId,
            },
          },
          data: {
            isPrimary: false,
          },
        });
      }

      return tx.savedPaymentMethod.update({
        where: { id: paymentMethodId },
        data: toSavedPaymentMethodData(userId, input, isPrimary),
        select: savedPaymentMethodSelect,
      });
    });
  },
};
