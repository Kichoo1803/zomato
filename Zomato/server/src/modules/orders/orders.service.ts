import { Prisma } from "@prisma/client";
import { NotificationType, OrderStatus, PaymentMethod, PaymentStatus, Role } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { emitNotification, emitOrderStatusUpdate } from "../../socket/index.js";
import { AppError } from "../../utils/app-error.js";
import { generateOrderNumber } from "../../utils/order-number.js";
import { decimalToNumber, roundMoney } from "../../utils/pricing.js";

const orderInclude = {
  address: true,
  restaurant: {
    select: {
      id: true,
      ownerId: true,
      name: true,
      slug: true,
      coverImage: true,
    },
  },
  deliveryPartner: {
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
    },
  },
  offer: {
    select: {
      id: true,
      code: true,
      title: true,
      discountType: true,
      discountValue: true,
    },
  },
  items: {
    include: {
      menuItem: true,
      addons: true,
    },
  },
  payments: true,
  statusEvents: {
    orderBy: { createdAt: "asc" },
    include: {
      actor: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

const paymentGatewayForMethod = (paymentMethod: PaymentMethod) => {
  switch (paymentMethod) {
    case PaymentMethod.CARD:
      return "Stripe";
    case PaymentMethod.UPI:
      return "Razorpay";
    case PaymentMethod.WALLET:
      return "Wallet";
    case PaymentMethod.NET_BANKING:
      return "PayU";
    case PaymentMethod.COD:
    default:
      return "Cash";
  }
};

const deliveryStatusUpdates: OrderStatus[] = [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED];
const syncedPaymentStatuses: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.PAYMENT_FAILED,
  OrderStatus.REFUNDED,
];

const canAccessOrder = (user: { id: number; role: Role }, order: { userId: number; restaurant: { ownerId: number }; deliveryPartner: { userId: number } | null }) => {
  if (user.role === Role.ADMIN) {
    return true;
  }

  if (user.role === Role.CUSTOMER) {
    return order.userId === user.id;
  }

  if (user.role === Role.RESTAURANT_OWNER) {
    return order.restaurant.ownerId === user.id;
  }

  if (user.role === Role.DELIVERY_PARTNER) {
    return order.deliveryPartner?.userId === user.id;
  }

  return false;
};

const assertOrderAccess = <T extends { userId: number; restaurant: { ownerId: number }; deliveryPartner: { userId: number } | null }>(
  user: { id: number; role: Role },
  order: T | null,
): T => {
  if (!order) {
    throw new AppError(StatusCodes.NOT_FOUND, "Order not found", "ORDER_NOT_FOUND");
  }

  if (!canAccessOrder(user, order)) {
    throw new AppError(StatusCodes.FORBIDDEN, "You do not have access to this order", "ACCESS_DENIED");
  }

  return order;
};

const createOrderNotification = async (userId: number, orderId: number, title: string, message: string) => {
  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type: NotificationType.ORDER,
      meta: JSON.stringify({ orderId }),
    },
  });

  emitNotification(userId, notification);
};

export const ordersService = {
  async list(user: { id: number; role: Role }, status?: string) {
    const where: Prisma.OrderWhereInput = {};

    if (status) {
      where.status = status as OrderStatus;
    }

    if (user.role === Role.CUSTOMER) {
      where.userId = user.id;
    }

    if (user.role === Role.RESTAURANT_OWNER) {
      where.restaurant = {
        ownerId: user.id,
      };
    }

    if (user.role === Role.DELIVERY_PARTNER) {
      where.deliveryPartner = {
        userId: user.id,
      };
    }

    return prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { orderedAt: "desc" },
    });
  },

  async getById(user: { id: number; role: Role }, orderId: number) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });

    return assertOrderAccess(user, order);
  },

  async place(
    user: { id: number; role: Role },
    input: { cartId: number; addressId: number; paymentMethod: PaymentMethod; specialInstructions?: string },
  ) {
    const cart = await prisma.cart.findFirst({
      where: {
        id: input.cartId,
        userId: user.id,
      },
      include: {
        restaurant: {
          select: {
            id: true,
            ownerId: true,
            name: true,
          },
        },
        offer: true,
        items: {
          include: {
            menuItem: true,
            addons: {
              include: {
                addon: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      throw new AppError(StatusCodes.NOT_FOUND, "Cart not found", "CART_NOT_FOUND");
    }

    if (!cart.items.length) {
      throw new AppError(StatusCodes.BAD_REQUEST, "Cart is empty", "EMPTY_CART");
    }

    const address = await prisma.address.findFirst({
      where: {
        id: input.addressId,
        userId: user.id,
        isServiceable: true,
      },
      select: {
        id: true,
      },
    });

    if (!address) {
      throw new AppError(StatusCodes.BAD_REQUEST, "Address is not serviceable", "ADDRESS_NOT_SERVICEABLE");
    }

    const subtotal = decimalToNumber(cart.totalAmount);
    const deliveryFee = decimalToNumber(cart.deliveryFee);
    const taxAmount = decimalToNumber(cart.taxAmount);
    const discountAmount = decimalToNumber(cart.discountAmount);
    const totalAmount = roundMoney(subtotal + deliveryFee + taxAmount - discountAmount);
    const paymentStatus =
      input.paymentMethod === PaymentMethod.COD ? PaymentStatus.PENDING : PaymentStatus.PAID;

    const createdOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: user.id,
          restaurantId: cart.restaurantId,
          addressId: input.addressId,
          offerId: cart.offerId,
          orderNumber: generateOrderNumber(),
          status: OrderStatus.PLACED,
          paymentStatus,
          paymentMethod: input.paymentMethod,
          subtotal,
          deliveryFee,
          taxAmount,
          discountAmount,
          totalAmount,
          specialInstructions: input.specialInstructions,
        },
      });

      for (const item of cart.items) {
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            menuItemId: item.menuItemId,
            itemName: item.menuItem.name,
            itemPrice: item.itemPrice,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            foodType: item.menuItem.foodType,
          },
        });

        if (item.addons.length) {
          await tx.orderItemAddon.createMany({
            data: item.addons.map((addon) => ({
              orderItemId: orderItem.id,
              addonName: addon.addon.name,
              addonPrice: addon.addonPrice,
            })),
          });
        }
      }

      await tx.payment.create({
        data: {
          orderId: order.id,
          transactionId:
            input.paymentMethod === PaymentMethod.COD ? null : `TXN-${generateOrderNumber()}`,
          paymentGateway: paymentGatewayForMethod(input.paymentMethod),
          amount: totalAmount,
          status: paymentStatus,
          paidAt: paymentStatus === PaymentStatus.PAID ? new Date() : null,
        },
      });

      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          actorId: user.id,
          status: OrderStatus.PLACED,
          note: "Order placed successfully.",
        },
      });

      await tx.cart.delete({
        where: { id: cart.id },
      });

      return order;
    });

    await createOrderNotification(
      user.id,
      createdOrder.id,
      "Order placed successfully",
      `Your order ${createdOrder.orderNumber} has been placed and sent to the restaurant.`,
    );
    await createOrderNotification(
      cart.restaurant.ownerId,
      createdOrder.id,
      "New order received",
      `A new order ${createdOrder.orderNumber} is waiting for restaurant confirmation.`,
    );

    emitOrderStatusUpdate({
      orderId: createdOrder.id,
      userId: user.id,
      status: OrderStatus.PLACED,
      note: "Order placed successfully.",
    });

    return this.getById(user, createdOrder.id);
  },

  async updateStatus(
    user: { id: number; role: Role },
    orderId: number,
    input: { status: OrderStatus; note?: string },
  ) {
    const order = assertOrderAccess(
      user,
      await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          restaurant: {
            select: {
              ownerId: true,
            },
          },
          deliveryPartner: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      }),
    );

    if (user.role === Role.CUSTOMER && input.status !== OrderStatus.CANCELLED) {
      throw new AppError(StatusCodes.FORBIDDEN, "Customers can only cancel orders", "INVALID_STATUS_CHANGE");
    }

    if (
      user.role === Role.DELIVERY_PARTNER &&
      !deliveryStatusUpdates.includes(input.status)
    ) {
      throw new AppError(StatusCodes.FORBIDDEN, "Delivery partners cannot set this status", "INVALID_STATUS_CHANGE");
    }

    const now = new Date();
    const updateData: Prisma.OrderUncheckedUpdateInput = {
      status: input.status,
      ...(input.status === OrderStatus.ACCEPTED ? { acceptedAt: now } : {}),
      ...(input.status === OrderStatus.PREPARING ? { preparingAt: now } : {}),
      ...(input.status === OrderStatus.OUT_FOR_DELIVERY ? { outForDeliveryAt: now } : {}),
      ...(input.status === OrderStatus.DELIVERED ? { deliveredAt: now } : {}),
      ...(input.status === OrderStatus.CANCELLED ? { cancelledAt: now } : {}),
      ...(input.status === OrderStatus.DELIVERED && order.paymentStatus === PaymentStatus.PENDING
        ? { paymentStatus: PaymentStatus.PAID }
        : {}),
      ...(input.status === OrderStatus.PAYMENT_FAILED ? { paymentStatus: PaymentStatus.FAILED } : {}),
      ...(input.status === OrderStatus.REFUNDED ? { paymentStatus: PaymentStatus.REFUNDED } : {}),
    };

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: updateData,
      });

      await tx.orderStatusEvent.create({
        data: {
          orderId,
          actorId: user.id,
          status: input.status,
          note: input.note,
        },
      });

      if (input.status === OrderStatus.DELIVERED && order.deliveryPartnerId) {
        await tx.deliveryPartner.update({
          where: { id: order.deliveryPartnerId },
          data: {
            totalDeliveries: {
              increment: 1,
            },
          },
        });
      }

      if (syncedPaymentStatuses.includes(input.status)) {
        await tx.payment.updateMany({
          where: { orderId },
          data: {
            status:
              input.status === OrderStatus.DELIVERED
                ? PaymentStatus.PAID
                : input.status === OrderStatus.REFUNDED
                  ? PaymentStatus.REFUNDED
                  : PaymentStatus.FAILED,
            paidAt: input.status === OrderStatus.DELIVERED ? now : undefined,
          },
        });
      }
    });

    await createOrderNotification(
      order.userId,
      orderId,
      "Order status updated",
      `Your order is now marked as ${input.status.toLowerCase().replaceAll("_", " ")}.`,
    );

    emitOrderStatusUpdate({
      orderId,
      userId: order.userId,
      status: input.status,
      note: input.note,
    });

    return this.getById(user, orderId);
  },

  async assignDeliveryPartner(
    user: { id: number; role: Role },
    orderId: number,
    deliveryPartnerId: number,
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError(StatusCodes.NOT_FOUND, "Order not found", "ORDER_NOT_FOUND");
    }

    if (user.role !== Role.ADMIN && order.restaurant.ownerId !== user.id) {
      throw new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED");
    }

    const deliveryPartner = await prisma.deliveryPartner.findUnique({
      where: { id: deliveryPartnerId },
      include: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!deliveryPartner) {
      throw new AppError(StatusCodes.NOT_FOUND, "Delivery partner not found", "DELIVERY_PARTNER_NOT_FOUND");
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryPartnerId,
      },
    });

    await createOrderNotification(
      deliveryPartner.user.id,
      orderId,
      "New delivery assigned",
      `A new delivery assignment is ready for pickup.`,
    );

    return this.getById(user, orderId);
  },
};
