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

const isPrismaKnownRequestError = (
  error: unknown,
  code?: string,
): error is Error & { code: string } =>
  error instanceof Error &&
  error.name === "PrismaClientKnownRequestError" &&
  typeof (error as unknown as { code?: unknown }).code === "string" &&
  (!code || (error as unknown as { code: string }).code === code);

const normalizeAddonIds = (addonIds?: number[]) =>
  [...new Set(addonIds ?? [])].sort((leftId, rightId) => leftId - rightId);

const normalizeSpecialInstructions = (value?: string | null) => value?.trim() || null;

const hasSameAddonSelection = (
  addonLinks: Array<{
    addonId: number;
  }>,
  expectedAddonIds: number[],
) => {
  const actualAddonIds = addonLinks.map((addonLink) => addonLink.addonId).sort((leftId, rightId) => leftId - rightId);

  return (
    actualAddonIds.length === expectedAddonIds.length &&
    actualAddonIds.every((addonId, index) => addonId === expectedAddonIds[index])
  );
};

const recalculateCart = async (cartId: number) => {
  const cart = await prisma.cart.findUnique({
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

  return prisma.cart.update({
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

const getOrCreateCart = async (userId: number, restaurantId: number) => {
  const uniqueWhere = {
    userId_restaurantId: {
      userId,
      restaurantId,
    },
  } as const;

  const existingCart = await prisma.cart.findUnique({
    where: uniqueWhere,
  });

  if (existingCart) {
    return existingCart;
  }

  try {
    return await prisma.cart.create({
      data: {
        userId,
        restaurantId,
      },
    });
  } catch (error) {
    if (isPrismaKnownRequestError(error, "P2002")) {
      const cart = await prisma.cart.findUnique({
        where: uniqueWhere,
      });

      if (cart) {
        return cart;
      }
    }

    throw error;
  }
};

const findMatchingCartItem = async ({
  cartId,
  menuItemId,
  comboId,
  itemType,
  addonIds,
  specialInstructions,
}: {
  cartId: number;
  menuItemId?: number;
  comboId?: number;
  itemType: CatalogItemType;
  addonIds: number[];
  specialInstructions: string | null;
}) => {
  const candidateItems = await prisma.cartItem.findMany({
    where: {
      cartId,
      menuItemId: menuItemId ?? null,
      comboId: comboId ?? null,
      itemType,
    },
    include: {
      addons: {
        select: {
          addonId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    candidateItems.find(
      (candidateItem) =>
        normalizeSpecialInstructions(candidateItem.specialInstructions) === specialInstructions &&
        hasSameAddonSelection(candidateItem.addons, addonIds),
    ) ?? null
  );
};

const syncCartItemAddons = async (
  cartItemId: number,
  selectedAddons: Array<{
    id: number;
    price: number;
  }>,
) => {
  await prisma.cartItemAddon.deleteMany({
    where: { cartItemId },
  });

  if (!selectedAddons.length) {
    return;
  }

  await prisma.cartItemAddon.createMany({
    data: selectedAddons.map((addon) => ({
      cartItemId,
      addonId: addon.id,
      addonPrice: addon.price,
    })),
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

    const addonIds = normalizeAddonIds(input.addonIds);
    const specialInstructions = normalizeSpecialInstructions(input.specialInstructions);
    const availableAddons = menuItem?.addons ?? combo?.addons ?? [];
    const selectedAddons = availableAddons.filter((addon) => addonIds.includes(addon.id));
    if (selectedAddons.length !== addonIds.length) {
      throw new AppError(StatusCodes.BAD_REQUEST, "Some selected addons are invalid", "INVALID_ADDONS");
    }

    const cart = await getOrCreateCart(userId, input.restaurantId);
    const itemType = menuItem ? CatalogItemType.MENU_ITEM : CatalogItemType.COMBO;
    const itemPrice = menuItem
      ? decimalToNumber(menuItem.discountPrice ?? menuItem.price)
      : decimalToNumber(combo?.offerPrice ?? combo?.basePrice);
    const addonTotal = selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
    const matchingCartItem = await findMatchingCartItem({
      cartId: cart.id,
      menuItemId: menuItem?.id,
      comboId: combo?.id,
      itemType,
      addonIds,
      specialInstructions,
    });
    const quantity = (matchingCartItem?.quantity ?? 0) + input.quantity;
    const totalPrice = roundMoney((itemPrice + addonTotal) * quantity);

    if (matchingCartItem) {
      await prisma.cartItem.update({
        where: { id: matchingCartItem.id },
        data: {
          quantity,
          itemPrice,
          totalPrice,
          ...(itemType === CatalogItemType.COMBO && combo
            ? { itemSnapshot: buildComboSnapshot(combo) }
            : {}),
        },
      });
    } else {
      const cartItem = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          menuItemId: menuItem?.id,
          comboId: combo?.id,
          itemType,
          itemSnapshot: combo ? buildComboSnapshot(combo) : null,
          quantity,
          itemPrice,
          totalPrice,
          specialInstructions,
        },
      });

      await syncCartItemAddons(cartItem.id, selectedAddons);
    }

    const updatedCart = await recalculateCart(cart.id);
    return mapCart(updatedCart);
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

    if (input.addonIds !== undefined && selectedAddons.length !== input.addonIds.length) {
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

    await prisma.cartItem.update({
      where: { id: cartItemId },
      data: {
        quantity,
        itemPrice,
        totalPrice,
        ...(cartItem.itemType === CatalogItemType.COMBO && cartItem.combo
          ? { itemSnapshot: buildComboSnapshot(cartItem.combo) }
          : {}),
        ...(input.specialInstructions !== undefined
          ? { specialInstructions: normalizeSpecialInstructions(input.specialInstructions) }
          : {}),
      },
    });

    if (input.addonIds !== undefined) {
      await syncCartItemAddons(cartItemId, selectedAddons);
    }

    const updatedCart = await recalculateCart(cartItem.cartId);
    return mapCart(updatedCart);
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

    await prisma.cartItem.delete({
      where: { id: cartItemId },
    });

    const remainingItems = await prisma.cartItem.count({
      where: { cartId: cartItem.cartId },
    });

    if (remainingItems === 0) {
      await prisma.cart.delete({
        where: { id: cartItem.cartId },
      });
      return null;
    }

    const updatedCart = await recalculateCart(cartItem.cartId);
    return mapCart(updatedCart);
  },

  async applyOffer(userId: number, cartId: number, code: string) {
    const cart = await getOwnedCart(userId, cartId);
    const offer = await ensureOfferApplicable(cart.restaurantId, code);
    if (calculateOfferDiscount(offer, decimalToNumber(cart.totalAmount)) === 0) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "The cart does not meet the minimum amount for this offer",
        "OFFER_MINIMUM_NOT_MET",
      );
    }

    await prisma.cart.update({
      where: { id: cartId },
      data: {
        offerId: offer.id,
      },
    });

    const updatedCart = await recalculateCart(cartId);
    return mapCart(updatedCart);
  },

  async removeOffer(userId: number, cartId: number) {
    await getOwnedCart(userId, cartId);

    await prisma.cart.update({
      where: { id: cartId },
      data: { offerId: null },
    });

    const updatedCart = await recalculateCart(cartId);
    return mapCart(updatedCart);
  },

  async clearCart(userId: number, cartId: number) {
    await getOwnedCart(userId, cartId);

    await prisma.cart.delete({
      where: { id: cartId },
    });
  },
};
