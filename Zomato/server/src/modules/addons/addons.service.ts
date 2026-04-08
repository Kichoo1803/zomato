import { Role } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";

const ensureAddonAccess = async (user: { id: number; role: Role }, menuItemId: number) => {
  const menuItem = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    include: {
      restaurant: {
        select: {
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

  return menuItem;
};

export const addonsService = {
  async create(user: { id: number; role: Role }, input: { menuItemId: number; name: string; price: number; isActive?: boolean }) {
    await ensureAddonAccess(user, input.menuItemId);

    return prisma.itemAddon.create({
      data: {
        menuItemId: input.menuItemId,
        name: input.name,
        price: input.price,
        isActive: input.isActive ?? true,
      },
    });
  },

  async update(user: { id: number; role: Role }, addonId: number, input: { name?: string; price?: number; isActive?: boolean }) {
    const addon = await prisma.itemAddon.findUnique({
      where: { id: addonId },
      select: { id: true, menuItemId: true },
    });

    if (!addon) {
      throw new AppError(StatusCodes.NOT_FOUND, "Addon not found", "ADDON_NOT_FOUND");
    }

    await ensureAddonAccess(user, addon.menuItemId);

    return prisma.itemAddon.update({
      where: { id: addonId },
      data: input,
    });
  },

  async remove(user: { id: number; role: Role }, addonId: number) {
    const addon = await prisma.itemAddon.findUnique({
      where: { id: addonId },
      select: { id: true, menuItemId: true },
    });

    if (!addon) {
      throw new AppError(StatusCodes.NOT_FOUND, "Addon not found", "ADDON_NOT_FOUND");
    }

    await ensureAddonAccess(user, addon.menuItemId);

    await prisma.itemAddon.delete({
      where: { id: addonId },
    });
  },
};
