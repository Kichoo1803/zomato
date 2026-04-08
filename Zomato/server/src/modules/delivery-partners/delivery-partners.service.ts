import { OrderStatus } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { emitOrderStatusUpdate } from "../../socket/index.js";
import { AppError } from "../../utils/app-error.js";

const getPartnerByUserId = async (userId: number) => {
  const partner = await prisma.deliveryPartner.findUnique({
    where: { userId },
    include: {
      user: true,
      documents: true,
    },
  });

  if (!partner) {
    throw new AppError(StatusCodes.NOT_FOUND, "Delivery profile not found", "DELIVERY_PROFILE_NOT_FOUND");
  }

  return partner;
};

export const deliveryPartnersService = {
  async getProfile(userId: number) {
    return getPartnerByUserId(userId);
  },

  async updateAvailability(userId: number, availabilityStatus: string) {
    const partner = await getPartnerByUserId(userId);

    return prisma.deliveryPartner.update({
      where: { id: partner.id },
      data: {
        availabilityStatus: availabilityStatus as never,
      },
      include: {
        user: true,
        documents: true,
      },
    });
  },

  async updateLocation(userId: number, latitude: number, longitude: number) {
    const partner = await getPartnerByUserId(userId);

    const updatedPartner = await prisma.deliveryPartner.update({
      where: { id: partner.id },
      data: {
        currentLatitude: latitude,
        currentLongitude: longitude,
      },
      include: {
        orders: {
          where: {
            status: OrderStatus.OUT_FOR_DELIVERY,
          },
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    updatedPartner.orders.forEach((order) => {
      emitOrderStatusUpdate({
        orderId: order.id,
        userId: order.userId,
        status: "LOCATION_UPDATED",
        note: `Partner is currently near ${latitude}, ${longitude}`,
      });
    });

    return updatedPartner;
  },

  async listNewRequests() {
    return prisma.order.findMany({
      where: {
        deliveryPartnerId: null,
        status: {
          in: [OrderStatus.ACCEPTED, OrderStatus.PREPARING],
        },
      },
      include: {
        restaurant: true,
        address: true,
      },
      orderBy: { orderedAt: "desc" },
    });
  },

  async listActiveDeliveries(userId: number) {
    return prisma.order.findMany({
      where: {
        deliveryPartner: {
          userId,
        },
        status: {
          in: [OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.OUT_FOR_DELIVERY],
        },
      },
      include: {
        restaurant: true,
        address: true,
      },
      orderBy: { orderedAt: "desc" },
    });
  },

  async listHistory(userId: number) {
    return prisma.order.findMany({
      where: {
        deliveryPartner: {
          userId,
        },
        status: {
          in: [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED],
        },
      },
      include: {
        restaurant: true,
        address: true,
      },
      orderBy: { orderedAt: "desc" },
    });
  },
};
