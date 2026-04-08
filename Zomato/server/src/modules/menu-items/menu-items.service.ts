import { Role } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";

const ensureRestaurantAccess = async (user: { id: number; role: Role }, restaurantId: number) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, ownerId: true },
  });

  if (!restaurant) {
    throw new AppError(StatusCodes.NOT_FOUND, "Restaurant not found", "RESTAURANT_NOT_FOUND");
  }

  if (user.role !== Role.ADMIN && restaurant.ownerId !== user.id) {
    throw new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED");
  }

  return restaurant;
};

export const menuItemsService = {
  async listByRestaurant(restaurantId: number) {
    return prisma.menuItem.findMany({
      where: { restaurantId },
      orderBy: [{ isRecommended: "desc" }, { createdAt: "desc" }],
      include: {
        category: true,
        addons: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  },

  async create(user: { id: number; role: Role }, input: Record<string, unknown>) {
    await ensureRestaurantAccess(user, Number(input.restaurantId));

    return prisma.menuItem.create({
      data: {
        restaurantId: Number(input.restaurantId),
        categoryId: Number(input.categoryId),
        name: String(input.name),
        description: input.description as string | undefined,
        image: input.image as string | undefined,
        price: Number(input.price),
        discountPrice: typeof input.discountPrice === "number" ? input.discountPrice : undefined,
        foodType: input.foodType as never,
        isAvailable: input.isAvailable === undefined ? true : Boolean(input.isAvailable),
        isRecommended: Boolean(input.isRecommended),
        preparationTime: typeof input.preparationTime === "number" ? input.preparationTime : 20,
        calories: typeof input.calories === "number" ? input.calories : undefined,
        spiceLevel: typeof input.spiceLevel === "number" ? input.spiceLevel : undefined,
      },
      include: {
        category: true,
        addons: true,
      },
    });
  },

  async update(user: { id: number; role: Role }, itemId: number, input: Record<string, unknown>) {
    const existing = await prisma.menuItem.findUnique({
      where: { id: itemId },
      select: { id: true, restaurantId: true },
    });

    if (!existing) {
      throw new AppError(StatusCodes.NOT_FOUND, "Menu item not found", "MENU_ITEM_NOT_FOUND");
    }

    await ensureRestaurantAccess(user, existing.restaurantId);

    return prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...(input.categoryId !== undefined ? { categoryId: Number(input.categoryId) } : {}),
        ...(input.name !== undefined ? { name: String(input.name) } : {}),
        ...(input.description !== undefined ? { description: input.description as string | undefined } : {}),
        ...(input.image !== undefined ? { image: input.image as string | undefined } : {}),
        ...(input.price !== undefined ? { price: Number(input.price) } : {}),
        ...(input.discountPrice !== undefined ? { discountPrice: Number(input.discountPrice) } : {}),
        ...(input.foodType !== undefined ? { foodType: input.foodType as never } : {}),
        ...(input.isAvailable !== undefined ? { isAvailable: Boolean(input.isAvailable) } : {}),
        ...(input.isRecommended !== undefined ? { isRecommended: Boolean(input.isRecommended) } : {}),
        ...(input.preparationTime !== undefined ? { preparationTime: Number(input.preparationTime) } : {}),
        ...(input.calories !== undefined ? { calories: Number(input.calories) } : {}),
        ...(input.spiceLevel !== undefined ? { spiceLevel: Number(input.spiceLevel) } : {}),
      },
      include: {
        category: true,
        addons: true,
      },
    });
  },

  async remove(user: { id: number; role: Role }, itemId: number) {
    const existing = await prisma.menuItem.findUnique({
      where: { id: itemId },
      select: { id: true, restaurantId: true },
    });

    if (!existing) {
      throw new AppError(StatusCodes.NOT_FOUND, "Menu item not found", "MENU_ITEM_NOT_FOUND");
    }

    await ensureRestaurantAccess(user, existing.restaurantId);

    await prisma.menuItem.delete({
      where: { id: itemId },
    });
  },
};
