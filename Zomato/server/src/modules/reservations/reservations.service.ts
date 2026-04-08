import { ReservationStatus, Role } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";

export const reservationsService = {
  async list(user: { id: number; role: Role }) {
    if (user.role === Role.ADMIN) {
      return prisma.reservation.findMany({
        include: { restaurant: true, user: true },
        orderBy: { reservationDate: "desc" },
      });
    }

    if (user.role === Role.RESTAURANT_OWNER) {
      return prisma.reservation.findMany({
        where: {
          restaurant: {
            ownerId: user.id,
          },
        },
        include: { restaurant: true, user: true },
        orderBy: { reservationDate: "desc" },
      });
    }

    return prisma.reservation.findMany({
      where: { userId: user.id },
      include: { restaurant: true },
      orderBy: { reservationDate: "desc" },
    });
  },

  async create(
    user: { id: number; role: Role },
    input: {
      restaurantId: number;
      reservationDate: Date;
      guests: number;
      slot: string;
      specialRequest?: string;
      contactPhone?: string;
    },
  ) {
    return prisma.reservation.create({
      data: {
        userId: user.id,
        restaurantId: input.restaurantId,
        reservationDate: input.reservationDate,
        guests: input.guests,
        slot: input.slot,
        specialRequest: input.specialRequest,
        contactPhone: input.contactPhone,
        status: ReservationStatus.PENDING,
      },
      include: {
        restaurant: true,
      },
    });
  },

  async updateStatus(user: { id: number; role: Role }, reservationId: number, status: ReservationStatus) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        restaurant: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!reservation) {
      throw new AppError(StatusCodes.NOT_FOUND, "Reservation not found", "RESERVATION_NOT_FOUND");
    }

    const canUpdate =
      user.role === Role.ADMIN ||
      reservation.userId === user.id ||
      reservation.restaurant.ownerId === user.id;

    if (!canUpdate) {
      throw new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED");
    }

    return prisma.reservation.update({
      where: { id: reservationId },
      data: { status },
      include: {
        restaurant: true,
        user: true,
      },
    });
  },
};
