import { Prisma } from "@prisma/client";
import { CatalogItemType, OfferScope } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { buildTotals, calculateOfferDiscount, decimalToNumber, roundMoney } from "../../utils/pricing.js";

const cartInclude = {
  restaurant: {
    select: {
      id: true,
      name: true,
      slug: true,
      coverImage: true,
      avgDeliveryTime: true,
      costForTwo: true,
    },
  },
  offer: {
    select: {
      id: true,
      code: true,
      title: true,
      discountType: true,
      discountValue: true,
      minOrderAmount: true,
      maxDiscount: true,
      scope: true,
    },
  },
  items: {
    orderBy: { createdAt: "desc" },
    include: {
      menuItem: {
        select: {
          id: true,
          name: true,
          image: true,
          price: true,
          discountPrice: true,
          isAvailable: true,
          restaurantId: true,
        },
      },
      combo: {
        select: {
          id: true,
          name: true,
          description: true,
          image: true,
          basePrice: true,
          offerPrice: true,
          categoryTag: true,
          isAvailable: true,
          isActive: true,
          items: {
            orderBy: { id: "asc" },
            select: {
              quantity: true,
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
          addon: {
            select: {
              id: true,
              name: true,
              description: true,
              addonType: true,
              price: true,
              menuItemId: true,
              comboId: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

const parseSnapshot = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const mapCart = (cart: Prisma.CartGetPayload<{ include: typeof cartInclude }>) => {
  const subtotal = decimalToNumber(cart.totalAmount);
  const deliveryFee = decimalToNumber(cart.deliveryFee);
  const taxAmount = decimalToNumber(cart.taxAmount);
  const discountAmount = decimalToNumber(cart.discountAmount);

  return {
    ...cart,
    items: cart.items.map((item) => ({
      ...item,
      snapshot: parseSnapshot(item.itemSnapshot),
    })),
    summary: {
      subtotal,
      deliveryFee,
      taxAmount,
      discountAmount,
      payableTotal: roundMoney(subtotal + deliveryFee + taxAmount - discountAmount),
    },
  };
};

const getOwnedCart = async (userId: number, cartId: number) => {
  const cart = await prisma.cart.findFirst({
    where: { id: cartId, userId },
    include: cartInclude,
  });

  if (!cart) {
    throw new AppError(StatusCodes.NOT_FOUND, "Cart not found", "CART_NOT_FOUND");
  }

  return cart;
};

const buildComboSnapshot = (
  combo: Prisma.ComboGetPayload<{
    include: {
      items: {
        include: {
          menuItem: {
            select: {
              id: true;
              name: true;
              image: true;
            };
          };
        };
      };
    };
  }>,
) =>
  JSON.stringify({
    includedItems: combo.items.map((item) => ({
      menuItemId: item.menuItem.id,
      name: item.menuItem.name,
      image: item.menuItem.image,
      quantity: item.quantity,
    })),
    categoryTag: combo.categoryTag,
  });

const recalculateCart = async (tx: Prisma.TransactionClient, cartId: number) => {
  const cart = await tx.cart.findUnique({
    where: { id: cartId },
    include: cartInclude,
  });

  if (!cart) {
    throw new AppError(StatusCodes.NOT_FOUND, "Cart not found", "CART_NOT_FOUND");
  }

  const subtotal = roundMoney(
    cart.items.reduce((sum, item) => sum + decimalToNumber(item.totalPrice), 0),
  );
  const totals = buildTotals({
    subtotal,
    offer: cart.offer,
  });

  return tx.cart.update({
    where: { id: cartId },
    data: {
      totalAmount: totals.subtotal,
      deliveryFee: totals.deliveryFee,
      taxAmount: totals.taxAmount,
      discountAmount: totals.discountAmount,
    },
    include: cartInclude,
  });
};

const ensureOfferApplicable = async (restaurantId: number, code: string) => {
  const offer = await prisma.offer.findFirst({
    where: {
      code,
      isActive: true,
      OR: [{ startDate: null }, { startDate: { lte: new Date() } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: new Date() } }] }],
    },
    include: {
      restaurantLinks: true,
    },
  });

  if (!offer) {
    throw new AppError(StatusCodes.NOT_FOUND, "Offer not found", "OFFER_NOT_FOUND");
  }

  if (
    offer.scope === OfferScope.RESTAURANT &&
    !offer.restaurantLinks.some((link) => link.restaurantId === restaurantId)
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "This offer is not valid for the selected restaurant",
      "OFFER_NOT_APPLICABLE",
    );
  }

  return offer;
};

export const cartsService = {
  async list(userId: number) {
    const carts = await prisma.cart.findMany({
      where: { userId },
      include: cartInclude,
      orderBy: { updatedAt: "desc" },
    });

    return carts.map(mapCart);
  },

  async addItem(
    userId: number,
    input: {
      restaurantId: number;
      menuItemId?: number;
      comboId?: number;
      quantity: number;
      addonIds?: number[];
      specialInstructions?: string;
    },
  ) {
    if (Boolean(input.menuItemId) === Boolean(input.comboId)) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Choose either a menu item or a combo.",
        "INVALID_CART_ITEM",
      );
    }

    const menuItem = input.menuItemId
      ? await prisma.menuItem.findFirst({
          where: {
            id: input.menuItemId,
            restaurantId: input.restaurantId,
            isAvailable: true,
          },
          include: {
            addons: {
              where: {
                isActive: true,
              },
            },
          },
        })
      : null;

    const combo = input.comboId
      ? await prisma.combo.findFirst({
          where: {
            id: input.comboId,
            restaurantId: input.restaurantId,
            isActive: true,
            isAvailable: true,
          },
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
            addons: {
              where: { isActive: true },
            },
          },
        })
      : null;

    if (!menuItem && !combo) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        "The selected item is unavailable.",
        "CATALOG_ITEM_UNAVAILABLE",
      );
    }

    const addonIds = input.addonIds ?? [];
    const availableAddons = menuItem?.addons ?? combo?.addons ?? [];
    const selectedAddons = availableAddons.filter((addon) => addonIds.includes(addon.id));
    if (selectedAddons.length !== addonIds.length) {
      throw new AppError(StatusCodes.BAD_REQUEST, "Some selected addons are invalid", "INVALID_ADDONS");
    }

    return prisma.$transaction(async (tx) => {
      const cart =
        (await tx.cart.findUnique({
          where: {
            userId_restaurantId: {
              userId,
              restaurantId: input.restaurantId,
            },
          },
        })) ??
        (await tx.cart.create({
          data: {
            userId,
            restaurantId: input.restaurantId,
          },
        }));

      const itemPrice = menuItem
        ? decimalToNumber(menuItem.discountPrice ?? menuItem.price)
        : decimalToNumber(combo?.offerPrice ?? combo?.basePrice);
      const addonTotal = selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
      const totalPrice = roundMoney((itemPrice + addonTotal) * input.quantity);

      const cartItem = await tx.cartItem.create({
        data: {
          cartId: cart.id,
          menuItemId: menuItem?.id,
          comboId: combo?.id,
          itemType: menuItem ? CatalogItemType.MENU_ITEM : CatalogItemType.COMBO,
          itemSnapshot: combo ? buildComboSnapshot(combo) : null,
          quantity: input.quantity,
          itemPrice,
          totalPrice,
          specialInstructions: input.specialInstructions,
        },
      });

      if (selectedAddons.length) {
        await tx.cartItemAddon.createMany({
          data: selectedAddons.map((addon) => ({
            cartItemId: cartItem.id,
            addonId: addon.id,
            addonPrice: addon.price,
          })),
        });
      }

      const updatedCart = await recalculateCart(tx, cart.id);
      return mapCart(updatedCart);
    });
  },

  async updateItem(
    userId: number,
    cartItemId: number,
    input: { quantity?: number; addonIds?: number[]; specialInstructions?: string },
  ) {
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: {
          userId,
        },
      },
      include: {
        cart: true,
        addons: {
          include: {
            addon: true,
          },
        },
        menuItem: {
          include: {
            addons: {
              where: { isActive: true },
            },
          },
        },
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
            addons: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!cartItem) {
      throw new AppError(StatusCodes.NOT_FOUND, "Cart item not found", "CART_ITEM_NOT_FOUND");
    }

    if (cartItem.itemType === CatalogItemType.COMBO && !cartItem.combo) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "The selected cart item is no longer available.",
        "CART_ITEM_UNAVAILABLE",
      );
    }

    if (cartItem.itemType === CatalogItemType.MENU_ITEM && !cartItem.menuItem) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "The selected cart item is no longer available.",
        "CART_ITEM_UNAVAILABLE",
      );
    }

    const availableAddons = cartItem.itemType === CatalogItemType.COMBO
      ? cartItem.combo?.addons ?? []
      : cartItem.menuItem?.addons ?? [];
    const selectedAddons =
      input.addonIds !== undefined
        ? availableAddons.filter((addon) => input.addonIds?.includes(addon.id))
        : cartItem.addons.map((addonLink) => addonLink.addon);

    if (input.addonIds && selectedAddons.length !== input.addonIds.length) {
      throw new AppError(StatusCodes.BAD_REQUEST, "Some selected addons are invalid", "INVALID_ADDONS");
    }

    const quantity = input.quantity ?? cartItem.quantity;
    const itemPrice = cartItem.itemType === CatalogItemType.COMBO
      ? decimalToNumber(cartItem.combo?.offerPrice ?? cartItem.combo?.basePrice)
      : decimalToNumber(cartItem.menuItem?.discountPrice ?? cartItem.menuItem?.price);

    if (!Number.isFinite(itemPrice)) {
      throw new AppError(StatusCodes.BAD_REQUEST, "The selected cart item is no longer available.", "CART_ITEM_UNAVAILABLE");
    }

    const addonTotal = selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
    const totalPrice = roundMoney((itemPrice + addonTotal) * quantity);

    return prisma.$transaction(async (tx) => {
      await tx.cartItem.update({
        where: { id: cartItemId },
        data: {
          quantity,
          itemPrice,
          totalPrice,
          ...(cartItem.itemType === CatalogItemType.COMBO && cartItem.combo
            ? { itemSnapshot: buildComboSnapshot(cartItem.combo) }
            : {}),
          ...(input.specialInstructions !== undefined
            ? { specialInstructions: input.specialInstructions }
            : {}),
        },
      });

      if (input.addonIds) {
        await tx.cartItemAddon.deleteMany({
          where: { cartItemId },
        });

        if (selectedAddons.length) {
          await tx.cartItemAddon.createMany({
            data: selectedAddons.map((addon) => ({
              cartItemId,
              addonId: addon.id,
              addonPrice: addon.price,
            })),
          });
        }
      }

      const updatedCart = await recalculateCart(tx, cartItem.cartId);
      return mapCart(updatedCart);
    });
  },

  async removeItem(userId: number, cartItemId: number) {
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: {
          userId,
        },
      },
      select: {
        id: true,
        cartId: true,
      },
    });

    if (!cartItem) {
      throw new AppError(StatusCodes.NOT_FOUND, "Cart item not found", "CART_ITEM_NOT_FOUND");
    }

    return prisma.$transaction(async (tx) => {
      await tx.cartItem.delete({
        where: { id: cartItemId },
      });

      const remainingItems = await tx.cartItem.count({
        where: { cartId: cartItem.cartId },
      });

      if (remainingItems === 0) {
        await tx.cart.delete({
          where: { id: cartItem.cartId },
        });
        return null;
      }

      const updatedCart = await recalculateCart(tx, cartItem.cartId);
      return mapCart(updatedCart);
    });
  },

  async applyOffer(userId: number, cartId: number, code: string) {
    const cart = await getOwnedCart(userId, cartId);
    const offer = await ensureOfferApplicable(cart.restaurantId, code);

    return prisma.$transaction(async (tx) => {
      await tx.cart.update({
        where: { id: cartId },
        data: {
          offerId: offer.id,
        },
      });

      const updatedCart = await recalculateCart(tx, cartId);

      if (calculateOfferDiscount(offer, decimalToNumber(updatedCart.totalAmount)) === 0) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          "The cart does not meet the minimum amount for this offer",
          "OFFER_MINIMUM_NOT_MET",
        );
      }

      return mapCart(updatedCart);
    });
  },

  async removeOffer(userId: number, cartId: number) {
    await getOwnedCart(userId, cartId);

    return prisma.$transaction(async (tx) => {
      await tx.cart.update({
        where: { id: cartId },
        data: { offerId: null },
      });

      const updatedCart = await recalculateCart(tx, cartId);
      return mapCart(updatedCart);
    });
  },

  async clearCart(userId: number, cartId: number) {
    await getOwnedCart(userId, cartId);

    await prisma.cart.delete({
      where: { id: cartId },
    });
  },
};
