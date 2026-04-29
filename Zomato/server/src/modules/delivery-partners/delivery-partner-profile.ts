import type { Prisma } from "@prisma/client";
import { DeliveryAvailabilityStatus, Role, VehicleType } from "../../constants/enums.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { StatusCodes } from "http-status-codes";

const deliveryProfileInclude = {
  user: true,
  documents: true,
} as const;

type DeliveryProfileClient = Prisma.TransactionClient | typeof prisma;

export type DeliveryPartnerProfileRecord = Prisma.DeliveryPartnerGetPayload<{
  include: typeof deliveryProfileInclude;
}>;

const deliveryProfileNotFoundError = () =>
  new AppError(StatusCodes.NOT_FOUND, "Delivery profile not found", "DELIVERY_PROFILE_NOT_FOUND");

const loadDeliveryPartnerProfile = async (client: DeliveryProfileClient, userId: number) =>
  client.deliveryPartner.findUnique({
    where: { userId },
    include: deliveryProfileInclude,
  });

export const ensureDeliveryPartnerProfileByUserId = async (
  userId: number,
  client: DeliveryProfileClient = prisma,
) => {
  const existingProfile = await loadDeliveryPartnerProfile(client, userId);
  if (existingProfile) {
    return {
      profile: existingProfile,
      wasAutoCreated: false,
    };
  }

  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user || user.role !== Role.DELIVERY_PARTNER) {
    throw deliveryProfileNotFoundError();
  }

  const profile = await client.deliveryPartner.upsert({
    where: { userId },
    update: {},
    create: {
      userId: user.id,
      // The linked user row remains the source of truth for name, email, and phone.
      vehicleType: VehicleType.BIKE,
      availabilityStatus: DeliveryAvailabilityStatus.OFFLINE,
      isVerified: false,
    },
    include: deliveryProfileInclude,
  });

  return {
    profile,
    wasAutoCreated: true,
  };
};
