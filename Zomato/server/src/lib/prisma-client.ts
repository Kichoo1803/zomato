import { Prisma, PrismaClient } from "@prisma/client";

const NULLABLE_FIELDS_BY_MODEL = {
  User: [
    "phone",
    "profileImage",
    "regionId",
    "opsState",
    "opsDistrict",
    "opsNotes",
    "membershipStartedAt",
    "membershipExpiresAt",
    "lastLoginAt",
  ],
  RefreshToken: ["userAgent", "ipAddress", "revokedAt"],
  Address: [
    "title",
    "recipientName",
    "contactPhone",
    "houseNo",
    "street",
    "landmark",
    "area",
    "latitude",
    "longitude",
  ],
  Restaurant: [
    "regionId",
    "description",
    "email",
    "phone",
    "coverImage",
    "logoImage",
    "licenseNumber",
    "openingTime",
    "closingTime",
    "addressLine",
    "area",
    "latitude",
    "longitude",
  ],
  RestaurantCategory: ["description"],
  RestaurantHour: ["openTime", "closeTime"],
  MenuCategory: ["description"],
  MenuItem: ["description", "image", "discountPrice", "calories", "spiceLevel"],
  Combo: ["description", "image", "offerPrice", "categoryTag"],
  ItemAddon: ["menuItemId", "comboId", "description"],
  Offer: ["code", "description", "maxDiscount", "usageLimit", "perUserLimit", "startDate", "endDate"],
  Cart: ["offerId"],
  CartItem: ["menuItemId", "comboId", "itemSnapshot", "specialInstructions"],
  Order: [
    "deliveryPartnerId",
    "offerId",
    "routeDistanceKm",
    "travelDurationMinutes",
    "estimatedDeliveryMinutes",
    "specialInstructions",
    "confirmedAt",
    "acceptedAt",
    "preparingAt",
    "readyForPickupAt",
    "assignedAt",
    "pickedUpAt",
    "onTheWayAt",
    "outForDeliveryAt",
    "delayedAt",
    "deliveredAt",
    "cancelledAt",
    "deletedAt",
  ],
  OrderStatusEvent: ["actorId", "note", "latitude", "longitude"],
  OrderItem: ["menuItemId", "comboId", "itemSnapshot", "foodType"],
  Payment: ["transactionId", "paymentGateway", "paidAt"],
  SavedPaymentMethod: ["label", "holderName", "maskedEnding", "cardBrand", "expiryMonth", "expiryYear", "upiId"],
  DeliveryPartner: [
    "vehicleNumber",
    "licenseNumber",
    "currentLatitude",
    "currentLongitude",
    "lastLocationUpdatedAt",
  ],
  DeliveryAssignmentOffer: ["distanceKm", "respondedAt", "acceptedAt", "closedReason"],
  DeliveryDocument: ["rejectionReason", "reviewedAt"],
  Review: ["orderId", "reviewText"],
  Notification: ["meta"],
  Region: ["notes", "primaryPincode", "managerUserId"],
  OperationsRegionNote: ["regionId", "district", "updatedById"],
  ApprovalRequest: [
    "regionId",
    "beforeSnapshot",
    "reviewComment",
    "reviewedById",
    "reviewedAt",
    "appliedAt",
  ],
  RegistrationApplication: [
    "alternatePhone",
    "regionId",
    "restaurantName",
    "restaurantAddress",
    "fssaiCertificateNumber",
    "vehicleType",
    "vehicleNumber",
    "drivingLicenseNumber",
    "payoutDetails",
    "documents",
    "assignedRegionalManagerId",
    "reviewedById",
    "approvedUserId",
    "reviewRemarks",
    "reviewedAt",
  ],
  Reservation: ["specialRequest", "contactPhone"],
} as const satisfies Record<string, readonly string[]>;

type ModelData = Record<string, unknown>;

const normalizeNullableFields = (model: string, data: ModelData) => {
  const nullableFields = (NULLABLE_FIELDS_BY_MODEL as Record<string, readonly string[]>)[model] ?? [];

  for (const field of nullableFields) {
    if (!(field in data) || data[field] === undefined) {
      data[field] = null;
    }
  }
};

const reserveIds = async (client: PrismaClient, model: string, count: number) => {
  if (count <= 0) {
    return [] as number[];
  }

  const counter = await client.idCounter.upsert({
    where: { id: model },
    create: {
      id: model,
      value: count,
    },
    update: {
      value: {
        increment: count,
      },
    },
  });

  const startingId = counter.value - count + 1;
  return Array.from({ length: count }, (_, index) => startingId + index);
};

const addGeneratedIds = async (client: PrismaClient, model: string, entries: ModelData[]) => {
  const recordsNeedingIds = entries.filter((entry) => entry.id == null || entry.id === 0);

  if (!recordsNeedingIds.length) {
    return;
  }

  const generatedIds = await reserveIds(client, model, recordsNeedingIds.length);
  let nextIdIndex = 0;

  for (const entry of entries) {
    if (entry.id == null || entry.id === 0) {
      entry.id = generatedIds[nextIdIndex];
      nextIdIndex += 1;
    }
  }
};

const toEntryList = (data: unknown): ModelData[] => {
  if (Array.isArray(data)) {
    return data as ModelData[];
  }

  if (data && typeof data === "object") {
    return [data as ModelData];
  }

  return [];
};

export const createPrismaClient = (options?: Prisma.PrismaClientOptions) => {
  const baseClient = new PrismaClient(options);

  const extendedClient = baseClient.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          if (!model || model === "IdCounter") {
            return query(args);
          }

          const nextArgs = args as { data?: ModelData };
          const entries = toEntryList(nextArgs.data);
          entries.forEach((entry) => normalizeNullableFields(model, entry));
          await addGeneratedIds(baseClient, model, entries);

          return query(nextArgs as never);
        },

        async createMany({ model, args, query }) {
          if (!model || model === "IdCounter") {
            return query(args);
          }

          const nextArgs = args as { data?: ModelData | ModelData[] };
          const entries = toEntryList(nextArgs.data);
          entries.forEach((entry) => normalizeNullableFields(model, entry));
          await addGeneratedIds(baseClient, model, entries);

          return query(nextArgs as never);
        },

        async upsert({ model, args, query }) {
          if (!model || model === "IdCounter") {
            return query(args);
          }

          const nextArgs = args as { create?: ModelData };
          const entries = toEntryList(nextArgs.create);
          entries.forEach((entry) => normalizeNullableFields(model, entry));
          await addGeneratedIds(baseClient, model, entries);

          return query(nextArgs as never);
        },
      },
    },
  });

  return Object.assign(extendedClient, {
    $connect: baseClient.$connect.bind(baseClient),
    $disconnect: baseClient.$disconnect.bind(baseClient),
  }) as PrismaClient;
};

export type AppPrismaClient = PrismaClient;
