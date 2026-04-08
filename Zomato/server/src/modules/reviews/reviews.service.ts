import { OrderStatus } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
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
  async listByRestaurant(restaurantId: number) {
    return prisma.review.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
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
        },
        select: { id: true },
      });

      if (!order) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          "Only delivered orders can be reviewed",
          "ORDER_NOT_REVIEWABLE",
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

  async remove(userId: number, reviewId: number) {
    const review = await prisma.review.findFirst({
      where: { id: reviewId, userId },
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
