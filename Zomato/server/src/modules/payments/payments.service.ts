import { Role } from "../../constants/enums.js";
import { prisma } from "../../lib/prisma.js";

export const paymentsService = {
  async list(user: { id: number; role: Role }, orderId?: number) {
    if (user.role === Role.ADMIN) {
      return prisma.payment.findMany({
        where: orderId ? { orderId } : undefined,
        include: {
          order: {
            include: {
              restaurant: true,
              user: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return prisma.payment.findMany({
      where: {
        ...(orderId ? { orderId } : {}),
        order: {
          userId: user.id,
        },
      },
      include: {
        order: {
          include: {
            restaurant: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};
