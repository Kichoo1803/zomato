import { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { buildAddressSearchText, geocodeAddressText } from "../../utils/geo.js";

const addressSelect = {
  id: true,
  addressType: true,
  title: true,
  recipientName: true,
  contactPhone: true,
  houseNo: true,
  street: true,
  landmark: true,
  area: true,
  city: true,
  state: true,
  pincode: true,
  latitude: true,
  longitude: true,
  isDefault: true,
  isServiceable: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AddressSelect;

const ensureOwnedAddress = async (userId: number, addressId: number) => {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId },
    select: {
      id: true,
      isDefault: true,
      houseNo: true,
      street: true,
      landmark: true,
      area: true,
      city: true,
      state: true,
      pincode: true,
    },
  });

  if (!address) {
    throw new AppError(StatusCodes.NOT_FOUND, "Address not found", "ADDRESS_NOT_FOUND");
  }

  return address;
};

export const addressesService = {
  async list(userId: number) {
    return prisma.address.findMany({
      where: { userId },
      select: addressSelect,
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  },

  async create(userId: number, input: Record<string, unknown>) {
    const existingCount = await prisma.address.count({ where: { userId } });
    const shouldBeDefault = Boolean(input.isDefault) || existingCount === 0;
    const { isDefault: _ignored, ...addressData } = input as Prisma.AddressUncheckedCreateInput;
    const geocodedCoordinates =
      typeof input.latitude === "number" && typeof input.longitude === "number"
        ? null
        : await geocodeAddressText(
            buildAddressSearchText([
              input.houseNo as string | undefined,
              input.street as string | undefined,
              input.landmark as string | undefined,
              input.area as string | undefined,
              input.city as string | undefined,
              input.state as string | undefined,
              input.pincode as string | undefined,
            ]),
          );

    return prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          ...addressData,
          ...(geocodedCoordinates
            ? {
                latitude: geocodedCoordinates.latitude,
                longitude: geocodedCoordinates.longitude,
              }
            : {}),
          userId,
          isDefault: shouldBeDefault,
        },
        select: addressSelect,
      });
    });
  },

  async update(userId: number, addressId: number, input: Record<string, unknown>) {
    const address = await ensureOwnedAddress(userId, addressId);
    const shouldGeocode =
      !("latitude" in input) &&
      !("longitude" in input) &&
      ["houseNo", "street", "landmark", "area", "city", "state", "pincode"].some((key) => key in input);
    const geocodedCoordinates = shouldGeocode
      ? await geocodeAddressText(
          buildAddressSearchText([
            (input.houseNo as string | undefined) ?? address.houseNo,
            (input.street as string | undefined) ?? address.street,
            (input.landmark as string | undefined) ?? address.landmark,
            (input.area as string | undefined) ?? address.area,
            (input.city as string | undefined) ?? address.city,
            (input.state as string | undefined) ?? address.state,
            (input.pincode as string | undefined) ?? address.pincode,
          ]),
        )
      : null;

    return prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id: addressId },
        data: {
          ...(input as Prisma.AddressUncheckedUpdateInput),
          ...(geocodedCoordinates
            ? {
                latitude: geocodedCoordinates.latitude,
                longitude: geocodedCoordinates.longitude,
              }
            : {}),
        },
        select: addressSelect,
      });
    });
  },

  async remove(userId: number, addressId: number) {
    const address = await ensureOwnedAddress(userId, addressId);

    await prisma.$transaction(async (tx) => {
      await tx.address.delete({
        where: { id: addressId },
      });

      if (address.isDefault) {
        const latestAddress = await tx.address.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        if (latestAddress) {
          await tx.address.update({
            where: { id: latestAddress.id },
            data: { isDefault: true },
          });
        }
      }
    });
  },
};
