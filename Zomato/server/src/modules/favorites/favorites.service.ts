import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";

export const favoritesService = {
  async list(userId: number) {
    return prisma.favoriteRestaurant.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            coverImage: true,
            avgRating: true,
            avgDeliveryTime: true,
            costForTwo: true,
            area: true,
            addressLine: true,
            city: true,
            state: true,
            cuisineMappings: {
              select: {
                cuisine: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  },

  async add(userId: number, restaurantId: number) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, isActive: true },
    });

    if (!restaurant || !restaurant.isActive) {
      throw new AppError(StatusCodes.NOT_FOUND, "Restaurant not found", "RESTAURANT_NOT_FOUND");
    }

    return prisma.favoriteRestaurant.upsert({
      where: {
        userId_restaurantId: {
          userId,
          restaurantId,
        },
      },
      create: {
        userId,
        restaurantId,
      },
      update: {},
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            coverImage: true,
            avgRating: true,
            avgDeliveryTime: true,
            costForTwo: true,
            area: true,
            addressLine: true,
            city: true,
            state: true,
            cuisineMappings: {
              select: {
                cuisine: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  },

  async remove(userId: number, restaurantId: number) {
    const existing = await prisma.favoriteRestaurant.findUnique({
      where: {
        userId_restaurantId: {
          userId,
          restaurantId,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(StatusCodes.NOT_FOUND, "Favorite not found", "FAVORITE_NOT_FOUND");
    }

    await prisma.favoriteRestaurant.delete({
      where: {
        userId_restaurantId: {
          userId,
          restaurantId,
        },
      },
    });
  },
};
