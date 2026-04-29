import { Prisma } from "@prisma/client";
import { Role } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import {
  INDIA_PINCODE_REGEX,
  isValidDistrictForState,
  isValidIndianState,
} from "../../lib/india-region-data.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { buildRegionIdentity, isRegionalOperationsRole, normalizeRegionValue } from "../../utils/regions.js";

type RegionWriteClient = Prisma.TransactionClient | typeof prisma;

type RegionListFilters = {
  search?: string;
  isActive?: boolean;
  assignmentStatus?: "ASSIGNED" | "UNASSIGNED";
};

type RegionManagerProfile = {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  profileImage?: string | null;
  role: string;
  isActive: boolean;
};

const regionManagerSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  profileImage: true,
  role: true,
  isActive: true,
} satisfies Prisma.UserSelect;

const regionAdminSelect = {
  id: true,
  name: true,
  districtName: true,
  stateName: true,
  code: true,
  slug: true,
  notes: true,
  primaryPincode: true,
  additionalPincodes: true,
  isActive: true,
  managerUserId: true,
  createdAt: true,
  updatedAt: true,
  manager: {
    select: regionManagerSelect,
  },
} satisfies Prisma.RegionSelect;

const managedRegionScopeSelect = {
  id: true,
  stateName: true,
  districtName: true,
} satisfies Prisma.RegionSelect;

const normalizeRegionCode = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
};

const normalizeRegionSlug = (value?: string | null) => {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
};

const normalizeRegionNotes = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizePincode = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizePincodeList = (values?: string[] | null, primaryPincode?: string | null) => {
  const primary = normalizePincode(primaryPincode);

  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]
    .filter((value) => value !== primary)
    .sort((left, right) => left.localeCompare(right, "en-IN"));
};

const ensureRegionIdentity = (stateName?: string | null, districtName?: string | null) => {
  const identity = buildRegionIdentity(stateName, districtName);

  if (!identity) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "State and district are required to define a region",
      "REGION_IDENTITY_REQUIRED",
    );
  }

  return identity;
};

const assertValidRegionCoverage = (input: {
  stateName: string;
  districtName: string;
  primaryPincode?: string | null;
  additionalPincodes?: string[] | null;
}) => {
  if (!isValidIndianState(input.stateName)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Select a valid Indian state or union territory",
      "INVALID_REGION_STATE",
    );
  }

  if (!isValidDistrictForState(input.stateName, input.districtName)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Select a district that belongs to the chosen state or union territory",
      "INVALID_REGION_DISTRICT",
    );
  }

  if (input.primaryPincode && !INDIA_PINCODE_REGEX.test(input.primaryPincode)) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Primary PIN code is invalid", "INVALID_REGION_PINCODE");
  }

  for (const pincode of input.additionalPincodes ?? []) {
    if (!INDIA_PINCODE_REGEX.test(pincode)) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Additional PIN codes must use a valid 6-digit Indian format",
        "INVALID_REGION_PINCODE",
      );
    }
  }
};

const validateManagerCandidate = async (client: RegionWriteClient, managerUserId: number) => {
  const user = await client.user.findUnique({
    where: { id: managerUserId },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  });

  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, "Regional manager not found", "REGIONAL_MANAGER_NOT_FOUND");
  }

  if (!isRegionalOperationsRole(user.role)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Only regional manager accounts can be assigned to a region",
      "INVALID_REGION_MANAGER_ROLE",
    );
  }

  if (!user.isActive) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Only active regional manager accounts can be assigned to a region",
      "REGIONAL_MANAGER_INACTIVE",
    );
  }

  return user;
};

const getManagedRegionsForManager = async (client: RegionWriteClient, managerUserId: number) =>
  client.region.findMany({
    where: {
      managerUserId,
    },
    select: managedRegionScopeSelect,
    orderBy: [{ stateName: "asc" }, { districtName: "asc" }, { id: "asc" }],
  });

const syncRegionalManagerScope = async (client: RegionWriteClient, managerUserId: number) => {
  const [primaryRegion] = await getManagedRegionsForManager(client, managerUserId);

  await client.user.updateMany({
    where: {
      id: managerUserId,
    },
    data: {
      regionId: primaryRegion?.id ?? null,
      opsState: primaryRegion?.stateName ?? null,
      opsDistrict: primaryRegion?.districtName ?? null,
    },
  });
};

const assertAssignableRegionIds = async (client: RegionWriteClient, regionIds: number[]) => {
  const uniqueRegionIds = [...new Set(regionIds)];

  if (!uniqueRegionIds.length) {
    return uniqueRegionIds;
  }

  const regions = await client.region.findMany({
    where: {
      id: {
        in: uniqueRegionIds,
      },
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (regions.length !== uniqueRegionIds.length) {
    throw new AppError(StatusCodes.NOT_FOUND, "One or more regions were not found", "REGION_NOT_FOUND");
  }

  if (regions.some((region) => !region.isActive)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Inactive regions cannot be assigned to a regional manager",
      "REGION_INACTIVE",
    );
  }

  return uniqueRegionIds;
};

const assertSingleRegionalManagerAssignment = (regionIds: number[]) => {
  if (regionIds.length > 1) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Regional managers can only be assigned to one region at a time",
      "REGIONAL_MANAGER_SINGLE_REGION_ONLY",
    );
  }

  return regionIds;
};

export const clearRegionalManagerAssignments = async (
  client: RegionWriteClient,
  managerUserId: number,
) => {
  await client.region.updateMany({
    where: {
      managerUserId,
    },
    data: {
      managerUserId: null,
    },
  });

  await syncRegionalManagerScope(client, managerUserId);
};

export const replaceRegionalManagerAssignments = async (
  client: RegionWriteClient,
  managerUserId: number,
  regionIds: number[],
) => {
  await validateManagerCandidate(client, managerUserId);
  const nextRegionIds = assertSingleRegionalManagerAssignment(
    await assertAssignableRegionIds(client, regionIds),
  );
  const [nextRegionId] = nextRegionIds;
  const targetRegion = nextRegionId
    ? await client.region.findUnique({
        where: {
          id: nextRegionId,
        },
        select: {
          id: true,
          managerUserId: true,
        },
      })
    : null;

  const affectedManagerIds = new Set<number>([managerUserId]);
  if (targetRegion?.managerUserId && targetRegion.managerUserId !== managerUserId) {
    affectedManagerIds.add(targetRegion.managerUserId);
  }

  await client.region.updateMany({
    where: {
      managerUserId,
      ...(nextRegionId
        ? {
            id: {
              not: nextRegionId,
            },
          }
        : {}),
    },
    data: {
      managerUserId: null,
    },
  });

  if (nextRegionId) {
    await client.region.update({
      where: {
        id: nextRegionId,
      },
      data: {
        managerUserId,
      },
    });
  }

  await Promise.all([...affectedManagerIds].map((userId) => syncRegionalManagerScope(client, userId)));
};

const syncRegionManagerAssignment = async (
  client: RegionWriteClient,
  input: {
    regionId: number;
    nextManagerUserId: number | null;
    previousManagerUserId: number | null;
  },
) => {
  if (input.nextManagerUserId) {
    await validateManagerCandidate(client, input.nextManagerUserId);

    await client.region.updateMany({
      where: {
        managerUserId: input.nextManagerUserId,
        id: {
          not: input.regionId,
        },
      },
      data: {
        managerUserId: null,
      },
    });
  }

  const affectedManagerIds = new Set<number>();

  if (input.previousManagerUserId) {
    affectedManagerIds.add(input.previousManagerUserId);
  }

  if (input.nextManagerUserId) {
    affectedManagerIds.add(input.nextManagerUserId);
  }

  await Promise.all([...affectedManagerIds].map((userId) => syncRegionalManagerScope(client, userId)));
};

const assertRegionUniqueness = async (
  client: RegionWriteClient,
  input: {
    stateName: string;
    districtName: string;
    code: string;
    slug: string;
    excludeRegionId?: number;
  },
) => {
  const regionConflict = await client.region.findFirst({
    where: {
      stateName: input.stateName,
      districtName: input.districtName,
      ...(input.excludeRegionId
        ? {
            NOT: {
              id: input.excludeRegionId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (regionConflict) {
    throw new AppError(
      StatusCodes.CONFLICT,
      "A region for this district and state already exists",
      "REGION_ALREADY_EXISTS",
    );
  }

  const [codeConflict, slugConflict] = await Promise.all([
    client.region.findFirst({
      where: {
        code: input.code,
        ...(input.excludeRegionId
          ? {
              NOT: {
                id: input.excludeRegionId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    }),
    client.region.findFirst({
      where: {
        slug: input.slug,
        ...(input.excludeRegionId
          ? {
              NOT: {
                id: input.excludeRegionId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (codeConflict) {
    throw new AppError(StatusCodes.CONFLICT, "Region code already exists", "REGION_CODE_TAKEN");
  }

  if (slugConflict) {
    throw new AppError(StatusCodes.CONFLICT, "Region slug already exists", "REGION_SLUG_TAKEN");
  }
};

const getRegionCounts = async (regionId: number) => {
  const [restaurantsCount, deliveryPartnersCount, usersCount] = await Promise.all([
    prisma.restaurant.count({
      where: {
        regionId,
      },
    }),
    prisma.user.count({
      where: {
        regionId,
        role: Role.DELIVERY_PARTNER,
      },
    }),
    prisma.user.count({
      where: {
        regionId,
      },
    }),
  ]);

  return {
    restaurantsCount,
    deliveryPartnersCount,
    usersCount,
  };
};

const toAdminRegion = async (
  region: Prisma.RegionGetPayload<{ select: typeof regionAdminSelect }>,
) => ({
  ...region,
  stateName: normalizeRegionValue(region.stateName) ?? region.stateName,
  districtName: normalizeRegionValue(region.districtName) ?? region.districtName,
  notes: region.notes ?? null,
  primaryPincode: region.primaryPincode ?? null,
  additionalPincodes: region.additionalPincodes ?? [],
  manager: (region.manager as RegionManagerProfile | null) ?? null,
  counts: await getRegionCounts(region.id),
});

export const resolveRegionIdForAssignment = async (
  client: RegionWriteClient,
  state?: string | null,
  district?: string | null,
) => {
  const identity = buildRegionIdentity(state, district);

  if (!identity) {
    return null;
  }

  const existingRegion = await client.region.findFirst({
    where: {
      stateName: identity.state,
      districtName: identity.district,
    },
    select: {
      id: true,
    },
  });

  const region = existingRegion
    ? await client.region.update({
        where: {
          id: existingRegion.id,
        },
        data: {
          stateName: identity.state,
          districtName: identity.district,
        },
        select: {
          id: true,
          name: true,
          stateName: true,
          districtName: true,
          code: true,
          slug: true,
        },
      })
    : await client.region.create({
        data: {
          name: identity.name,
          stateName: identity.state,
          districtName: identity.district,
          code: identity.code,
          slug: identity.slug,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          stateName: true,
          districtName: true,
          code: true,
          slug: true,
        },
      });

  return region;
};

export const syncRestaurantsRegionForOwner = async (
  client: RegionWriteClient,
  ownerId: number,
  regionId: number | null,
) => {
  await client.restaurant.updateMany({
    where: { ownerId },
    data: {
      regionId,
    },
  });
};

export const regionsAdminService = {
  async list(filters?: RegionListFilters) {
    const search = filters?.search?.trim();
    const regions = await prisma.region.findMany({
      where: {
        ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
        ...(filters?.assignmentStatus === "ASSIGNED" ? { managerUserId: { not: null } } : {}),
        ...(filters?.assignmentStatus === "UNASSIGNED" ? { managerUserId: null } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { districtName: { contains: search } },
                { stateName: { contains: search } },
                { code: { contains: search } },
                { slug: { contains: search } },
                { primaryPincode: { contains: search } },
                { additionalPincodes: { has: search } },
                {
                  manager: {
                    is: {
                      OR: [{ fullName: { contains: search } }, { email: { contains: search } }],
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: regionAdminSelect,
      orderBy: [{ stateName: "asc" }, { districtName: "asc" }, { name: "asc" }],
    });

    return Promise.all(regions.map((region) => toAdminRegion(region)));
  },

  async create(input: {
    name?: string;
    districtName: string;
    stateName: string;
    code?: string;
    slug?: string;
    notes?: string;
    primaryPincode?: string;
    additionalPincodes?: string[];
    isActive?: boolean;
    managerUserId?: number | null;
  }) {
    const identity = ensureRegionIdentity(input.stateName, input.districtName);
    const nextStateName = identity.state;
    const nextDistrictName = identity.district;
    const nextName = normalizeRegionValue(input.name) ?? identity.name;
    const nextCode = normalizeRegionCode(input.code) ?? identity.code;
    const nextSlug = normalizeRegionSlug(input.slug) ?? identity.slug;
    const nextNotes = normalizeRegionNotes(input.notes);
    const nextPrimaryPincode = normalizePincode(input.primaryPincode);
    const nextAdditionalPincodes = normalizePincodeList(input.additionalPincodes, nextPrimaryPincode);
    const nextIsActive = input.isActive ?? true;
    const nextManagerUserId = input.managerUserId ?? null;

    assertValidRegionCoverage({
      stateName: nextStateName,
      districtName: nextDistrictName,
      primaryPincode: nextPrimaryPincode,
      additionalPincodes: nextAdditionalPincodes,
    });

    if (nextManagerUserId && !nextIsActive) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Inactive regions cannot be assigned to a regional manager",
        "REGION_INACTIVE",
      );
    }

    const region = await prisma.$transaction(async (tx) => {
      await assertRegionUniqueness(tx, {
        stateName: nextStateName,
        districtName: nextDistrictName,
        code: nextCode,
        slug: nextSlug,
      });

      const createdRegion = await tx.region.create({
        data: {
          name: nextName,
          districtName: nextDistrictName,
          stateName: nextStateName,
          code: nextCode,
          slug: nextSlug,
          notes: nextNotes,
          primaryPincode: nextPrimaryPincode,
          additionalPincodes: nextAdditionalPincodes,
          isActive: nextIsActive,
          managerUserId: nextManagerUserId,
        },
        select: regionAdminSelect,
      });

      await syncRegionManagerAssignment(tx, {
        regionId: createdRegion.id,
        nextManagerUserId,
        previousManagerUserId: null,
      });

      return tx.region.findUniqueOrThrow({
        where: { id: createdRegion.id },
        select: regionAdminSelect,
      });
    });

    return toAdminRegion(region);
  },

  async update(
    regionId: number,
    input: Partial<{
      name: string;
      districtName: string;
      stateName: string;
      code: string;
      slug: string;
      notes: string;
      primaryPincode: string;
      additionalPincodes: string[];
      isActive: boolean;
      managerUserId: number | null;
    }>,
  ) {
    const existingRegion = await prisma.region.findUnique({
      where: { id: regionId },
      select: regionAdminSelect,
    });

    if (!existingRegion) {
      throw new AppError(StatusCodes.NOT_FOUND, "Region not found", "REGION_NOT_FOUND");
    }

    const identity = ensureRegionIdentity(
      input.stateName ?? existingRegion.stateName,
      input.districtName ?? existingRegion.districtName,
    );
    const nextStateName = identity.state;
    const nextDistrictName = identity.district;
    const nextName =
      input.name !== undefined
        ? normalizeRegionValue(input.name) ?? identity.name
        : existingRegion.name;
    const nextCode =
      input.code !== undefined
        ? normalizeRegionCode(input.code) ?? identity.code
        : existingRegion.code;
    const nextSlug =
      input.slug !== undefined
        ? normalizeRegionSlug(input.slug) ?? identity.slug
        : existingRegion.slug;
    const nextNotes =
      input.notes !== undefined ? normalizeRegionNotes(input.notes) : existingRegion.notes;
    const nextPrimaryPincode =
      input.primaryPincode !== undefined
        ? normalizePincode(input.primaryPincode)
        : existingRegion.primaryPincode;
    const nextAdditionalPincodes =
      input.additionalPincodes !== undefined
        ? normalizePincodeList(input.additionalPincodes, nextPrimaryPincode)
        : normalizePincodeList(existingRegion.additionalPincodes, nextPrimaryPincode);
    const nextIsActive = input.isActive ?? existingRegion.isActive;
    const nextManagerUserId =
      input.managerUserId !== undefined ? input.managerUserId : existingRegion.managerUserId;

    assertValidRegionCoverage({
      stateName: nextStateName,
      districtName: nextDistrictName,
      primaryPincode: nextPrimaryPincode,
      additionalPincodes: nextAdditionalPincodes,
    });

    if (nextManagerUserId && !nextIsActive) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Inactive regions cannot be assigned to a regional manager",
        "REGION_INACTIVE",
      );
    }

    const stateChanged = nextStateName !== existingRegion.stateName;
    const districtChanged = nextDistrictName !== existingRegion.districtName;
    const managerChanged = nextManagerUserId !== existingRegion.managerUserId;

    const updatedRegion = await prisma.$transaction(async (tx) => {
      await assertRegionUniqueness(tx, {
        stateName: nextStateName,
        districtName: nextDistrictName,
        code: nextCode,
        slug: nextSlug,
        excludeRegionId: regionId,
      });

      await tx.region.update({
        where: { id: regionId },
        data: {
          name: nextName,
          districtName: nextDistrictName,
          stateName: nextStateName,
          code: nextCode,
          slug: nextSlug,
          notes: nextNotes,
          primaryPincode: nextPrimaryPincode,
          additionalPincodes: nextAdditionalPincodes,
          isActive: nextIsActive,
          ...(input.managerUserId !== undefined ? { managerUserId: nextManagerUserId } : {}),
        },
      });

      if (stateChanged || districtChanged) {
        await Promise.all([
          tx.user.updateMany({
            where: {
              regionId,
            },
            data: {
              opsState: nextStateName,
              opsDistrict: nextDistrictName,
            },
          }),
          tx.operationsRegionNote.updateMany({
            where: {
              regionId,
            },
            data: {
              state: nextStateName,
              district: nextDistrictName,
            },
          }),
        ]);
      }

      if (managerChanged || stateChanged || districtChanged) {
        await syncRegionManagerAssignment(tx, {
          regionId,
          nextManagerUserId: nextManagerUserId ?? null,
          previousManagerUserId: existingRegion.managerUserId ?? null,
        });
      }

      return tx.region.findUniqueOrThrow({
        where: { id: regionId },
        select: regionAdminSelect,
      });
    });

    return toAdminRegion(updatedRegion);
  },
};
