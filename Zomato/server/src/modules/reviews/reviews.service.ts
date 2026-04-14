import { OrderStatus, Role } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { notificationsService } from "../notifications/notifications.service.js";
import { AppError } from "../../utils/app-error.js";

const syncRestaurantRating = async (restaurantId: number) => {
  const reviews = await prisma.review.findMany({
    where: { restaurantId },
    select: { rating: true },
  });

  const totalReviews = reviews.length;
  const avgRating =
    totalReviews === 0
      ? 0
      : reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews;

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      totalReviews,
      avgRating,
    },
  });
};

export const reviewsService = {
  async listAll(filters?: { restaurantId?: number; rating?: number; search?: string }) {
    const search = filters?.search?.trim();

    return prisma.review.findMany({
      where: {
        ...(filters?.restaurantId ? { restaurantId: filters.restaurantId } : {}),
        ...(filters?.rating ? { rating: filters.rating } : {}),
        ...(search
          ? {
              OR: [
                { reviewText: { contains: search } },
                { user: { fullName: { contains: search } } },
                { restaurant: { name: { contains: search } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileImage: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
    });
  },

  async listByRestaurant(restaurantId: number) {
    return prisma.review.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
          },
        },
      },
    });
  },

  async listForOwner(userId: number) {
    return prisma.review.findMany({
      where: {
        restaurant: {
          ownerId: userId,
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileImage: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
    });
  },

  async create(
    userId: number,
    input: { restaurantId: number; orderId?: number; rating: number; reviewText?: string },
  ) {
    if (input.orderId) {
      const order = await prisma.order.findFirst({
        where: {
          id: input.orderId,
          userId,
          restaurantId: input.restaurantId,
          status: OrderStatus.DELIVERED,
          deletedAt: null,
        },
        select: {
          id: true,
          review: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!order) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          "Only delivered orders can be reviewed",
          "ORDER_NOT_REVIEWABLE",
        );
      }

      if (order.review) {
        throw new AppError(
          StatusCodes.CONFLICT,
          "This delivered order has already been reviewed",
          "REVIEW_ALREADY_EXISTS",
        );
      }
    }

    const review = await prisma.review.create({
      data: {
        userId,
        restaurantId: input.restaurantId,
        orderId: input.orderId,
        rating: input.rating,
        reviewText: input.reviewText,
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
          },
        },
      },
    });

    await syncRestaurantRating(input.restaurantId);

    await notificationsService.createForUser({
      userId: review.restaurant.ownerId,
      title: "New review received",
      message: `${review.user.fullName} rated ${review.restaurant.name} ${review.rating}/5.${review.reviewText ? " Check the latest guest feedback." : ""}`,
      meta: {
        eventKey: "owner:new-review",
        reviewId: review.id,
        restaurantId: review.restaurant.id,
        rating: review.rating,
        path: "/owner/reviews",
      },
      dedupeWindowMinutes: 10,
    });

    return review;
  },

  async update(userId: number, reviewId: number, input: { rating?: number; reviewText?: string }) {
    const review = await prisma.review.findFirst({
      where: { id: reviewId, userId },
      select: { id: true, restaurantId: true },
    });

    if (!review) {
      throw new AppError(StatusCodes.NOT_FOUND, "Review not found", "REVIEW_NOT_FOUND");
    }

    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(input.reviewText !== undefined ? { reviewText: input.reviewText } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
          },
        },
      },
    });

    await syncRestaurantRating(review.restaurantId);

    return updatedReview;
  },

  async remove(user: { id: number; role: Role }, reviewId: number) {
    const review = await prisma.review.findFirst({
      where: {
        id: reviewId,
        ...(user.role === Role.ADMIN ? {} : { userId: user.id }),
      },
      select: { id: true, restaurantId: true },
    });

    if (!review) {
      throw new AppError(StatusCodes.NOT_FOUND, "Review not found", "REVIEW_NOT_FOUND");
    }

    await prisma.review.delete({
      where: { id: reviewId },
    });

    await syncRestaurantRating(review.restaurantId);
  },
};
