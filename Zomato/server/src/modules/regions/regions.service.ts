import { Prisma } from "@prisma/client";
import { EventStatus, OrderStatus, Role } from "../../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import {
  INDIA_PINCODE_REGEX,
  isValidDistrictForState,
  isValidIndianState,
} from "../../lib/india-region-data.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { ApprovalRequestStatus } from "../approval-requests/approval-request.constants.js";
import { RegistrationApplicationStatus } from "../registration-applications/registration-applications.constants.js";
import {
  buildRegionIdentity,
  buildRegionIdentityKey,
  getRegionStateVariants,
  isRegionalOperationsRole,
  normalizeRegionCode,
  normalizeRegionValue,
} from "../../utils/regions.js";

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

type RegionUsageSummary = {
  restaurantsCount: number;
  deliveryPartnersCount: number;
  usersCount: number;
  pendingApplicationsCount: number;
  activeOrdersCount: number;
  activeEventsCount: number;
  canDelete: boolean;
  deleteBlockedReason: string | null;
};

const terminalOrderStatuses = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.PAYMENT_FAILED,
  OrderStatus.REFUNDED,
];
const activeEventStatuses = [EventStatus.ACTIVE, EventStatus.UPCOMING, EventStatus.LIVE];
const regionDeleteBlockedMessage =
  "Cannot delete this region because it has linked restaurants, users, delivery partners, or applications.";

const isPrismaUniqueConstraintError = (
  error: unknown,
): error is Error & { code: string; meta?: { target?: unknown } } =>
  error instanceof Error &&
  error.name === "PrismaClientKnownRequestError" &&
  Reflect.get(error, "code") === "P2002";

const getUniqueConstraintTargets = (error: { meta?: { target?: unknown } }) => {
  const rawTarget = error.meta?.target;

  if (Array.isArray(rawTarget)) {
    return rawTarget.filter((value): value is string => typeof value === "string");
  }

  return typeof rawTarget === "string" ? [rawTarget] : [];
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

const regionIdentitySelect = {
  id: true,
  name: true,
  districtName: true,
  stateName: true,
  code: true,
  slug: true,
  isActive: true,
  managerUserId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RegionSelect;

type RegionAdminRecord = Prisma.RegionGetPayload<{ select: typeof regionAdminSelect }>;
type RegionIdentityRecord = Prisma.RegionGetPayload<{ select: typeof regionIdentitySelect }>;

const managedRegionScopeSelect = {
  id: true,
  stateName: true,
  districtName: true,
} satisfies Prisma.RegionSelect;

const normalizeRegionSlug = (value?: string | null) => {
  const trimmed = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return trimmed ? trimmed : null;
};

const normalizeSearchValue = (value?: string | null) => normalizeRegionValue(value)?.toLowerCase() ?? "";

const compareRegionsForPriority = <
  T extends {
    managerUserId?: number | null;
    isActive: boolean;
    createdAt: Date;
    id: number;
  },
>(
  left: T,
  right: T,
) => {
  const leftAssignedScore = left.managerUserId ? 1 : 0;
  const rightAssignedScore = right.managerUserId ? 1 : 0;

  if (leftAssignedScore !== rightAssignedScore) {
    return rightAssignedScore - leftAssignedScore;
  }

  if (left.isActive !== right.isActive) {
    return Number(right.isActive) - Number(left.isActive);
  }

  const createdAtDifference = left.createdAt.getTime() - right.createdAt.getTime();

  if (createdAtDifference !== 0) {
    return createdAtDifference;
  }

  return left.id - right.id;
};

const selectPrimaryRegion = <
  T extends {
    managerUserId?: number | null;
    isActive: boolean;
    createdAt: Date;
    id: number;
  },
>(
  regions: T[],
) => [...regions].sort(compareRegionsForPriority)[0] ?? null;

const getRegionIdentityKeyFromRecord = (region: {
  stateName?: string | null;
  districtName?: string | null;
}) => buildRegionIdentityKey(region.stateName, region.districtName);

const matchesRegionIdentity = (
  region: Pick<RegionIdentityRecord, "stateName" | "districtName" | "code" | "slug">,
  input: {
    stateName?: string | null;
    districtName?: string | null;
    code?: string | null;
    slug?: string | null;
  },
) => {
  const targetIdentityKey = buildRegionIdentityKey(input.stateName, input.districtName);
  const regionIdentityKey = getRegionIdentityKeyFromRecord(region);

  if (targetIdentityKey && regionIdentityKey === targetIdentityKey) {
    return true;
  }

  const targetCode = normalizeRegionCode(input.code);
  const regionCode = normalizeRegionCode(region.code);

  if (targetCode && regionCode === targetCode) {
    return true;
  }

  const targetSlug = normalizeRegionSlug(input.slug);
  const regionSlug = normalizeRegionSlug(region.slug);

  return Boolean(targetSlug && regionSlug === targetSlug);
};

const findMatchingRegions = async (
  client: RegionWriteClient,
  input: {
    stateName?: string | null;
    districtName?: string | null;
    code?: string | null;
    slug?: string | null;
    excludeRegionId?: number;
  },
) => {
  const regions = await client.region.findMany({
    select: regionIdentitySelect,
  });

  return regions.filter(
    (region) =>
      region.id !== input.excludeRegionId &&
      matchesRegionIdentity(region, {
        stateName: input.stateName,
        districtName: input.districtName,
        code: input.code,
        slug: input.slug,
      }),
  );
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

const buildRegionIdFieldFilter = (regionIds: number[]) =>
  regionIds.length === 1 ? regionIds[0] : { in: regionIds };

const buildDeleteBlockedReason = (input: {
  managerUserId?: number | null;
  restaurantsCount: number;
  deliveryPartnersCount: number;
  usersCount: number;
  pendingApplicationsCount: number;
  activeOrdersCount: number;
  activeEventsCount: number;
}) =>
  input.managerUserId ||
  input.restaurantsCount > 0 ||
  input.deliveryPartnersCount > 0 ||
  input.usersCount > 0 ||
  input.pendingApplicationsCount > 0 ||
  input.activeOrdersCount > 0 ||
  input.activeEventsCount > 0
    ? regionDeleteBlockedMessage
    : null;

const translateRegionUniqueConstraintError = (error: unknown) => {
  if (!isPrismaUniqueConstraintError(error)) {
    return null;
  }

  const targets = getUniqueConstraintTargets(error);

  if (targets.includes("state_name") || targets.includes("district_name")) {
    return new AppError(StatusCodes.CONFLICT, "Region already exists.", "REGION_ALREADY_EXISTS");
  }

  if (targets.includes("code")) {
    return new AppError(StatusCodes.CONFLICT, "Region code already exists", "REGION_CODE_TAKEN");
  }

  if (targets.includes("slug")) {
    return new AppError(StatusCodes.CONFLICT, "Region slug already exists", "REGION_SLUG_TAKEN");
  }

  return new AppError(StatusCodes.CONFLICT, "Region already exists.", "REGION_ALREADY_EXISTS");
};

const assertManagerReplacementConfirmed = (input: {
  currentManagerUserId?: number | null;
  nextManagerUserId?: number | null;
  confirmManagerReplacement?: boolean;
}) => {
  if (
    input.currentManagerUserId &&
    input.nextManagerUserId &&
    input.currentManagerUserId !== input.nextManagerUserId &&
    !input.confirmManagerReplacement
  ) {
    throw new AppError(
      StatusCodes.CONFLICT,
      "This region is already assigned to another regional manager. Confirm replacement to continue.",
      "REGION_MANAGER_REPLACEMENT_CONFIRMATION_REQUIRED",
    );
  }
};

const getCanonicalRegionGroup = async (client: RegionWriteClient, regionId: number) => {
  const targetRegion = await client.region.findUnique({
    where: {
      id: regionId,
    },
    select: regionAdminSelect,
  });

  if (!targetRegion) {
    throw new AppError(StatusCodes.NOT_FOUND, "Region not found", "REGION_NOT_FOUND");
  }

  const matchingRegions = await findMatchingRegions(client, {
    stateName: targetRegion.stateName,
    districtName: targetRegion.districtName,
    code: targetRegion.code,
    slug: targetRegion.slug,
  });
  const matchingRegionIds = matchingRegions.map((region) => region.id);
  const duplicateGroup =
    matchingRegionIds.length > 1
      ? await client.region.findMany({
          where: {
            id: {
              in: matchingRegionIds,
            },
          },
          select: regionAdminSelect,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
      : [targetRegion];
  const primaryRegion = selectPrimaryRegion(duplicateGroup) ?? targetRegion;

  return {
    targetRegion,
    primaryRegion,
    duplicateGroup,
    mergedRegionIds: duplicateGroup.map((region) => region.id),
  };
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
  const primaryRegionIdentity = buildRegionIdentity(primaryRegion?.stateName, primaryRegion?.districtName);

  await client.user.updateMany({
    where: {
      id: managerUserId,
    },
    data: {
      regionId: primaryRegion?.id ?? null,
      opsState: primaryRegionIdentity?.state ?? primaryRegion?.stateName ?? null,
      opsDistrict: primaryRegionIdentity?.district ?? primaryRegion?.districtName ?? null,
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
  const currentManagedRegions = await getManagedRegionsForManager(client, managerUserId);
  await client.region.updateMany({
    where: {
      managerUserId,
    },
    data: {
      managerUserId: null,
    },
  });

  await syncPendingApplicationsForRegions(
    client,
    currentManagedRegions.map((region) => region.id),
  );
  await syncRegionalManagerScope(client, managerUserId);
};

export const replaceRegionalManagerAssignments = async (
  client: RegionWriteClient,
  managerUserId: number,
  regionIds: number[],
  options?: {
    confirmManagerReplacement?: boolean;
  },
) => {
  await validateManagerCandidate(client, managerUserId);
  const currentManagedRegions = await getManagedRegionsForManager(client, managerUserId);
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

  assertManagerReplacementConfirmed({
    currentManagerUserId: targetRegion?.managerUserId,
    nextManagerUserId: managerUserId,
    confirmManagerReplacement: options?.confirmManagerReplacement,
  });

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

  await syncPendingApplicationsForRegions(client, [
    ...currentManagedRegions.map((region) => region.id),
    ...(nextRegionId ? [nextRegionId] : []),
  ]);
  await Promise.all([...affectedManagerIds].map((userId) => syncRegionalManagerScope(client, userId)));
};

const syncRegionManagerAssignment = async (
  client: RegionWriteClient,
  input: {
    regionId: number;
    nextManagerUserId: number | null;
    previousManagerUserId: number | null;
    confirmManagerReplacement?: boolean;
  },
) => {
  assertManagerReplacementConfirmed({
    currentManagerUserId: input.previousManagerUserId,
    nextManagerUserId: input.nextManagerUserId,
    confirmManagerReplacement: input.confirmManagerReplacement,
  });

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

  await syncPendingApplicationsForRegions(client, [input.regionId]);
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
  const matchingRegions = await findMatchingRegions(client, input);

  if (matchingRegions.some((region) => getRegionIdentityKeyFromRecord(region) === buildRegionIdentityKey(input.stateName, input.districtName))) {
    throw new AppError(
      StatusCodes.CONFLICT,
      "Region already exists.",
      "REGION_ALREADY_EXISTS",
    );
  }

  const normalizedCode = normalizeRegionCode(input.code);
  const normalizedSlug = normalizeRegionSlug(input.slug);
  const codeConflict = matchingRegions.find((region) => normalizeRegionCode(region.code) === normalizedCode);
  const slugConflict = matchingRegions.find((region) => normalizeRegionSlug(region.slug) === normalizedSlug);

  if (codeConflict) {
    throw new AppError(StatusCodes.CONFLICT, "Region code already exists", "REGION_CODE_TAKEN");
  }

  if (slugConflict) {
    throw new AppError(StatusCodes.CONFLICT, "Region slug already exists", "REGION_SLUG_TAKEN");
  }
};

const getRegionUsageSummary = async (
  regionIds: number | number[],
  managerUserId?: number | null,
): Promise<RegionUsageSummary> => {
  const uniqueRegionIds = [...new Set(Array.isArray(regionIds) ? regionIds : [regionIds])].filter(
    (regionId) => Number.isInteger(regionId) && regionId > 0,
  );

  if (!uniqueRegionIds.length) {
    return {
      restaurantsCount: 0,
      deliveryPartnersCount: 0,
      usersCount: 0,
      pendingApplicationsCount: 0,
      activeOrdersCount: 0,
      activeEventsCount: 0,
      canDelete: managerUserId == null,
      deleteBlockedReason: managerUserId ? regionDeleteBlockedMessage : null,
    };
  }

  const regionIdFilter = buildRegionIdFieldFilter(uniqueRegionIds);
  const [restaurantsCount, deliveryPartnersCount, usersCount, pendingRegistrationApplicationsCount, pendingApprovalRequestsCount, activeOrdersCount, activeEventsCount] = await Promise.all([
    prisma.restaurant.count({
      where: {
        regionId: regionIdFilter,
      },
    }),
    prisma.user.count({
      where: {
        regionId: regionIdFilter,
        role: Role.DELIVERY_PARTNER,
      },
    }),
    prisma.user.count({
      where: {
        regionId: regionIdFilter,
      },
    }),
    prisma.registrationApplication.count({
      where: {
        regionId: regionIdFilter,
        status: RegistrationApplicationStatus.PENDING,
      },
    }),
    prisma.approvalRequest.count({
      where: {
        regionId: regionIdFilter,
        status: ApprovalRequestStatus.PENDING,
      },
    }),
    prisma.order.count({
      where: {
        deletedAt: null,
        status: {
          notIn: terminalOrderStatuses,
        },
        restaurant: {
          regionId: regionIdFilter,
        },
      },
    }),
    prisma.event.count({
      where: {
        status: {
          in: activeEventStatuses,
        },
        OR: [{ regionId: regionIdFilter }, { restaurant: { regionId: regionIdFilter } }],
      },
    }),
  ]);
  const pendingApplicationsCount = pendingRegistrationApplicationsCount + pendingApprovalRequestsCount;
  const deleteBlockedReason = buildDeleteBlockedReason({
    managerUserId,
    restaurantsCount,
    deliveryPartnersCount,
    usersCount,
    pendingApplicationsCount,
    activeOrdersCount,
    activeEventsCount,
  });

  return {
    restaurantsCount,
    deliveryPartnersCount,
    usersCount,
    pendingApplicationsCount,
    activeOrdersCount,
    activeEventsCount,
    canDelete: deleteBlockedReason == null,
    deleteBlockedReason,
  };
};

const toAdminRegion = async (
  region: RegionAdminRecord,
  options?: {
    mergedRegionIds?: number[];
    mergedPrimaryPincode?: string | null;
    mergedAdditionalPincodes?: string[];
    usageSummary?: RegionUsageSummary;
    isActive?: boolean;
    duplicateRegionIds?: number[];
  },
) => {
  const identity = buildRegionIdentity(region.stateName, region.districtName);
  const mergedAdditionalPincodes = [...new Set(options?.mergedAdditionalPincodes ?? region.additionalPincodes ?? [])]
    .map((value) => normalizePincode(value))
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => left.localeCompare(right, "en-IN"));
  const usageSummary =
    options?.usageSummary ??
    (await getRegionUsageSummary(options?.mergedRegionIds ?? [region.id], region.managerUserId ?? null));

  return {
    ...region,
    name: identity?.name ?? normalizeRegionValue(region.name) ?? region.name,
    stateName: identity?.state ?? normalizeRegionValue(region.stateName) ?? region.stateName,
    districtName: identity?.district ?? normalizeRegionValue(region.districtName) ?? region.districtName,
    code: normalizeRegionCode(region.code) ?? identity?.code ?? region.code,
    slug: normalizeRegionSlug(region.slug) ?? identity?.slug ?? region.slug,
    notes: region.notes ?? null,
    primaryPincode: normalizePincode(options?.mergedPrimaryPincode ?? region.primaryPincode) ?? null,
    additionalPincodes: mergedAdditionalPincodes,
    isActive: options?.isActive ?? region.isActive,
    manager: (region.manager as RegionManagerProfile | null) ?? null,
    hasDuplicates: Boolean(options?.duplicateRegionIds?.length),
    duplicateRegionIds: options?.duplicateRegionIds ?? [],
    canDelete: usageSummary.canDelete,
    deleteBlockedReason: usageSummary.deleteBlockedReason,
    counts: {
      restaurantsCount: usageSummary.restaurantsCount,
      deliveryPartnersCount: usageSummary.deliveryPartnersCount,
      usersCount: usageSummary.usersCount,
      pendingApplicationsCount: usageSummary.pendingApplicationsCount,
      activeOrdersCount: usageSummary.activeOrdersCount,
      activeEventsCount: usageSummary.activeEventsCount,
    },
  };
};

export const resolveRegionIdForAssignment = async (
  client: RegionWriteClient,
  state?: string | null,
  district?: string | null,
) => {
  const identity = buildRegionIdentity(state, district);

  if (!identity) {
    return null;
  }

  const matchingRegions = await findMatchingRegions(client, {
    stateName: identity.state,
    districtName: identity.district,
    code: identity.code,
    slug: identity.slug,
  });
  const existingRegion = selectPrimaryRegion(matchingRegions);
  const hasDuplicateMatches = matchingRegions.length > 1;

  const region = existingRegion
    ? hasDuplicateMatches
      ? await client.region.findUniqueOrThrow({
          where: {
            id: existingRegion.id,
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
      : await client.region.update({
          where: {
            id: existingRegion.id,
          },
          data: {
            name: identity.name,
            stateName: identity.state,
            districtName: identity.district,
            code: identity.code,
            slug: identity.slug,
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
    : await client.region
        .create({
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
        })
        .catch(async (error) => {
          const translatedError = translateRegionUniqueConstraintError(error);

          if (!translatedError) {
            throw error;
          }

          const concurrentMatches = await findMatchingRegions(client, {
            stateName: identity.state,
            districtName: identity.district,
            code: identity.code,
            slug: identity.slug,
          });
          const concurrentPrimaryRegion = selectPrimaryRegion(concurrentMatches);

          if (!concurrentPrimaryRegion) {
            throw translatedError;
          }

          return client.region.findUniqueOrThrow({
            where: {
              id: concurrentPrimaryRegion.id,
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

const syncPendingApplicationsForRegions = async (
  client: RegionWriteClient,
  regionIds: number[],
) => {
  const uniqueRegionIds = [...new Set(regionIds)].filter((regionId) => Number.isInteger(regionId) && regionId > 0);

  if (!uniqueRegionIds.length) {
    return;
  }

  const regions = await client.region.findMany({
    where: {
      id: {
        in: uniqueRegionIds,
      },
    },
    select: {
      id: true,
      managerUserId: true,
    },
  });

  await Promise.all(
    regions.map((region) =>
      client.registrationApplication.updateMany({
        where: {
          regionId: region.id,
          status: RegistrationApplicationStatus.PENDING,
        },
        data: {
          assignedRegionalManagerId: region.managerUserId ?? null,
        },
      }),
    ),
  );
};

export const regionsAdminService = {
  async list(filters?: RegionListFilters) {
    const search = normalizeSearchValue(filters?.search);
    const regions = await prisma.region.findMany({
      select: regionAdminSelect,
      orderBy: [{ stateName: "asc" }, { districtName: "asc" }, { name: "asc" }],
    });

    const groupedRegions = new Map<string, RegionAdminRecord[]>();

    for (const region of regions) {
      const identityKey =
        getRegionIdentityKeyFromRecord(region) ??
        `${getRegionStateVariants(region.stateName)[0] ?? region.stateName}::${region.id}`;
      const currentGroup = groupedRegions.get(identityKey) ?? [];
      currentGroup.push(region);
      groupedRegions.set(identityKey, currentGroup);
    }

    const adminRegions = await Promise.all(
      [...groupedRegions.values()].map(async (duplicateGroup) => {
        const primaryRegion = selectPrimaryRegion(duplicateGroup) ?? duplicateGroup[0];
        const mergedRegionIds = duplicateGroup.map((region) => region.id);
        const mergedPrimaryPincode =
          duplicateGroup.map((region) => normalizePincode(region.primaryPincode)).find(Boolean) ?? null;
        const mergedAdditionalPincodes = duplicateGroup.flatMap((region) => region.additionalPincodes ?? []);
        const isActive = duplicateGroup.some((region) => region.isActive);
        const usageSummary = await getRegionUsageSummary(
          mergedRegionIds,
          primaryRegion.managerUserId ?? null,
        );

        return toAdminRegion(primaryRegion, {
          mergedRegionIds,
          mergedPrimaryPincode,
          mergedAdditionalPincodes,
          usageSummary,
          isActive,
          duplicateRegionIds: duplicateGroup
            .filter((region) => region.id !== primaryRegion.id)
            .map((region) => region.id),
        });
      }),
    );

    const statusFilteredRegions =
      filters?.isActive === undefined
        ? adminRegions
        : adminRegions.filter((region) => region.isActive === filters.isActive);
    const assignmentFilteredRegions =
      filters?.assignmentStatus === "ASSIGNED"
        ? statusFilteredRegions.filter((region) => Boolean(region.manager))
        : filters?.assignmentStatus === "UNASSIGNED"
          ? statusFilteredRegions.filter((region) => !region.manager)
          : statusFilteredRegions;
    const searchFilteredRegions = search
      ? assignmentFilteredRegions.filter((region) =>
          [
            region.name,
            region.districtName,
            region.stateName,
            region.code,
            region.slug,
            region.primaryPincode ?? "",
            region.additionalPincodes.join(" "),
            region.manager?.fullName ?? "",
            region.manager?.email ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(search),
        )
      : assignmentFilteredRegions;

    return searchFilteredRegions.sort((left, right) =>
      `${left.stateName}-${left.districtName}-${left.id}`.localeCompare(
        `${right.stateName}-${right.districtName}-${right.id}`,
        "en-IN",
      ),
    );
  },

  async getDetails(regionId: number) {
    const { primaryRegion, duplicateGroup, mergedRegionIds } = await getCanonicalRegionGroup(prisma, regionId);
    const regionIdFilter = buildRegionIdFieldFilter(mergedRegionIds);
    const mergedPrimaryPincode =
      duplicateGroup.map((region) => normalizePincode(region.primaryPincode)).find(Boolean) ?? null;
    const mergedAdditionalPincodes = duplicateGroup.flatMap((region) => region.additionalPincodes ?? []);
    const usageSummary = await getRegionUsageSummary(mergedRegionIds, primaryRegion.managerUserId ?? null);

    const [
      restaurants,
      deliveryPartners,
      registrationApplications,
      approvalRequests,
      recentOrders,
      events,
      approvedRegistrationApplicationsCount,
      rejectedRegistrationApplicationsCount,
      approvedApprovalRequestsCount,
      rejectedApprovalRequestsCount,
    ] =
      await Promise.all([
        prisma.restaurant.findMany({
          where: {
            regionId: regionIdFilter,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            addressLine: true,
            area: true,
            city: true,
            state: true,
            pincode: true,
            isActive: true,
            createdAt: true,
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                isActive: true,
              },
            },
          },
          orderBy: [{ name: "asc" }, { id: "asc" }],
        }),
        prisma.user.findMany({
          where: {
            regionId: regionIdFilter,
            role: Role.DELIVERY_PARTNER,
          },
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            isActive: true,
            lastLoginAt: true,
            deliveryProfile: {
              select: {
                id: true,
                availabilityStatus: true,
                isVerified: true,
                currentLatitude: true,
                currentLongitude: true,
                lastLocationUpdatedAt: true,
                vehicleType: true,
                vehicleNumber: true,
                licenseNumber: true,
              },
            },
          },
          orderBy: [{ fullName: "asc" }, { id: "asc" }],
        }),
        prisma.registrationApplication.findMany({
          where: {
            regionId: regionIdFilter,
          },
          select: {
            id: true,
            roleType: true,
            fullName: true,
            email: true,
            phone: true,
            status: true,
            createdAt: true,
            reviewedAt: true,
            assignedRegionalManagerId: true,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 20,
        }),
        prisma.approvalRequest.findMany({
          where: {
            regionId: regionIdFilter,
          },
          select: {
            id: true,
            targetEntityType: true,
            actionType: true,
            status: true,
            createdAt: true,
            requester: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 20,
        }),
        prisma.order.findMany({
          where: {
            deletedAt: null,
            restaurant: {
              regionId: regionIdFilter,
            },
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            orderedAt: true,
            restaurant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            deliveryPartner: {
              select: {
                id: true,
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    phone: true,
                  },
                },
              },
            },
          },
          orderBy: [{ orderedAt: "desc" }, { id: "desc" }],
          take: 12,
        }),
        prisma.event.findMany({
          where: {
            OR: [{ regionId: regionIdFilter }, { restaurant: { regionId: regionIdFilter } }],
          },
          select: {
            id: true,
            title: true,
            status: true,
            startsAt: true,
            endsAt: true,
            createdAt: true,
            restaurant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
          orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
          take: 12,
        }),
        prisma.registrationApplication.count({
          where: {
            regionId: regionIdFilter,
            status: RegistrationApplicationStatus.APPROVED,
          },
        }),
        prisma.registrationApplication.count({
          where: {
            regionId: regionIdFilter,
            status: RegistrationApplicationStatus.REJECTED,
          },
        }),
        prisma.approvalRequest.count({
          where: {
            regionId: regionIdFilter,
            status: ApprovalRequestStatus.APPROVED,
          },
        }),
        prisma.approvalRequest.count({
          where: {
            regionId: regionIdFilter,
            status: ApprovalRequestStatus.REJECTED,
          },
        }),
      ]);

    const ownerMap = new Map<
      number,
      {
        id: number;
        fullName: string;
        email: string;
        phone: string | null;
        isActive: boolean;
        restaurants: Array<{
          id: number;
          name: string;
          slug: string;
          isActive: boolean;
        }>;
      }
    >();

    for (const restaurant of restaurants) {
      const owner = restaurant.owner;
      const ownerBucket = ownerMap.get(owner.id) ?? {
        id: owner.id,
        fullName: owner.fullName,
        email: owner.email,
        phone: owner.phone ?? null,
        isActive: owner.isActive,
        restaurants: [],
      };

      ownerBucket.restaurants.push({
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        isActive: restaurant.isActive,
      });
      ownerMap.set(owner.id, ownerBucket);
    }

    return {
      ...(await toAdminRegion(primaryRegion, {
        mergedRegionIds,
        mergedPrimaryPincode,
        mergedAdditionalPincodes,
        usageSummary,
        isActive: duplicateGroup.some((region) => region.isActive),
        duplicateRegionIds: duplicateGroup
          .filter((region) => region.id !== primaryRegion.id)
          .map((region) => region.id),
      })),
      details: {
        summary: {
          restaurantsActiveCount: restaurants.filter((restaurant) => restaurant.isActive).length,
          restaurantsInactiveCount: restaurants.filter((restaurant) => !restaurant.isActive).length,
          ownersActiveCount: [...ownerMap.values()].filter((owner) => owner.isActive).length,
          ownersInactiveCount: [...ownerMap.values()].filter((owner) => !owner.isActive).length,
          deliveryPartnersActiveCount: deliveryPartners.filter((partner) => partner.isActive).length,
          deliveryPartnersInactiveCount: deliveryPartners.filter((partner) => !partner.isActive).length,
          deliveryPartnersOnlineCount: deliveryPartners.filter(
            (partner) => partner.deliveryProfile?.availabilityStatus === "ONLINE",
          ).length,
          deliveryPartnersOfflineCount: deliveryPartners.filter(
            (partner) => partner.deliveryProfile?.availabilityStatus === "OFFLINE",
          ).length,
          deliveryPartnersBusyCount: deliveryPartners.filter(
            (partner) => partner.deliveryProfile?.availabilityStatus === "BUSY",
          ).length,
          pendingApplicationsCount: usageSummary.pendingApplicationsCount,
          approvedApplicationsCount:
            approvedRegistrationApplicationsCount + approvedApprovalRequestsCount,
          rejectedApplicationsCount:
            rejectedRegistrationApplicationsCount + rejectedApprovalRequestsCount,
          activeOrdersCount: usageSummary.activeOrdersCount,
          activeEventsCount: usageSummary.activeEventsCount,
        },
        restaurants,
        owners: [...ownerMap.values()].sort((left, right) =>
          left.fullName.localeCompare(right.fullName, "en-IN"),
        ),
        deliveryPartners,
        registrationApplications,
        approvalRequests,
        recentOrders,
        events,
      },
    };
  },

  async remove(regionId: number) {
    const { mergedRegionIds, primaryRegion } = await getCanonicalRegionGroup(prisma, regionId);
    const usageSummary = await getRegionUsageSummary(mergedRegionIds, primaryRegion.managerUserId ?? null);

    if (!usageSummary.canDelete) {
      throw new AppError(
        StatusCodes.CONFLICT,
        usageSummary.deleteBlockedReason ?? regionDeleteBlockedMessage,
        "REGION_DELETE_BLOCKED",
      );
    }

    await prisma.region.deleteMany({
      where: {
        id: {
          in: mergedRegionIds,
        },
      },
    });
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
    confirmManagerReplacement?: boolean;
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

    const region = await prisma
      .$transaction(async (tx) => {
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
          confirmManagerReplacement: input.confirmManagerReplacement,
        });

        return tx.region.findUniqueOrThrow({
          where: { id: createdRegion.id },
          select: regionAdminSelect,
        });
      })
      .catch((error) => {
        const translatedError = translateRegionUniqueConstraintError(error);

        if (translatedError) {
          throw translatedError;
        }

        throw error;
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
      confirmManagerReplacement: boolean;
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
    const normalizedExistingCode = normalizeRegionCode(existingRegion.code) ?? identity.code;
    const nextName =
      input.name !== undefined
        ? normalizeRegionValue(input.name) ?? identity.name
        : existingRegion.name;
    const nextCode =
      input.code !== undefined
        ? normalizeRegionCode(input.code) ?? identity.code
        : normalizedExistingCode;
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

    const updatedRegion = await prisma
      .$transaction(async (tx) => {
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
            confirmManagerReplacement: input.confirmManagerReplacement,
          });
        }

        return tx.region.findUniqueOrThrow({
          where: { id: regionId },
          select: regionAdminSelect,
        });
      })
      .catch((error) => {
        const translatedError = translateRegionUniqueConstraintError(error);

        if (translatedError) {
          throw translatedError;
        }

        throw error;
      });

    return toAdminRegion(updatedRegion);
  },
};
