import { AddonType, Role } from "../../constants/enums.js";
import { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";

const addonInclude = {
  restaurant: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  menuItem: {
    select: {
      id: true,
      name: true,
    },
  },
  combo: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ItemAddonInclude;

const getParentAccess = async (
  user: { id: number; role: Role },
  input: { menuItemId?: number; comboId?: number },
) => {
  if (input.menuItemId && input.comboId) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Choose either a menu item or a combo for this addon.",
      "INVALID_ADDON_PARENT",
    );
  }

  if (!input.menuItemId && !input.comboId) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "An addon must belong to a menu item or a combo.",
      "INVALID_ADDON_PARENT",
    );
  }

  if (input.menuItemId) {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: input.menuItemId },
      include: {
        restaurant: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!menuItem) {
      throw new AppError(StatusCodes.NOT_FOUND, "Menu item not found", "MENU_ITEM_NOT_FOUND");
    }

    if (user.role !== Role.ADMIN && menuItem.restaurant.ownerId !== user.id) {
      throw new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED");
    }

    return {
      restaurantId: menuItem.restaurant.id,
      menuItemId: menuItem.id,
      comboId: null,
    };
  }

  const combo = await prisma.combo.findUnique({
    where: { id: input.comboId },
    include: {
      restaurant: {
        select: {
          id: true,
          ownerId: true,
        },
      },
    },
  });

  if (!combo) {
    throw new AppError(StatusCodes.NOT_FOUND, "Combo not found", "COMBO_NOT_FOUND");
  }

  if (user.role !== Role.ADMIN && combo.restaurant.ownerId !== user.id) {
    throw new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED");
  }

  return {
    restaurantId: combo.restaurant.id,
    menuItemId: null,
    comboId: combo.id,
  };
};

export const addonsService = {
  async listAll(filters?: {
    search?: string;
    restaurantId?: number;
    isActive?: boolean;
    parentType?: "MENU_ITEM" | "COMBO";
  }) {
    const search = filters?.search?.trim();

    return prisma.itemAddon.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { description: { contains: search } },
                { restaurant: { name: { contains: search } } },
                { menuItem: { name: { contains: search } } },
                { combo: { name: { contains: search } } },
              ],
            }
          : {}),
        ...(filters?.restaurantId ? { restaurantId: filters.restaurantId } : {}),
        ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
        ...(filters?.parentType === "MENU_ITEM"
          ? { menuItemId: { not: null } }
          : filters?.parentType === "COMBO"
            ? { comboId: { not: null } }
            : {}),
      },
      include: addonInclude,
      orderBy: [{ createdAt: "desc" }],
    });
  },

  async listForOwner(
    userId: number,
    filters?: {
      search?: string;
      restaurantId?: number;
      isActive?: boolean;
      parentType?: "MENU_ITEM" | "COMBO";
    },
  ) {
    const search = filters?.search?.trim();

    return prisma.itemAddon.findMany({
      where: {
        restaurant: {
          ownerId: userId,
        },
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { description: { contains: search } },
                { menuItem: { name: { contains: search } } },
                { combo: { name: { contains: search } } },
              ],
            }
          : {}),
        ...(filters?.restaurantId ? { restaurantId: filters.restaurantId } : {}),
        ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
        ...(filters?.parentType === "MENU_ITEM"
          ? { menuItemId: { not: null } }
          : filters?.parentType === "COMBO"
            ? { comboId: { not: null } }
            : {}),
      },
      include: addonInclude,
      orderBy: [{ createdAt: "desc" }],
    });
  },

  async create(
    user: { id: number; role: Role },
    input: {
      menuItemId?: number;
      comboId?: number;
      name: string;
      description?: string;
      addonType?: AddonType;
      price: number;
      isActive?: boolean;
    },
  ) {
    const parent = await getParentAccess(user, {
      menuItemId: input.menuItemId,
      comboId: input.comboId,
    });

    return prisma.itemAddon.create({
      data: {
        restaurantId: parent.restaurantId,
        menuItemId: parent.menuItemId,
        comboId: parent.comboId,
        name: input.name,
        description: input.description,
        addonType: input.addonType ?? AddonType.EXTRA,
        price: input.price,
        isActive: input.isActive ?? true,
      },
      include: addonInclude,
    });
  },

  async update(
    user: { id: number; role: Role },
    addonId: number,
    input: {
      menuItemId?: number;
      comboId?: number;
      name?: string;
      description?: string;
      addonType?: AddonType;
      price?: number;
      isActive?: boolean;
    },
  ) {
    const addon = await prisma.itemAddon.findUnique({
      where: { id: addonId },
      select: {
        id: true,
        menuItemId: true,
        comboId: true,
        restaurant: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!addon) {
      throw new AppError(StatusCodes.NOT_FOUND, "Addon not found", "ADDON_NOT_FOUND");
    }

    if (user.role !== Role.ADMIN && addon.restaurant.ownerId !== user.id) {
      throw new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED");
    }

    const parent =
      input.menuItemId !== undefined || input.comboId !== undefined
        ? await getParentAccess(user, {
            menuItemId: input.menuItemId,
            comboId: input.comboId,
          })
        : null;

    return prisma.itemAddon.update({
      where: { id: addonId },
      data: {
        ...(parent
          ? {
              restaurantId: parent.restaurantId,
              menuItemId: parent.menuItemId,
              comboId: parent.comboId,
            }
          : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.addonType !== undefined ? { addonType: input.addonType } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: addonInclude,
    });
  },

  async remove(user: { id: number; role: Role }, addonId: number) {
    const addon = await prisma.itemAddon.findUnique({
      where: { id: addonId },
      select: {
        id: true,
        restaurant: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!addon) {
      throw new AppError(StatusCodes.NOT_FOUND, "Addon not found", "ADDON_NOT_FOUND");
    }

    if (user.role !== Role.ADMIN && addon.restaurant.ownerId !== user.id) {
      throw new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED");
    }

    await prisma.itemAddon.delete({
      where: { id: addonId },
    });
  },
};
