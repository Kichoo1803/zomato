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
    throw new AppError(StatusCodes.FORBIDDEN, "You do not have access to this restaurant", "ACCESS_DENIED");
  }

  return restaurant;
};

export const categoriesService = {
  async getLookups() {
    const [cuisines, restaurantCategories] = await Promise.all([
      prisma.cuisine.findMany({ orderBy: { name: "asc" } }),
      prisma.restaurantCategory.findMany({ orderBy: { name: "asc" } }),
    ]);

    return {
      cuisines,
      restaurantCategories,
    };
  },

  async listMenuCategories(restaurantId: number) {
    return prisma.menuCategory.findMany({
      where: { restaurantId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  },

  async createMenuCategory(
    user: { id: number; role: Role },
    input: { restaurantId: number; name: string; description?: string; isActive?: boolean; sortOrder?: number },
  ) {
    await ensureRestaurantAccess(user, input.restaurantId);

    return prisma.menuCategory.create({
      data: {
        restaurantId: input.restaurantId,
        name: input.name,
        description: input.description,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  },

  async updateMenuCategory(
    user: { id: number; role: Role },
    categoryId: number,
    input: { name?: string; description?: string; isActive?: boolean; sortOrder?: number },
  ) {
    const category = await prisma.menuCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, restaurantId: true },
    });

    if (!category) {
      throw new AppError(StatusCodes.NOT_FOUND, "Menu category not found", "MENU_CATEGORY_NOT_FOUND");
    }

    await ensureRestaurantAccess(user, category.restaurantId);

    return prisma.menuCategory.update({
      where: { id: categoryId },
      data: input,
    });
  },

  async removeMenuCategory(user: { id: number; role: Role }, categoryId: number) {
    const category = await prisma.menuCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, restaurantId: true },
    });

    if (!category) {
      throw new AppError(StatusCodes.NOT_FOUND, "Menu category not found", "MENU_CATEGORY_NOT_FOUND");
    }

    await ensureRestaurantAccess(user, category.restaurantId);

    await prisma.menuCategory.delete({
      where: { id: categoryId },
    });
  },

  async createCuisine(input: { name: string }) {
    return prisma.cuisine.create({
      data: {
        name: input.name,
      },
    });
  },

  async updateCuisine(cuisineId: number, input: { name?: string }) {
    const cuisine = await prisma.cuisine.findUnique({
      where: { id: cuisineId },
      select: { id: true },
    });

    if (!cuisine) {
      throw new AppError(StatusCodes.NOT_FOUND, "Cuisine not found", "CUISINE_NOT_FOUND");
    }

    return prisma.cuisine.update({
      where: { id: cuisineId },
      data: input,
    });
  },

  async removeCuisine(cuisineId: number) {
    const cuisine = await prisma.cuisine.findUnique({
      where: { id: cuisineId },
      select: { id: true },
    });

    if (!cuisine) {
      throw new AppError(StatusCodes.NOT_FOUND, "Cuisine not found", "CUISINE_NOT_FOUND");
    }

    await prisma.cuisine.delete({
      where: { id: cuisineId },
    });
  },

  async createRestaurantCategory(input: { name: string; description?: string }) {
    return prisma.restaurantCategory.create({
      data: {
        name: input.name,
        description: input.description,
      },
    });
  },

  async updateRestaurantCategory(
    restaurantCategoryId: number,
    input: { name?: string; description?: string },
  ) {
    const category = await prisma.restaurantCategory.findUnique({
      where: { id: restaurantCategoryId },
      select: { id: true },
    });

    if (!category) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        "Restaurant category not found",
        "RESTAURANT_CATEGORY_NOT_FOUND",
      );
    }

    return prisma.restaurantCategory.update({
      where: { id: restaurantCategoryId },
      data: input,
    });
  },

  async removeRestaurantCategory(restaurantCategoryId: number) {
    const category = await prisma.restaurantCategory.findUnique({
      where: { id: restaurantCategoryId },
      select: { id: true },
    });

    if (!category) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        "Restaurant category not found",
        "RESTAURANT_CATEGORY_NOT_FOUND",
      );
    }

    await prisma.restaurantCategory.delete({
      where: { id: restaurantCategoryId },
    });
  },
};
