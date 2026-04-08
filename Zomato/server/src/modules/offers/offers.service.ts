import { Prisma } from "@prisma/client";
import { OfferScope, Role } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";

const offerSelect = {
  id: true,
  code: true,
  title: true,
  description: true,
  discountType: true,
  discountValue: true,
  minOrderAmount: true,
  maxDiscount: true,
  scope: true,
  usageLimit: true,
  perUserLimit: true,
  startDate: true,
  endDate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OfferSelect;

export const offersService = {
  async listActive() {
    return prisma.offer.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: new Date() } }] },
          { OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
        ],
      },
      select: offerSelect,
      orderBy: [{ scope: "asc" }, { createdAt: "desc" }],
    });
  },

  async listAll() {
    return prisma.offer.findMany({
      select: offerSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async create(input: Record<string, unknown>) {
    return prisma.offer.create({
      data: input as Prisma.OfferUncheckedCreateInput,
      select: offerSelect,
    });
  },

  async update(offerId: number, input: Record<string, unknown>) {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true },
    });

    if (!offer) {
      throw new AppError(StatusCodes.NOT_FOUND, "Offer not found", "OFFER_NOT_FOUND");
    }

    return prisma.offer.update({
      where: { id: offerId },
      data: input as Prisma.OfferUncheckedUpdateInput,
      select: offerSelect,
    });
  },
};
