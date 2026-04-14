import { Prisma } from "@prisma/client";
import { Role } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";

const comboInclude = {
  restaurant: {
    select: {
      id: true,
      ownerId: true,
      name: true,
      slug: true,
    },
  },
  items: {
    orderBy: { id: "asc" },
    include: {
      menuItem: {
        select: {
          id: true,
          restaurantId: true,
          name: true,
          image: true,
          price: true,
          discountPrice: true,
          foodType: true,
          isAvailable: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
  addons: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      restaurantId: true,
      menuItemId: true,
      comboId: true,
      name: true,
      description: true,
      addonType: true,
      price: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ComboInclude;

const ensureRestaurantAccess = async (
  user: { id: number; role: Role },
  restaurantId: number,
) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      ownerId: true,
      isActive: true,
    },
  });

  if (!restaurant) {
    throw new AppError(StatusCodes.NOT_FOUND, "Restaurant not found", "RESTAURANT_NOT_FOUND");
  }

  if (user.role !== Role.ADMIN && restaurant.ownerId !== user.id) {
    throw new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED");
  }

  return restaurant;
};

const normalizeComboItems = (items: Array<{ menuItemId: number; quantity: number }>) => {
  const bucket = new Map<number, number>();

  for (const item of items) {
    bucket.set(item.menuItemId, (bucket.get(item.menuItemId) ?? 0) + item.quantity);
  }

  return Array.from(bucket.entries()).map(([menuItemId, quantity]) => ({
    menuItemId,
    quantity,
  }));
};

const ensureComboItemsBelongToRestaurant = async (
  restaurantId: number,
  items: Array<{ menuItemId: number; quantity: number }>,
) => {
  const normalizedItems = normalizeComboItems(items);
  const menuItemIds = normalizedItems.map((item) => item.menuItemId);

  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: menuItemIds },
      restaurantId,
    },
    select: {
      id: true,
    },
  });

  if (menuItems.length !== menuItemIds.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Every combo item must belong to the selected restaurant.",
      "INVALID_COMBO_ITEMS",
    );
  }

  return normalizedItems;
};

export const combosService = {
  async listAll(filters?: {
    search?: string;
    restaurantId?: number;
    isActive?: boolean;
  }) {
    const search = filters?.search?.trim();

    return prisma.combo.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { description: { contains: search } },
                { categoryTag: { contains: search } },
                { restaurant: { name: { contains: search } } },
              ],
            }
          : {}),
        ...(filters?.restaurantId ? { restaurantId: filters.restaurantId } : {}),
        ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
      },
      include: comboInclude,
      orderBy: [{ createdAt: "desc" }],
    });
  },

  async listByRestaurant(restaurantId: number) {
    return prisma.combo.findMany({
      where: {
        restaurantId,
        isActive: true,
        isAvailable: true,
        restaurant: {
          isActive: true,
        },
      },
      include: comboInclude,
      orderBy: [{ isAvailable: "desc" }, { createdAt: "desc" }],
    });
  },

  async listForOwner(userId: number) {
    return prisma.combo.findMany({
      where: {
        restaurant: {
          ownerId: userId,
        },
      },
      include: comboInclude,
      orderBy: [{ createdAt: "desc" }],
    });
  },

  async create(user: { id: number; role: Role }, input: Record<string, unknown>) {
    const restaurantId = Number(input.restaurantId);
    await ensureRestaurantAccess(user, restaurantId);
    const comboItems = await ensureComboItemsBelongToRestaurant(
      restaurantId,
      (input.items as Array<{ menuItemId: number; quantity: number }>) ?? [],
    );

    const combo = await prisma.$transaction(async (tx) => {
      const created = await tx.combo.create({
        data: {
          restaurantId,
          name: String(input.name),
          description: input.description as string | undefined,
          image: input.image as string | undefined,
          basePrice: Number(input.basePrice),
          offerPrice: typeof input.offerPrice === "number" ? input.offerPrice : undefined,
          categoryTag: input.categoryTag as string | undefined,
          isAvailable: input.isAvailable === undefined ? true : Boolean(input.isAvailable),
          isActive: input.isActive === undefined ? true : Boolean(input.isActive),
        },
      });

      await tx.comboItem.createMany({
        data: comboItems.map((item) => ({
          comboId: created.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
        })),
      });

      return created;
    });

    return prisma.combo.findUniqueOrThrow({
      where: { id: combo.id },
      include: comboInclude,
    });
  },

  async update(user: { id: number; role: Role }, comboId: number, input: Record<string, unknown>) {
    const existing = await prisma.combo.findUnique({
      where: { id: comboId },
      select: {
        id: true,
        restaurantId: true,
        basePrice: true,
        offerPrice: true,
      },
    });

    if (!existing) {
      throw new AppError(StatusCodes.NOT_FOUND, "Combo not found", "COMBO_NOT_FOUND");
    }

    const restaurantId =
      typeof input.restaurantId === "number" ? Number(input.restaurantId) : existing.restaurantId;
    await ensureRestaurantAccess(user, existing.restaurantId);

    if (restaurantId !== existing.restaurantId) {
      await ensureRestaurantAccess(user, restaurantId);
    }

    const comboItems = Array.isArray(input.items)
      ? await ensureComboItemsBelongToRestaurant(
          restaurantId,
          input.items as Array<{ menuItemId: number; quantity: number }>,
        )
      : undefined;

    const nextBasePrice =
      input.basePrice !== undefined ? Number(input.basePrice) : existing.basePrice;
    const nextOfferPrice =
      input.offerPrice !== undefined
        ? input.offerPrice === null
          ? null
          : Number(input.offerPrice)
        : existing.offerPrice;

    if (nextOfferPrice !== null && nextOfferPrice > nextBasePrice) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Offer price cannot exceed base price.",
        "INVALID_COMBO_PRICE",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.combo.update({
        where: { id: comboId },
        data: {
          ...(input.restaurantId !== undefined ? { restaurantId } : {}),
          ...(input.name !== undefined ? { name: String(input.name) } : {}),
          ...(input.description !== undefined
            ? { description: input.description as string | undefined }
            : {}),
          ...(input.image !== undefined ? { image: input.image as string | undefined } : {}),
          ...(input.basePrice !== undefined ? { basePrice: nextBasePrice } : {}),
          ...(input.offerPrice !== undefined ? { offerPrice: nextOfferPrice } : {}),
          ...(input.categoryTag !== undefined
            ? { categoryTag: input.categoryTag as string | undefined }
            : {}),
          ...(input.isAvailable !== undefined ? { isAvailable: Boolean(input.isAvailable) } : {}),
          ...(input.isActive !== undefined ? { isActive: Boolean(input.isActive) } : {}),
        },
      });

      if (comboItems) {
        await tx.comboItem.deleteMany({
          where: { comboId },
        });

        await tx.comboItem.createMany({
          data: comboItems.map((item) => ({
            comboId,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
          })),
        });
      }
    });

    return prisma.combo.findUniqueOrThrow({
      where: { id: comboId },
      include: comboInclude,
    });
  },

  async remove(user: { id: number; role: Role }, comboId: number) {
    const combo = await prisma.combo.findUnique({
      where: { id: comboId },
      select: {
        id: true,
        restaurantId: true,
      },
    });

    if (!combo) {
      throw new AppError(StatusCodes.NOT_FOUND, "Combo not found", "COMBO_NOT_FOUND");
    }

    await ensureRestaurantAccess(user, combo.restaurantId);

    await prisma.combo.delete({
      where: { id: comboId },
    });
  },
};
