import { Prisma } from "@prisma/client";
import { OfferScope } from "../../constants/enums.js";
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
  restaurantLinks: {
    select: {
      restaurant: {
        select: {
          id: true,
          name: true,
          slug: true,
          ownerId: true,
        },
      },
    },
  },
} satisfies Prisma.OfferSelect;

const ensureOwnerRestaurantAccess = async (userId: number, restaurantId: number) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      ownerId: true,
    },
  });

  if (!restaurant) {
    throw new AppError(StatusCodes.NOT_FOUND, "Restaurant not found", "RESTAURANT_NOT_FOUND");
  }

  if (restaurant.ownerId !== userId) {
    throw new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED");
  }

  return restaurant;
};

const getOwnerOffer = async (userId: number, offerId: number) => {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: offerSelect,
  });

  if (!offer || offer.scope !== OfferScope.RESTAURANT || !offer.restaurantLinks.length) {
    throw new AppError(StatusCodes.NOT_FOUND, "Offer not found", "OFFER_NOT_FOUND");
  }

  if (offer.restaurantLinks.some((link) => link.restaurant.ownerId !== userId)) {
    throw new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED");
  }

  return offer;
};

const toOwnerOfferSelect = <
  T extends {
    restaurantLinks: Array<{
      restaurant: {
        id: number;
        name: string;
        slug: string;
        ownerId: number;
      };
    }>;
  },
>(
  offer: T,
) => ({
  ...offer,
  restaurantLinks: offer.restaurantLinks.map((link) => ({
    restaurant: {
      id: link.restaurant.id,
      name: link.restaurant.name,
      slug: link.restaurant.slug,
    },
  })),
});

export const offersService = {
  async listActive() {
    const offers = await prisma.offer.findMany({
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

    return offers.map(toOwnerOfferSelect);
  },

  async listAll() {
    const offers = await prisma.offer.findMany({
      select: offerSelect,
      orderBy: { createdAt: "desc" },
    });

    return offers.map(toOwnerOfferSelect);
  },

  async listForOwner(userId: number) {
    const offers = await prisma.offer.findMany({
      where: {
        scope: OfferScope.RESTAURANT,
        restaurantLinks: {
          some: {
            restaurant: {
              ownerId: userId,
            },
          },
        },
      },
      select: offerSelect,
      orderBy: { createdAt: "desc" },
    });

    return offers.map(toOwnerOfferSelect);
  },

  async create(input: Record<string, unknown>) {
    const offer = await prisma.offer.create({
      data: input as Prisma.OfferUncheckedCreateInput,
      select: offerSelect,
    });

    return toOwnerOfferSelect(offer);
  },

  async createForOwner(
    userId: number,
    input: {
      restaurantId: number;
      code?: string;
      title: string;
      description?: string;
      discountType: string;
      discountValue: number;
      minOrderAmount?: number;
      maxDiscount?: number;
      usageLimit?: number;
      perUserLimit?: number;
      startDate?: Date;
      endDate?: Date;
      isActive?: boolean;
    },
  ) {
    await ensureOwnerRestaurantAccess(userId, input.restaurantId);

    const offer = await prisma.offer.create({
      data: {
        code: input.code,
        title: input.title,
        description: input.description,
        discountType: input.discountType,
        discountValue: input.discountValue,
        minOrderAmount: input.minOrderAmount ?? 0,
        maxDiscount: input.maxDiscount,
        scope: OfferScope.RESTAURANT,
        usageLimit: input.usageLimit,
        perUserLimit: input.perUserLimit,
        startDate: input.startDate,
        endDate: input.endDate,
        isActive: input.isActive ?? true,
        restaurantLinks: {
          create: {
            restaurantId: input.restaurantId,
          },
        },
      },
      select: offerSelect,
    });

    return toOwnerOfferSelect(offer);
  },

  async update(offerId: number, input: Record<string, unknown>) {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true },
    });

    if (!offer) {
      throw new AppError(StatusCodes.NOT_FOUND, "Offer not found", "OFFER_NOT_FOUND");
    }

    const updatedOffer = await prisma.offer.update({
      where: { id: offerId },
      data: input as Prisma.OfferUncheckedUpdateInput,
      select: offerSelect,
    });

    return toOwnerOfferSelect(updatedOffer);
  },

  async updateForOwner(
    userId: number,
    offerId: number,
    input: {
      restaurantId?: number;
      code?: string;
      title?: string;
      description?: string;
      discountType?: string;
      discountValue?: number;
      minOrderAmount?: number;
      maxDiscount?: number;
      usageLimit?: number;
      perUserLimit?: number;
      startDate?: Date;
      endDate?: Date;
      isActive?: boolean;
    },
  ) {
    await getOwnerOffer(userId, offerId);

    if (typeof input.restaurantId === "number") {
      await ensureOwnerRestaurantAccess(userId, input.restaurantId);
    }

    const updatedOffer = await prisma.$transaction(async (tx) => {
      await tx.offer.update({
        where: { id: offerId },
        data: {
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.discountType !== undefined ? { discountType: input.discountType } : {}),
          ...(input.discountValue !== undefined ? { discountValue: input.discountValue } : {}),
          ...(input.minOrderAmount !== undefined ? { minOrderAmount: input.minOrderAmount } : {}),
          ...(input.maxDiscount !== undefined ? { maxDiscount: input.maxDiscount } : {}),
          ...(input.usageLimit !== undefined ? { usageLimit: input.usageLimit } : {}),
          ...(input.perUserLimit !== undefined ? { perUserLimit: input.perUserLimit } : {}),
          ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
          ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          scope: OfferScope.RESTAURANT,
        },
      });

      if (typeof input.restaurantId === "number") {
        await tx.restaurantOffer.deleteMany({
          where: { offerId },
        });
        await tx.restaurantOffer.create({
          data: {
            offerId,
            restaurantId: input.restaurantId,
          },
        });
      }

      return tx.offer.findUniqueOrThrow({
        where: { id: offerId },
        select: offerSelect,
      });
    });

    return toOwnerOfferSelect(updatedOffer);
  },

  async remove(offerId: number) {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true },
    });

    if (!offer) {
      throw new AppError(StatusCodes.NOT_FOUND, "Offer not found", "OFFER_NOT_FOUND");
    }

    await prisma.offer.delete({
      where: { id: offerId },
    });
  },

  async removeForOwner(userId: number, offerId: number) {
    await getOwnerOffer(userId, offerId);

    await prisma.offer.delete({
      where: { id: offerId },
    });
  },
};
