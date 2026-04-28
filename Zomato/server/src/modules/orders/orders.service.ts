import { Prisma } from "@prisma/client";
import {
  CatalogItemType,
  DeliveryAvailabilityStatus,
  DeliveryOfferStatus,
  NotificationType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Role,
} from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import {
  emitDispatchQueueUpdate,
  emitNotification,
  emitOrderStatusUpdate,
} from "../../socket/index.js";
import { AppError } from "../../utils/app-error.js";
import { calculateDeliveryIntelligence } from "../../utils/order-intelligence.js";
import { generateOrderNumber } from "../../utils/order-number.js";
import { decimalToNumber, roundMoney } from "../../utils/pricing.js";
import { orderDispatchService } from "./order-dispatch.service.js";

const orderInclude = {
  address: true,
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
    },
  },
  restaurant: {
    select: {
      id: true,
      ownerId: true,
      name: true,
      slug: true,
      coverImage: true,
      addressLine: true,
      area: true,
      city: true,
      state: true,
      pincode: true,
      latitude: true,
      longitude: true,
      avgDeliveryTime: true,
      preparationTime: true,
    },
  },
  deliveryPartner: {
    select: {
      id: true,
      userId: true,
      currentLatitude: true,
      currentLongitude: true,
      lastLocationUpdatedAt: true,
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
      combo: true,
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
  review: {
    select: {
      id: true,
      restaurantId: true,
      orderId: true,
      rating: true,
      reviewText: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.OrderInclude;

const notArchivedOrderWhere: Prisma.OrderWhereInput = {
  deletedAt: null,
};

type OrderWithRealtimeContext = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

const paymentGatewayForMethod = (paymentMethod: PaymentMethod) => {
  switch (paymentMethod) {
    case PaymentMethod.CARD:
      return "Stripe";
    case PaymentMethod.UPI:
      return "Razorpay";
    case PaymentMethod.WALLET:
      return "Wallet";
    case PaymentMethod.COD:
    default:
      return "Cash";
  }
};

const deliveryStatusUpdates: OrderStatus[] = [
  OrderStatus.PICKED_UP,
  OrderStatus.ON_THE_WAY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELAYED,
  OrderStatus.DELIVERED,
];
const deliveryPartnerStatusTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.DELIVERY_PARTNER_ASSIGNED]: [OrderStatus.PICKED_UP, OrderStatus.DELAYED],
  [OrderStatus.PICKED_UP]: [OrderStatus.ON_THE_WAY, OrderStatus.DELAYED],
  [OrderStatus.ON_THE_WAY]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELAYED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.DELAYED],
  [OrderStatus.DELAYED]: [
    OrderStatus.PICKED_UP,
    OrderStatus.ON_THE_WAY,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
  ],
};
const claimableDeliveryRequestStatuses: OrderStatus[] = [
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.LOOKING_FOR_DELIVERY_PARTNER,
];
const syncedPaymentStatuses: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.PAYMENT_FAILED,
  OrderStatus.REFUNDED,
];
const ownerStatusTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PLACED]: [OrderStatus.CONFIRMED, OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.DELAYED, OrderStatus.CANCELLED],
  [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.DELAYED, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY_FOR_PICKUP, OrderStatus.DELAYED, OrderStatus.CANCELLED],
  [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.LOOKING_FOR_DELIVERY_PARTNER, OrderStatus.DELAYED, OrderStatus.CANCELLED],
  [OrderStatus.LOOKING_FOR_DELIVERY_PARTNER]: [OrderStatus.DELAYED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERY_PARTNER_ASSIGNED]: [OrderStatus.DELAYED, OrderStatus.CANCELLED],
  [OrderStatus.DELAYED]: [
    OrderStatus.PREPARING,
    OrderStatus.READY_FOR_PICKUP,
    OrderStatus.LOOKING_FOR_DELIVERY_PARTNER,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
};

const getDeliveryPartnerUserId = (
  deliveryPartner:
    | {
        userId?: number;
        user?: {
          id: number;
        };
      }
    | null,
) => deliveryPartner?.userId ?? deliveryPartner?.user?.id ?? undefined;

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const toLabel = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const buildAddressSummary = (address: {
  houseNo?: string | null;
  street?: string | null;
  landmark?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}) =>
  [
    [address.houseNo, address.street].filter(Boolean).join(" ").trim(),
    address.landmark,
    address.area,
    address.city,
    address.state,
    address.pincode,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(", ");

const buildItemsSummary = (
  items: Array<{
    itemName: string;
    quantity: number;
  }>,
) =>
  items
    .slice(0, 3)
    .map((item) => `${item.quantity}x ${item.itemName}`)
    .join(", ");

const buildNotificationMeta = (
  order: OrderWithRealtimeContext,
  payload: {
    eventKey: string;
    status?: string;
  },
) =>
  JSON.stringify({
    eventKey: payload.eventKey,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: payload.status ?? order.status,
    customerName: order.user.fullName,
    restaurantName: order.restaurant.name,
    itemsSummary: buildItemsSummary(order.items),
    itemCount: order.items.length,
    addressSummary: buildAddressSummary(order.address),
    pickupSummary:
      [
        order.restaurant.addressLine,
        order.restaurant.area,
        order.restaurant.city,
      ]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
        .join(", ") || order.restaurant.name,
    deliveryArea:
      [order.address.area, order.address.city].filter(Boolean).join(", ") || order.address.city,
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod,
    estimatedDeliveryMinutes: order.estimatedDeliveryMinutes,
    routeDistanceKm: order.routeDistanceKm,
    specialInstructions: order.specialInstructions ?? null,
  });

const canAccessOrder = (
  user: { id: number; role: Role },
  order: {
    userId: number;
    restaurant: { ownerId: number };
    deliveryPartner:
      | {
          userId?: number;
          user?: {
            id: number;
          };
        }
      | null;
  },
) => {
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
    return getDeliveryPartnerUserId(order.deliveryPartner) === user.id;
  }

  return false;
};

const assertOrderAccess = <
  T extends {
    userId: number;
    restaurant: { ownerId: number };
    deliveryPartner:
      | {
          userId?: number;
          user?: {
            id: number;
          };
        }
      | null;
  },
>(
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

const createOrderNotification = async (
  userId: number,
  orderId: number,
  title: string,
  message: string,
  options?: {
    meta?: string;
    dedupe?: boolean;
    realtimeTarget?: {
      restaurantId?: number | null;
      deliveryPartnerId?: number | null;
    };
  },
) => {
  const meta = options?.meta ?? JSON.stringify({ orderId });

  if (options?.dedupe) {
    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId,
        type: NotificationType.ORDER,
        title,
        meta,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingNotification) {
      return existingNotification;
    }
  }

  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type: NotificationType.ORDER,
      meta,
    },
  });

  // Keep persisted notifications as the REST fallback, then fan them out live over Socket.IO.
  emitNotification({
    userId,
    restaurantId: options?.realtimeTarget?.restaurantId,
    deliveryPartnerId: options?.realtimeTarget?.deliveryPartnerId,
    notification,
  });
  return notification;
};

const notifyAvailableDeliveryPartners = async (order: OrderWithRealtimeContext) => {
  if (
    order.deliveryPartnerId ||
    !([OrderStatus.READY_FOR_PICKUP, OrderStatus.LOOKING_FOR_DELIVERY_PARTNER] as OrderStatus[]).includes(
      order.status as OrderStatus,
    )
  ) {
    return;
  }

  const availablePartners = await prisma.deliveryPartner.findMany({
    where: {
      availabilityStatus: DeliveryAvailabilityStatus.ONLINE,
      isVerified: true,
      user: {
        isActive: true,
      },
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!availablePartners.length) {
    return;
  }

  const message = [
    `${order.orderNumber} from ${order.restaurant.name}`,
    `Pickup ${[
      order.restaurant.area,
      order.restaurant.city,
    ]
      .filter(Boolean)
      .join(", ") || order.restaurant.name}`,
    `Drop ${[order.address.area, order.address.city].filter(Boolean).join(", ") || order.address.city}`,
    `ETA ${order.estimatedDeliveryMinutes != null ? `${order.estimatedDeliveryMinutes} min` : "pending"}`,
  ].join(" • ");

  await Promise.all(
    availablePartners.map((partner) =>
      createOrderNotification(partner.userId, order.id, "New delivery request", message, {
        meta: buildNotificationMeta(order, {
          eventKey: "delivery:new-request",
          status: OrderStatus.LOOKING_FOR_DELIVERY_PARTNER,
        }),
        dedupe: true,
        realtimeTarget: {
          deliveryPartnerId: partner.id,
        },
      }),
    ),
  );
};

export const ordersService = {
  async list(user: { id: number; role: Role }, status?: string) {
    const where: Prisma.OrderWhereInput = {
      ...notArchivedOrderWhere,
    };

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
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        ...notArchivedOrderWhere,
      },
      include: orderInclude,
    });

    return assertOrderAccess(user, order);
  },

  async place(
    user: { id: number; role: Role },
    input: {
      cartId: number;
      addressId: number;
      paymentMethod: PaymentMethod;
      paymentMethodId?: number;
      savedPaymentMethodId?: number;
      tipAmount?: number;
      specialInstructions?: string;
    },
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
            latitude: true,
            longitude: true,
            avgDeliveryTime: true,
            preparationTime: true,
          },
        },
        offer: true,
        items: {
          include: {
            menuItem: true,
            combo: {
              include: {
                items: {
                  include: {
                    menuItem: {
                      select: {
                        id: true,
                        name: true,
                        image: true,
                      },
                    },
                  },
                },
              },
            },
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
        latitude: true,
        longitude: true,
      },
    });

    if (!address) {
      throw new AppError(StatusCodes.BAD_REQUEST, "Address is not serviceable", "ADDRESS_NOT_SERVICEABLE");
    }

    const selectedSavedPaymentMethodId = input.savedPaymentMethodId ?? input.paymentMethodId;

    if (input.paymentMethod === PaymentMethod.CARD || input.paymentMethod === PaymentMethod.UPI) {
      if (!selectedSavedPaymentMethodId) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          "Select a saved card or UPI ID before continuing",
          "PAYMENT_METHOD_REQUIRED",
        );
      }

      const paymentMethod = await prisma.savedPaymentMethod.findFirst({
        where: {
          id: selectedSavedPaymentMethodId,
          userId: user.id,
        },
        select: {
          id: true,
          type: true,
        },
      });

      if (!paymentMethod) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          "Select a valid saved card or UPI ID before continuing",
          "PAYMENT_METHOD_INVALID",
        );
      }

      if (paymentMethod.type !== input.paymentMethod) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          "Selected payment details do not match the chosen payment mode",
          "PAYMENT_METHOD_MODE_MISMATCH",
        );
      }
    }

    const subtotal = decimalToNumber(cart.totalAmount);
    const deliveryFee = decimalToNumber(cart.deliveryFee);
    const taxAmount = decimalToNumber(cart.taxAmount);
    const discountAmount = decimalToNumber(cart.discountAmount);
    const tipAmount =
      typeof input.tipAmount === "number" ? roundMoney(input.tipAmount) : 0;
    const deliveryIntelligence = await calculateDeliveryIntelligence({
      status: OrderStatus.PLACED,
      restaurant: cart.restaurant,
      address,
    });
    const totalAmount = roundMoney(
      subtotal + deliveryFee + taxAmount + tipAmount - discountAmount,
    );
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
          tipAmount,
          totalAmount,
          routeDistanceKm: deliveryIntelligence.routeDistanceKm,
          travelDurationMinutes: deliveryIntelligence.travelDurationMinutes,
          estimatedDeliveryMinutes: deliveryIntelligence.estimatedDeliveryMinutes,
          trafficDelayMinutes: deliveryIntelligence.trafficDelayMinutes,
          weatherDelayMinutes: deliveryIntelligence.weatherDelayMinutes,
          delayMinutes: deliveryIntelligence.delayMinutes,
          specialInstructions: input.specialInstructions,
        },
      });

      for (const item of cart.items) {
        const isComboItem = item.itemType === CatalogItemType.COMBO;
        const catalogEntry = isComboItem ? item.combo : item.menuItem;

        if (!catalogEntry) {
          throw new AppError(
            StatusCodes.BAD_REQUEST,
            "One of the selected cart items is no longer available.",
            "CART_ITEM_UNAVAILABLE",
          );
        }

        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            menuItemId: item.menuItemId,
            comboId: item.comboId,
            itemType: item.itemType,
            itemSnapshot: item.itemSnapshot,
            itemName: catalogEntry.name,
            itemPrice: item.itemPrice,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            foodType: isComboItem ? null : item.menuItem?.foodType,
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

    const placedOrder = assertOrderAccess(
      user,
      await prisma.order.findFirst({
        where: {
          id: createdOrder.id,
          ...notArchivedOrderWhere,
        },
        include: orderInclude,
      }),
    );

    await createOrderNotification(
      user.id,
      placedOrder.id,
      "Order placed successfully",
      `Your order ${placedOrder.orderNumber} has been placed with ${placedOrder.restaurant.name}.`,
      {
        meta: buildNotificationMeta(placedOrder, {
          eventKey: "customer:order-placed",
          status: OrderStatus.PLACED,
        }),
      },
    );
    await createOrderNotification(
      placedOrder.restaurant.ownerId,
      placedOrder.id,
      "New order received",
      [
        `${placedOrder.orderNumber} from ${placedOrder.user.fullName}`,
        buildItemsSummary(placedOrder.items),
        buildAddressSummary(placedOrder.address),
        `${formatCurrency(placedOrder.totalAmount)} via ${toLabel(placedOrder.paymentMethod)}`,
      ]
        .filter(Boolean)
        .join(" • "),
      {
        meta: buildNotificationMeta(placedOrder, {
          eventKey: "owner:new-order",
          status: OrderStatus.PLACED,
        }),
        realtimeTarget: {
          restaurantId: placedOrder.restaurant.id,
        },
      },
    );

    emitOrderStatusUpdate({
      orderId: placedOrder.id,
      userId: user.id,
      ownerId: placedOrder.restaurant.ownerId,
      restaurantId: placedOrder.restaurant.id,
      status: OrderStatus.PLACED,
      note: "Order placed successfully.",
    });

    return placedOrder;
  },

  async updateStatus(
    user: { id: number; role: Role },
    orderId: number,
    input: { status: OrderStatus; note?: string },
  ) {
    const order = assertOrderAccess(
      user,
      await prisma.order.findFirst({
        where: {
          id: orderId,
          ...notArchivedOrderWhere,
        },
        include: {
          restaurant: {
            select: {
              ownerId: true,
              latitude: true,
              longitude: true,
              preparationTime: true,
              avgDeliveryTime: true,
            },
          },
          address: {
            select: {
              latitude: true,
              longitude: true,
            },
          },
          deliveryPartner: {
            select: {
              id: true,
              userId: true,
              currentLatitude: true,
              currentLongitude: true,
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

    if (user.role === Role.DELIVERY_PARTNER) {
      const allowedStatuses = deliveryPartnerStatusTransitions[order.status as OrderStatus] ?? [];

      if (!allowedStatuses.includes(input.status)) {
        throw new AppError(
          StatusCodes.FORBIDDEN,
          "Delivery partners cannot set this status from the current order state",
          "INVALID_STATUS_CHANGE",
        );
      }
    }

    if (user.role === Role.RESTAURANT_OWNER) {
      const allowedStatuses = ownerStatusTransitions[order.status as OrderStatus] ?? [];

      if (!allowedStatuses.includes(input.status)) {
        throw new AppError(
          StatusCodes.FORBIDDEN,
          "Restaurant owners cannot set this status from the current order state",
          "INVALID_STATUS_CHANGE",
        );
      }

      if (input.status === OrderStatus.DELIVERY_PARTNER_ASSIGNED && !order.deliveryPartnerId) {
        throw new AppError(
          StatusCodes.CONFLICT,
          "Assign a delivery partner before marking this order as assigned",
          "DELIVERY_PARTNER_REQUIRED",
        );
      }
    }

    const now = new Date();
    const deliveryIntelligence = await calculateDeliveryIntelligence({
      status: input.status,
      restaurant: order.restaurant,
      address: order.address,
      deliveryPartner: order.deliveryPartner,
    });
    const updateData: Prisma.OrderUncheckedUpdateInput = {
      status: input.status,
      routeDistanceKm: deliveryIntelligence.routeDistanceKm,
      travelDurationMinutes: deliveryIntelligence.travelDurationMinutes,
      estimatedDeliveryMinutes: deliveryIntelligence.estimatedDeliveryMinutes,
      trafficDelayMinutes: deliveryIntelligence.trafficDelayMinutes,
      weatherDelayMinutes: deliveryIntelligence.weatherDelayMinutes,
      delayMinutes: deliveryIntelligence.delayMinutes,
      ...(input.status === OrderStatus.CONFIRMED ? { confirmedAt: now } : {}),
      ...(input.status === OrderStatus.ACCEPTED ? { acceptedAt: now } : {}),
      ...(input.status === OrderStatus.PREPARING ? { preparingAt: now } : {}),
      ...(input.status === OrderStatus.READY_FOR_PICKUP ? { readyForPickupAt: now } : {}),
      ...(input.status === OrderStatus.DELIVERY_PARTNER_ASSIGNED ? { assignedAt: now } : {}),
      ...(input.status === OrderStatus.PICKED_UP ? { pickedUpAt: now } : {}),
      ...(input.status === OrderStatus.ON_THE_WAY
        ? { onTheWayAt: now, outForDeliveryAt: now }
        : {}),
      ...(input.status === OrderStatus.OUT_FOR_DELIVERY
        ? { outForDeliveryAt: now, onTheWayAt: now }
        : {}),
      ...(input.status === OrderStatus.DELAYED ? { delayedAt: now } : {}),
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
            availabilityStatus: DeliveryAvailabilityStatus.ONLINE,
          },
        });
      }

      if (
        order.deliveryPartnerId &&
        ([OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.PAYMENT_FAILED] as OrderStatus[]).includes(
          input.status,
        )
      ) {
        await tx.deliveryPartner.update({
          where: { id: order.deliveryPartnerId },
          data: {
            availabilityStatus: DeliveryAvailabilityStatus.ONLINE,
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

    const updatedOrder = assertOrderAccess(
      user,
      await prisma.order.findFirst({
        where: {
          id: orderId,
          ...notArchivedOrderWhere,
        },
        include: orderInclude,
      }),
    );

    await createOrderNotification(
      updatedOrder.userId,
      orderId,
      "Order status updated",
      `${updatedOrder.orderNumber} is now ${toLabel(input.status).toLowerCase()}.`,
      {
        meta: buildNotificationMeta(updatedOrder, {
          eventKey: "customer:order-status-update",
          status: input.status,
        }),
      },
    );

    const deliveryPartnerUserId = getDeliveryPartnerUserId(updatedOrder.deliveryPartner);
    const shouldNotifyOwner =
      updatedOrder.restaurant.ownerId !== user.id &&
      ([
        OrderStatus.CANCELLED,
        OrderStatus.DELAYED,
        OrderStatus.PICKED_UP,
        OrderStatus.ON_THE_WAY,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
        OrderStatus.PAYMENT_FAILED,
        OrderStatus.REFUNDED,
      ] as OrderStatus[]).includes(input.status);

    if (shouldNotifyOwner) {
      await createOrderNotification(
        updatedOrder.restaurant.ownerId,
        orderId,
        "Order status changed",
        `${updatedOrder.orderNumber} is now ${toLabel(input.status).toLowerCase()}.`,
        {
          meta: buildNotificationMeta(updatedOrder, {
            eventKey: "owner:order-status-update",
            status: input.status,
          }),
          realtimeTarget: {
            restaurantId: updatedOrder.restaurant.id,
          },
        },
      );
    }

    const shouldNotifyDeliveryPartner =
      Boolean(deliveryPartnerUserId) &&
      deliveryPartnerUserId !== user.id &&
      ([OrderStatus.READY_FOR_PICKUP, OrderStatus.DELAYED, OrderStatus.CANCELLED] as OrderStatus[]).includes(
        input.status,
      );

    if (shouldNotifyDeliveryPartner && deliveryPartnerUserId) {
      const deliveryPartnerTitle =
        input.status === OrderStatus.READY_FOR_PICKUP
          ? "Pickup ready"
          : input.status === OrderStatus.DELAYED
            ? "Delivery delayed"
            : "Order cancelled";

      await createOrderNotification(
        deliveryPartnerUserId,
        orderId,
        deliveryPartnerTitle,
        `${updatedOrder.orderNumber} from ${updatedOrder.restaurant.name} is now ${toLabel(input.status).toLowerCase()}.`,
        {
          meta: buildNotificationMeta(updatedOrder, {
            eventKey: "delivery:order-status-update",
            status: input.status,
          }),
          realtimeTarget: {
            deliveryPartnerId: updatedOrder.deliveryPartnerId,
          },
        },
      );
    }

    const shouldKeepDispatchOpen =
      !updatedOrder.deliveryPartnerId &&
      (orderDispatchService.claimableOrderStatuses as readonly OrderStatus[]).includes(input.status);

    if (shouldKeepDispatchOpen) {
      await orderDispatchService.syncOrder(orderId);
    } else {
      await orderDispatchService.closeOrderOffers(
        orderId,
        updatedOrder.deliveryPartnerId
          ? DeliveryOfferStatus.MISSED
          : DeliveryOfferStatus.CANCELLED,
        updatedOrder.deliveryPartnerId ? "ORDER_ASSIGNED" : `ORDER_${input.status}`,
      );
    }

    emitOrderStatusUpdate({
      orderId,
      userId: updatedOrder.userId,
      ownerId: updatedOrder.restaurant.ownerId,
      deliveryPartnerUserId,
      restaurantId: updatedOrder.restaurant.id,
      deliveryPartnerId: updatedOrder.deliveryPartnerId,
      status: input.status,
      note: input.note,
    });

    return updatedOrder;
  },

  async acceptDeliveryRequest(user: { id: number; role: Role }, orderId: number) {
    if (user.role !== Role.DELIVERY_PARTNER) {
      throw new AppError(StatusCodes.FORBIDDEN, "Only delivery partners can accept requests", "ACCESS_DENIED");
    }

    const deliveryPartner = await prisma.deliveryPartner.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        userId: true,
        isVerified: true,
        availabilityStatus: true,
        currentLatitude: true,
        currentLongitude: true,
        lastLocationUpdatedAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            isActive: true,
          },
        },
      },
    });

    if (!deliveryPartner) {
      throw new AppError(StatusCodes.NOT_FOUND, "Delivery profile not found", "DELIVERY_PROFILE_NOT_FOUND");
    }

    if (!deliveryPartner.user.isActive) {
      throw new AppError(
        StatusCodes.FORBIDDEN,
        "Your delivery profile is inactive right now",
        "DELIVERY_PROFILE_INACTIVE",
      );
    }

    if (!deliveryPartner.isVerified) {
      throw new AppError(
        StatusCodes.FORBIDDEN,
        "Verify your delivery profile before accepting orders",
        "DELIVERY_PROFILE_NOT_VERIFIED",
      );
    }

    if (deliveryPartner.availabilityStatus !== DeliveryAvailabilityStatus.ONLINE) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "Go online before accepting a delivery request",
        "DELIVERY_PARTNER_NOT_AVAILABLE",
      );
    }

    const now = new Date();

    if (
      !deliveryPartner.lastLocationUpdatedAt ||
      now.getTime() - new Date(deliveryPartner.lastLocationUpdatedAt).getTime() >
        orderDispatchService.dispatchConfig.staleLocationMinutes * 60 * 1000
    ) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "Refresh your live location before accepting a delivery request",
        "DELIVERY_PARTNER_LOCATION_STALE",
      );
    }

    const activeDeliveryCount = await prisma.order.count({
      where: {
        deletedAt: null,
        deliveryPartnerId: deliveryPartner.id,
        status: {
          in: [...orderDispatchService.activeDeliveryStatuses],
        },
      },
    });

    if (activeDeliveryCount >= orderDispatchService.dispatchConfig.maxActiveOrders) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "Finish your active delivery before accepting another request",
        "DELIVERY_PARTNER_AT_CAPACITY",
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        ...notArchivedOrderWhere,
      },
      include: {
        restaurant: {
          select: {
            ownerId: true,
            latitude: true,
            longitude: true,
            preparationTime: true,
            avgDeliveryTime: true,
            name: true,
          },
        },
        address: {
          select: {
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError(StatusCodes.NOT_FOUND, "Order not found", "ORDER_NOT_FOUND");
    }

    if (order.deliveryPartnerId) {
      if (order.deliveryPartnerId === deliveryPartner.id) {
        throw new AppError(
          StatusCodes.CONFLICT,
          "This delivery request is already assigned to you",
          "DELIVERY_REQUEST_ALREADY_ACCEPTED",
        );
      }

      throw new AppError(
        StatusCodes.CONFLICT,
        "This delivery request is no longer available",
        "DELIVERY_REQUEST_UNAVAILABLE",
      );
    }

    if (!claimableDeliveryRequestStatuses.includes(order.status as OrderStatus)) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "This order is not ready to be accepted yet",
        "DELIVERY_REQUEST_NOT_READY",
      );
    }

    const pendingOffer = await prisma.deliveryAssignmentOffer.findFirst({
      where: {
        orderId,
        deliveryPartnerId: deliveryPartner.id,
        status: DeliveryOfferStatus.PENDING,
        expiresAt: {
          gt: now,
        },
      },
      select: {
        id: true,
      },
    });

    if (!pendingOffer) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "This delivery request is no longer available to accept",
        "DELIVERY_REQUEST_UNAVAILABLE",
      );
    }

    const competingOfferUsers = await prisma.deliveryAssignmentOffer.findMany({
      where: {
        orderId,
        status: DeliveryOfferStatus.PENDING,
        id: {
          not: pendingOffer.id,
        },
      },
      select: {
        deliveryPartner: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    const nextStatus = OrderStatus.DELIVERY_PARTNER_ASSIGNED;
    const deliveryIntelligence = await calculateDeliveryIntelligence({
      status: nextStatus,
      restaurant: order.restaurant,
      address: order.address,
      deliveryPartner,
    });

    await prisma.$transaction(async (tx) => {
      const claimedOffer = await tx.deliveryAssignmentOffer.updateMany({
        where: {
          id: pendingOffer.id,
          status: DeliveryOfferStatus.PENDING,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          status: DeliveryOfferStatus.ACCEPTED,
          respondedAt: now,
          acceptedAt: now,
          closedReason: "PARTNER_ACCEPTED",
        },
      });

      if (!claimedOffer.count) {
        throw new AppError(
          StatusCodes.CONFLICT,
          "This delivery request is no longer available",
          "DELIVERY_REQUEST_UNAVAILABLE",
        );
      }

      const claimedOrder = await tx.order.updateMany({
        where: {
          id: orderId,
          deletedAt: null,
          deliveryPartnerId: null,
          status: {
            in: [...claimableDeliveryRequestStatuses],
          },
        },
        data: {
          deliveryPartnerId: deliveryPartner.id,
          status: nextStatus,
          assignedAt: now,
          routeDistanceKm: deliveryIntelligence.routeDistanceKm,
          travelDurationMinutes: deliveryIntelligence.travelDurationMinutes,
          estimatedDeliveryMinutes: deliveryIntelligence.estimatedDeliveryMinutes,
          trafficDelayMinutes: deliveryIntelligence.trafficDelayMinutes,
          weatherDelayMinutes: deliveryIntelligence.weatherDelayMinutes,
          delayMinutes: deliveryIntelligence.delayMinutes,
        },
      });

      if (!claimedOrder.count) {
        throw new AppError(
          StatusCodes.CONFLICT,
          "This delivery request is no longer available",
          "DELIVERY_REQUEST_UNAVAILABLE",
        );
      }

      await tx.orderStatusEvent.create({
        data: {
          orderId,
          actorId: user.id,
          status: nextStatus,
          note: "Delivery partner accepted the order.",
        },
      });

      await tx.deliveryAssignmentOffer.updateMany({
        where: {
          orderId,
          status: DeliveryOfferStatus.PENDING,
          id: {
            not: pendingOffer.id,
          },
        },
        data: {
          status: DeliveryOfferStatus.MISSED,
          respondedAt: now,
          closedReason: "ORDER_ASSIGNED_TO_ANOTHER_PARTNER",
        },
      });

      await tx.deliveryPartner.update({
        where: { id: deliveryPartner.id },
        data: {
          availabilityStatus: DeliveryAvailabilityStatus.BUSY,
        },
      });
    });

    const acceptedOrder = assertOrderAccess(
      user,
      await prisma.order.findFirst({
        where: {
          id: orderId,
          ...notArchivedOrderWhere,
        },
        include: orderInclude,
      }),
    );

    await createOrderNotification(
      acceptedOrder.userId,
      orderId,
      "Delivery partner assigned",
      "Your order has been accepted for pickup and your rider is heading to the restaurant.",
      {
        meta: buildNotificationMeta(acceptedOrder, {
          eventKey: "customer:delivery-partner-assigned",
          status: nextStatus,
        }),
      },
    );
    await createOrderNotification(
      acceptedOrder.restaurant.ownerId,
      orderId,
      "Delivery partner accepted pickup",
      `${acceptedOrder.orderNumber} was accepted by ${deliveryPartner.user.fullName} for pickup.`,
      {
        meta: buildNotificationMeta(acceptedOrder, {
          eventKey: "owner:delivery-partner-accepted",
          status: nextStatus,
        }),
        realtimeTarget: {
          restaurantId: acceptedOrder.restaurant.id,
        },
      },
    );

    if (competingOfferUsers.length) {
      emitDispatchQueueUpdate({
        orderId,
        state: DeliveryOfferStatus.MISSED,
        userIds: [...new Set(competingOfferUsers.map((offer) => offer.deliveryPartner.userId))],
        deliveryPartnerIds: [...new Set(competingOfferUsers.map((offer) => offer.deliveryPartner.id))],
      });
    }

    emitOrderStatusUpdate({
      orderId,
      userId: acceptedOrder.userId,
      ownerId: acceptedOrder.restaurant.ownerId,
      deliveryPartnerUserId: deliveryPartner.user.id,
      restaurantId: acceptedOrder.restaurant.id,
      deliveryPartnerId: acceptedOrder.deliveryPartnerId,
      status: nextStatus,
      note: "Delivery partner accepted the order.",
    });

    return acceptedOrder;
  },

  async assignDeliveryPartner(
    user: { id: number; role: Role },
    orderId: number,
    deliveryPartnerId: number,
    input?: {
      emergencyOverride?: boolean;
      overrideReason?: string;
    },
  ) {
    if (!input?.emergencyOverride) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "Automatic delivery assignment is enabled. Use an explicit emergency override when dispatch needs a manual fallback.",
        "DELIVERY_ASSIGNMENT_AUTOMATIC",
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        ...notArchivedOrderWhere,
      },
      include: {
        restaurant: {
          select: {
            ownerId: true,
            latitude: true,
            longitude: true,
            preparationTime: true,
            avgDeliveryTime: true,
          },
        },
        address: {
          select: {
            latitude: true,
            longitude: true,
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
      select: {
        id: true,
        currentLatitude: true,
        currentLongitude: true,
        userId: true,
        user: {
          select: {
            id: true,
            fullName: true,
            isActive: true,
          },
        },
      },
    });

    if (!deliveryPartner) {
      throw new AppError(StatusCodes.NOT_FOUND, "Delivery partner not found", "DELIVERY_PARTNER_NOT_FOUND");
    }

    if (!deliveryPartner.user.isActive) {
      throw new AppError(
        StatusCodes.CONFLICT,
        "The selected delivery partner is inactive right now",
        "DELIVERY_PARTNER_INACTIVE",
      );
    }

    const nextStatus =
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.REFUNDED ||
      order.status === OrderStatus.PAYMENT_FAILED
        ? (order.status as OrderStatus)
        : OrderStatus.DELIVERY_PARTNER_ASSIGNED;
    const deliveryIntelligence = await calculateDeliveryIntelligence({
      status: nextStatus,
      restaurant: order.restaurant,
      address: order.address,
      deliveryPartner,
    });
    const now = new Date();
    const overrideReason =
      input.overrideReason?.trim() || "Emergency delivery partner override applied.";

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          deliveryPartnerId,
          status: nextStatus,
          ...(nextStatus === OrderStatus.DELIVERY_PARTNER_ASSIGNED ? { assignedAt: now } : {}),
          routeDistanceKm: deliveryIntelligence.routeDistanceKm,
          travelDurationMinutes: deliveryIntelligence.travelDurationMinutes,
          estimatedDeliveryMinutes: deliveryIntelligence.estimatedDeliveryMinutes,
          trafficDelayMinutes: deliveryIntelligence.trafficDelayMinutes,
          weatherDelayMinutes: deliveryIntelligence.weatherDelayMinutes,
          delayMinutes: deliveryIntelligence.delayMinutes,
        },
      });

      if (nextStatus === OrderStatus.DELIVERY_PARTNER_ASSIGNED) {
        await tx.orderStatusEvent.create({
          data: {
            orderId,
            actorId: user.id,
            status: OrderStatus.DELIVERY_PARTNER_ASSIGNED,
            note: overrideReason,
          },
        });
      }

      const latestBatch = await tx.deliveryAssignmentOffer.findFirst({
        where: { orderId },
        orderBy: [{ batchNumber: "desc" }, { createdAt: "desc" }],
        select: {
          batchNumber: true,
        },
      });

      await tx.deliveryAssignmentOffer.create({
        data: {
          orderId,
          deliveryPartnerId,
          batchNumber: (latestBatch?.batchNumber ?? 0) + 1,
          status: DeliveryOfferStatus.ACCEPTED,
          radiusKm: 0,
          distanceKm: null,
          expiresAt: now,
          respondedAt: now,
          acceptedAt: now,
          closedReason: "EMERGENCY_OVERRIDE",
        },
      });

      await tx.deliveryAssignmentOffer.updateMany({
        where: {
          orderId,
          status: DeliveryOfferStatus.PENDING,
        },
        data: {
          status: DeliveryOfferStatus.MISSED,
          respondedAt: now,
          closedReason: "EMERGENCY_OVERRIDE",
        },
      });

      await tx.deliveryPartner.update({
        where: { id: deliveryPartnerId },
        data: {
          availabilityStatus: DeliveryAvailabilityStatus.BUSY,
        },
      });
    });

    const assignedOrder = assertOrderAccess(
      user,
      await prisma.order.findFirst({
        where: {
          id: orderId,
          ...notArchivedOrderWhere,
        },
        include: orderInclude,
      }),
    );

    await createOrderNotification(
      deliveryPartner.user.id,
      orderId,
      "Emergency delivery assigned",
      [
        `${assignedOrder.orderNumber} from ${assignedOrder.restaurant.name}`,
        `Pickup ${[
          assignedOrder.restaurant.area,
          assignedOrder.restaurant.city,
        ]
          .filter(Boolean)
          .join(", ") || assignedOrder.restaurant.name}`,
        `Drop ${[assignedOrder.address.area, assignedOrder.address.city].filter(Boolean).join(", ") || assignedOrder.address.city}`,
      ].join(" • "),
      {
        meta: buildNotificationMeta(assignedOrder, {
          eventKey: "delivery:assigned",
          status: nextStatus,
        }),
        realtimeTarget: {
          deliveryPartnerId: deliveryPartner.id,
        },
      },
    );
    await createOrderNotification(
      assignedOrder.userId,
      orderId,
      "Delivery partner assigned",
      "Your order now has a delivery partner assigned and pickup is getting aligned.",
      {
        meta: buildNotificationMeta(assignedOrder, {
          eventKey: "customer:delivery-partner-assigned",
          status: nextStatus,
        }),
      },
    );

    emitOrderStatusUpdate({
      orderId,
      userId: assignedOrder.userId,
      ownerId: assignedOrder.restaurant.ownerId,
      deliveryPartnerUserId: getDeliveryPartnerUserId(assignedOrder.deliveryPartner),
      restaurantId: assignedOrder.restaurant.id,
      deliveryPartnerId: assignedOrder.deliveryPartnerId,
      status: nextStatus,
      note: nextStatus === OrderStatus.DELIVERY_PARTNER_ASSIGNED ? overrideReason : undefined,
    });

    return assignedOrder;
  },
};
