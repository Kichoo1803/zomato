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
  cardBrand: true,
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
  cardBrand?: string;
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

const serializeSavedPaymentMethod = (
  paymentMethod: Prisma.SavedPaymentMethodGetPayload<{ select: typeof savedPaymentMethodSelect }>,
) => ({
  ...paymentMethod,
  cardholderName: paymentMethod.holderName,
  cardLast4: paymentMethod.maskedEnding,
  isDefault: paymentMethod.isPrimary,
});

const toSavedPaymentMethodData = (userId: number, input: SavedPaymentMethodInput, isPrimary: boolean) => ({
  userId,
  type: input.type,
  label: input.label?.trim() || null,
  holderName: input.type === PaymentMethod.CARD ? input.holderName.trim() : null,
  maskedEnding: input.type === PaymentMethod.CARD ? input.maskedEnding.trim() : null,
  cardBrand: input.type === PaymentMethod.CARD ? input.cardBrand?.trim() || null : null,
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
    const paymentMethods = await prisma.savedPaymentMethod.findMany({
      where: { userId },
      select: savedPaymentMethodSelect,
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
    });

    return paymentMethods.map(serializeSavedPaymentMethod);
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

      const paymentMethod = await tx.savedPaymentMethod.create({
        data: toSavedPaymentMethodData(userId, input, isPrimary),
        select: savedPaymentMethodSelect,
      });

      return serializeSavedPaymentMethod(paymentMethod);
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
        label: true,
        holderName: true,
        maskedEnding: true,
        cardBrand: true,
        expiryMonth: true,
        expiryYear: true,
        upiId: true,
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

    return prisma.$transaction(async (tx) => {
      let nextIsPrimary = input.isPrimary ?? existingMethod.isPrimary;

      if (nextIsPrimary) {
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
      } else if (existingMethod.isPrimary) {
        const fallbackMethod = await tx.savedPaymentMethod.findFirst({
          where: {
            userId,
            type: input.type,
            id: {
              not: paymentMethodId,
            },
          },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          select: { id: true },
        });

        if (!fallbackMethod) {
          nextIsPrimary = true;
        } else {
          await tx.savedPaymentMethod.update({
            where: { id: fallbackMethod.id },
            data: { isPrimary: true },
          });
        }
      }

      const paymentMethod = await tx.savedPaymentMethod.update({
        where: { id: paymentMethodId },
        data: toSavedPaymentMethodData(userId, input, nextIsPrimary),
        select: savedPaymentMethodSelect,
      });

      return serializeSavedPaymentMethod(paymentMethod);
    });
  },

  async setDefaultMethod(userId: number, paymentMethodId: number) {
    const existingMethod = await prisma.savedPaymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        userId,
      },
      select: savedPaymentMethodSelect,
    });

    if (!existingMethod) {
      throw new AppError(StatusCodes.NOT_FOUND, "Payment method not found", "PAYMENT_METHOD_NOT_FOUND");
    }

    if (existingMethod.isPrimary) {
      return serializeSavedPaymentMethod(existingMethod);
    }

    return prisma.$transaction(async (tx) => {
      await tx.savedPaymentMethod.updateMany({
        where: {
          userId,
          type: existingMethod.type,
        },
        data: {
          isPrimary: false,
        },
      });

      const paymentMethod = await tx.savedPaymentMethod.update({
        where: { id: paymentMethodId },
        data: { isPrimary: true },
        select: savedPaymentMethodSelect,
      });

      return serializeSavedPaymentMethod(paymentMethod);
    });
  },

  async deleteMethod(userId: number, paymentMethodId: number) {
    const existingMethod = await prisma.savedPaymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        userId,
      },
      select: {
        id: true,
        type: true,
        label: true,
        holderName: true,
        maskedEnding: true,
        cardBrand: true,
        expiryMonth: true,
        expiryYear: true,
        upiId: true,
        isPrimary: true,
      },
    });

    if (!existingMethod) {
      throw new AppError(StatusCodes.NOT_FOUND, "Payment method not found", "PAYMENT_METHOD_NOT_FOUND");
    }

    await prisma.$transaction(async (tx) => {
      await tx.savedPaymentMethod.delete({
        where: { id: paymentMethodId },
      });

      if (!existingMethod.isPrimary) {
        return;
      }

      const replacementMethod = await tx.savedPaymentMethod.findFirst({
        where: {
          userId,
          type: existingMethod.type,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          type: true,
          label: true,
          holderName: true,
          maskedEnding: true,
          cardBrand: true,
          expiryMonth: true,
          expiryYear: true,
          upiId: true,
          isPrimary: true,
        },
      });

      if (!replacementMethod) {
        return;
      }

      await tx.savedPaymentMethod.update({
        where: { id: replacementMethod.id },
        data: { isPrimary: true },
      });
    });
  },
};
