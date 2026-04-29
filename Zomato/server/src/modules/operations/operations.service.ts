import { Prisma } from "@prisma/client";
import { DeliveryAvailabilityStatus, Role } from "../../constants/enums.js";
import { prisma } from "../../lib/prisma.js";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../../utils/app-error.js";
import { approvalRequestsService } from "../approval-requests/approval-requests.service.js";
import { deliveryPartnersService } from "../delivery-partners/delivery-partners.service.js";
import {
  resolveRegionIdForAssignment,
  syncRestaurantsRegionForOwner,
} from "../regions/regions.service.js";
import { usersService } from "../users/users.service.js";
import { isRegionalOperationsRole, normalizeRegionValue } from "../../utils/regions.js";

type RegionFilters = {
  state?: string;
  district?: string;
};

type OperationsActor = {
  id: number;
  role: Role;
};

type ScopedRegion = {
  regionId: number | null;
  state: string;
  district: string;
  regionName: string;
};

type OperationsScope = {
  isRestricted: boolean;
  regions: ScopedRegion[];
  state?: string;
  district?: string;
  regionId?: number | null;
  regionName?: string | null;
};

type OwnerFilters = RegionFilters & {
  search?: string;
  status?: "ACTIVE" | "INACTIVE";
  assignmentStatus?: "ASSIGNED" | "UNASSIGNED" | "PARTIAL";
};

type DeliveryPartnerFilters = RegionFilters & {
  search?: string;
  availabilityStatus?: string;
  assignmentStatus?: "ASSIGNED" | "UNASSIGNED" | "PARTIAL";
};

type CommunicationsFilters = RegionFilters & {
  search?: string;
};

const getOperationsScope = async (actor: OperationsActor): Promise<OperationsScope> => {
  if (actor.role === Role.ADMIN) {
    return {
      isRestricted: false,
      regions: [],
    };
  }

  if (!isRegionalOperationsRole(actor.role)) {
    throw new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED");
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: {
      role: true,
      regionId: true,
      opsState: true,
      opsDistrict: true,
      region: {
        select: {
          id: true,
          stateName: true,
          districtName: true,
        },
      },
    },
  });

  if (!user || !isRegionalOperationsRole(user.role)) {
    throw new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED");
  }

  const assignedState = normalizeRegionValue(user.region?.stateName ?? user.opsState);
  const assignedDistrict = normalizeRegionValue(user.region?.districtName ?? user.opsDistrict);
  const primaryRegion =
    assignedState && assignedDistrict
      ? ({
          regionId: user.region?.id ?? user.regionId ?? null,
          state: assignedState,
          district: assignedDistrict,
          regionName: `${assignedDistrict}, ${assignedState}`,
        } satisfies ScopedRegion)
      : null;

  if (!primaryRegion) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "Regional manager is not assigned to a district yet",
      "REGIONAL_SCOPE_NOT_ASSIGNED",
    );
  }

  return {
    isRestricted: true,
    regions: [primaryRegion],
    state: primaryRegion.state,
    district: primaryRegion.district,
    regionId: primaryRegion.regionId ?? null,
    regionName: primaryRegion.regionName,
  };
};

const getScopedRegions = (scope: OperationsScope, filters: RegionFilters) => {
  if (!scope.isRestricted) {
    return [];
  }

  const scopedRegions = scope.regions.filter((region) => {
    if (filters.state && region.state !== filters.state) {
      return false;
    }

    if (filters.district && region.district !== filters.district) {
      return false;
    }

    return true;
  });

  if (!scopedRegions.length) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      filters.district
        ? "That district is outside your assigned regions"
        : "That state is outside your assigned regions",
      "ACCESS_DENIED",
    );
  }

  return scopedRegions;
};

const isRegionWithinScope = (
  scope: OperationsScope,
  state?: string | null,
  district?: string | null,
) => {
  if (!scope.isRestricted) {
    return true;
  }

  const normalizedState = normalizeRegionValue(state);
  const normalizedDistrict = normalizeRegionValue(district);

  if (!normalizedState || !normalizedDistrict) {
    return false;
  }

  return scope.regions.some(
    (region) => region.state === normalizedState && region.district === normalizedDistrict,
  );
};

const applyScopeToFilters = (filters: RegionFilters, scope: OperationsScope): RegionFilters => {
  if (scope.isRestricted) {
    getScopedRegions(scope, filters);
  }

  return filters;
};

const getAssignmentStatus = (state?: string | null, district?: string | null) => {
  const normalizedState = normalizeRegionValue(state);
  const normalizedDistrict = normalizeRegionValue(district);

  if (normalizedState && normalizedDistrict) {
    return "ASSIGNED" as const;
  }

  if (normalizedState || normalizedDistrict) {
    return "PARTIAL" as const;
  }

  return "UNASSIGNED" as const;
};

const buildUserRegionWhere = (filters: RegionFilters, scope: OperationsScope): Prisma.UserWhereInput => {
  const clauses: Prisma.UserWhereInput[] = [];

  if (filters.state) {
    clauses.push({ opsState: filters.state });
  }

  if (filters.district) {
    clauses.push({ opsDistrict: filters.district });
  }

  if (scope.isRestricted) {
    const scopedRegions = getScopedRegions(scope, filters);
    clauses.push({
      OR: scopedRegions.map((region) => ({
        AND: [{ opsState: region.state }, { opsDistrict: region.district }],
      })),
    });
  }

  return clauses.length ? { AND: clauses } : {};
};

const buildRegionRecordWhere = (
  filters: RegionFilters,
  scope: OperationsScope,
): Prisma.RegionWhereInput => {
  const clauses: Prisma.RegionWhereInput[] = [];

  if (filters.state) {
    clauses.push({ stateName: filters.state });
  }

  if (filters.district) {
    clauses.push({ districtName: filters.district });
  }

  if (scope.isRestricted) {
    const scopedRegions = getScopedRegions(scope, filters);
    clauses.push({
      OR: scopedRegions.map((region) => ({
        AND: [{ stateName: region.state }, { districtName: region.district }],
      })),
    });
  }

  return clauses.length ? { AND: clauses } : {};
};

const buildRegionNoteWhere = (
  filters: RegionFilters,
  scope: OperationsScope,
): Prisma.OperationsRegionNoteWhereInput => {
  const clauses: Prisma.OperationsRegionNoteWhereInput[] = [];

  if (filters.state) {
    clauses.push({ state: filters.state });
  }

  if (filters.district) {
    clauses.push({ district: filters.district });
  }

  if (scope.isRestricted) {
    const scopedRegions = getScopedRegions(scope, filters);
    clauses.push({
      OR: scopedRegions.map((region) => ({
        AND: [{ state: region.state }, { district: region.district }],
      })),
    });
  }

  return clauses.length ? { AND: clauses } : {};
};

const buildRestaurantScopeWhere = (
  filters: RegionFilters,
  scope: OperationsScope,
): Prisma.RestaurantWhereInput => {
  const clauses: Prisma.RestaurantWhereInput[] = [];

  if (filters.state) {
    clauses.push({ state: filters.state });
  }

  if (scope.isRestricted) {
    const scopedRegions = getScopedRegions(scope, filters);
    const allowedStates = [...new Set(scopedRegions.map((region) => region.state))];

    clauses.push({
      OR: allowedStates.map((state) => ({
        state,
      })),
    });
  }

  return clauses.length ? { AND: clauses } : {};
};

const buildAssignmentStatusWhere = (
  assignmentStatus?: "ASSIGNED" | "UNASSIGNED" | "PARTIAL",
): Prisma.UserWhereInput => {
  if (!assignmentStatus) {
    return {};
  }

  if (assignmentStatus === "ASSIGNED") {
    return {
      AND: [{ opsState: { not: null } }, { opsDistrict: { not: null } }],
    };
  }

  if (assignmentStatus === "PARTIAL") {
    return {
      OR: [
        { AND: [{ opsState: { not: null } }, { opsDistrict: null }] },
        { AND: [{ opsState: null }, { opsDistrict: { not: null } }] },
      ],
    };
  }

  return {
    OR: [{ opsState: null }, { opsDistrict: null }],
  };
};

const ownerSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  profileImage: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  updatedAt: true,
  opsState: true,
  opsDistrict: true,
  opsNotes: true,
  ownedRestaurants: {
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      state: true,
      area: true,
      isActive: true,
      avgRating: true,
      totalReviews: true,
    },
    orderBy: {
      name: "asc",
    },
  },
} satisfies Prisma.UserSelect;

const deliveryPartnerUserSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  profileImage: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  updatedAt: true,
  opsState: true,
  opsDistrict: true,
  opsNotes: true,
  deliveryProfile: {
    select: {
      id: true,
      vehicleType: true,
      vehicleNumber: true,
      licenseNumber: true,
      availabilityStatus: true,
      avgRating: true,
      totalDeliveries: true,
      isVerified: true,
      currentLatitude: true,
      currentLongitude: true,
      lastLocationUpdatedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.UserSelect;

const regionNoteSelect = {
  id: true,
  state: true,
  district: true,
  title: true,
  message: true,
  createdAt: true,
  updatedAt: true,
  updatedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.OperationsRegionNoteSelect;

const mapOwnerRecord = (
  owner: Prisma.UserGetPayload<{
    select: typeof ownerSelect;
  }>,
) => ({
  id: owner.id,
  fullName: owner.fullName,
  email: owner.email,
  phone: owner.phone,
  profileImage: owner.profileImage,
  role: owner.role,
  isActive: owner.isActive,
  lastLoginAt: owner.lastLoginAt,
  updatedAt: owner.updatedAt,
  opsState: normalizeRegionValue(owner.opsState),
  opsDistrict: normalizeRegionValue(owner.opsDistrict),
  opsNotes: owner.opsNotes,
  assignmentStatus: getAssignmentStatus(owner.opsState, owner.opsDistrict),
  restaurants: owner.ownedRestaurants,
});

const mapDeliveryPartnerRecord = (
  partner: Prisma.UserGetPayload<{
    select: typeof deliveryPartnerUserSelect;
  }>,
) => ({
  id: partner.id,
  userId: partner.id,
  fullName: partner.fullName,
  email: partner.email,
  phone: partner.phone,
  profileImage: partner.profileImage,
  role: partner.role,
  isActive: partner.isActive,
  lastLoginAt: partner.lastLoginAt,
  updatedAt: partner.updatedAt,
  opsState: normalizeRegionValue(partner.opsState),
  opsDistrict: normalizeRegionValue(partner.opsDistrict),
  opsNotes: partner.opsNotes,
  assignmentStatus: getAssignmentStatus(partner.opsState, partner.opsDistrict),
  deliveryProfile: partner.deliveryProfile!,
});

const buildOwnerWhere = (filters: OwnerFilters, scope: OperationsScope): Prisma.UserWhereInput => {
  const search = filters.search?.trim();

  return {
    role: Role.RESTAURANT_OWNER,
    ...(filters.status === "ACTIVE" ? { isActive: true } : {}),
    ...(filters.status === "INACTIVE" ? { isActive: false } : {}),
    ...buildUserRegionWhere(filters, scope),
    ...buildAssignmentStatusWhere(filters.assignmentStatus),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
            {
              ownedRestaurants: {
                some: {
                  OR: [
                    { name: { contains: search } },
                    { slug: { contains: search } },
                    { city: { contains: search } },
                    { state: { contains: search } },
                    { area: { contains: search } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
};

const buildDeliveryPartnerWhere = (
  filters: DeliveryPartnerFilters,
  scope: OperationsScope,
): Prisma.UserWhereInput => {
  const search = filters.search?.trim();

  return {
    role: Role.DELIVERY_PARTNER,
    ...buildUserRegionWhere(filters, scope),
    ...buildAssignmentStatusWhere(filters.assignmentStatus),
    ...(filters.availabilityStatus
      ? {
          deliveryProfile: {
            is: {
              availabilityStatus: filters.availabilityStatus,
            },
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
            {
              deliveryProfile: {
                is: {
                  OR: [
                    { vehicleNumber: { contains: search } },
                    { licenseNumber: { contains: search } },
                    { vehicleType: { contains: search } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
};

const sortStrings = (values: Iterable<string>) =>
  [...values].sort((left, right) => left.localeCompare(right, "en-IN"));

const getRegionOptions = async (filters: RegionFilters, scope: OperationsScope) => {
  const [regions, users, notes, restaurants] = await Promise.all([
    prisma.region.findMany({
      where: {
        ...buildRegionRecordWhere(filters, scope),
        isActive: true,
      },
      select: {
        stateName: true,
        districtName: true,
      },
    }),
    prisma.user.findMany({
      where: {
        role: {
          in: [Role.RESTAURANT_OWNER, Role.DELIVERY_PARTNER],
        },
        ...buildUserRegionWhere(filters, scope),
      },
      select: {
        opsState: true,
        opsDistrict: true,
      },
    }),
    prisma.operationsRegionNote.findMany({
      where: {
        ...buildRegionNoteWhere(filters, scope),
      },
      select: {
        state: true,
        district: true,
      },
    }),
    prisma.restaurant.findMany({
      where: {
        ...buildRestaurantScopeWhere(filters, scope),
      },
      select: {
        state: true,
      },
    }),
  ]);

  const stateSet = new Set<string>();
  const districtMap = new Map<string, Set<string>>();

  const registerRegion = (state?: string | null, district?: string | null) => {
    const normalizedState = normalizeRegionValue(state);
    const normalizedDistrict = normalizeRegionValue(district);

    if (!normalizedState) {
      return;
    }

    stateSet.add(normalizedState);

    if (normalizedDistrict) {
      const bucket = districtMap.get(normalizedState) ?? new Set<string>();
      bucket.add(normalizedDistrict);
      districtMap.set(normalizedState, bucket);
    }
  };

  regions.forEach((region) => registerRegion(region.stateName, region.districtName));
  users.forEach((user) => registerRegion(user.opsState, user.opsDistrict));
  notes.forEach((note) => registerRegion(note.state, note.district));
  restaurants.forEach((restaurant) => registerRegion(restaurant.state, null));

  return {
    states: sortStrings(stateSet),
    districtsByState: Object.fromEntries(
      [...districtMap.entries()]
        .sort((left, right) => left[0].localeCompare(right[0], "en-IN"))
        .map(([state, districts]) => [state, sortStrings(districts)]),
    ),
  };
};

const getRegionSummary = async (filters: RegionFilters, scope: OperationsScope) => {
  const [owners, partners, regionOptions] = await Promise.all([
    prisma.user.findMany({
      where: buildOwnerWhere(filters, scope),
      select: {
        id: true,
        opsState: true,
        opsDistrict: true,
        ownedRestaurants: {
          select: {
            id: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: buildDeliveryPartnerWhere(filters, scope),
      select: {
        id: true,
        opsState: true,
        opsDistrict: true,
      },
    }),
    getRegionOptions(filters, scope),
  ]);

  const stateMap = new Map<
    string,
    {
      state: string;
      ownersCount: number;
      deliveryPartnersCount: number;
      restaurantIds: Set<number>;
      districtSet: Set<string>;
      fullyAssignedCount: number;
      unassignedCount: number;
    }
  >();
  const districtMap = new Map<
    string,
    {
      state: string;
      district: string;
      ownersCount: number;
      deliveryPartnersCount: number;
      restaurantIds: Set<number>;
      fullyAssignedCount: number;
      unassignedCount: number;
    }
  >();

  let fullyAssignedCount = 0;
  let unassignedOwnersCount = 0;
  let unassignedPartnersCount = 0;
  const restaurantIds = new Set<number>();

  const ensureStateEntry = (state: string) => {
    const existing =
      stateMap.get(state) ??
      {
        state,
        ownersCount: 0,
        deliveryPartnersCount: 0,
        restaurantIds: new Set<number>(),
        districtSet: new Set<string>(),
        fullyAssignedCount: 0,
        unassignedCount: 0,
      };

    stateMap.set(state, existing);
    return existing;
  };

  const ensureDistrictEntry = (state: string, district: string) => {
    const key = `${state}::${district}`;
    const existing =
      districtMap.get(key) ??
      {
        state,
        district,
        ownersCount: 0,
        deliveryPartnersCount: 0,
        restaurantIds: new Set<number>(),
        fullyAssignedCount: 0,
        unassignedCount: 0,
      };

    districtMap.set(key, existing);
    return existing;
  };

  regionOptions.states.forEach((state) => {
    ensureStateEntry(state);

    (regionOptions.districtsByState[state] ?? []).forEach((district) => {
      ensureDistrictEntry(state, district);
    });
  });

  for (const owner of owners) {
    const assignmentStatus = getAssignmentStatus(owner.opsState, owner.opsDistrict);
    const normalizedState = normalizeRegionValue(owner.opsState);
    const normalizedDistrict = normalizeRegionValue(owner.opsDistrict) ?? "Unassigned district";

    if (assignmentStatus === "ASSIGNED") {
      fullyAssignedCount += 1;
    } else {
      unassignedOwnersCount += 1;
    }

    owner.ownedRestaurants.forEach((restaurant) => {
      restaurantIds.add(restaurant.id);
    });

    if (!normalizedState) {
      continue;
    }

    const stateEntry = ensureStateEntry(normalizedState);
    stateEntry.ownersCount += 1;
    owner.ownedRestaurants.forEach((restaurant) => stateEntry.restaurantIds.add(restaurant.id));
    stateEntry.districtSet.add(normalizedDistrict);

    if (assignmentStatus === "ASSIGNED") {
      stateEntry.fullyAssignedCount += 1;
    } else {
      stateEntry.unassignedCount += 1;
    }

    const districtEntry = ensureDistrictEntry(normalizedState, normalizedDistrict);
    districtEntry.ownersCount += 1;
    owner.ownedRestaurants.forEach((restaurant) => districtEntry.restaurantIds.add(restaurant.id));

    if (assignmentStatus === "ASSIGNED") {
      districtEntry.fullyAssignedCount += 1;
    } else {
      districtEntry.unassignedCount += 1;
    }
  }

  for (const partner of partners) {
    const assignmentStatus = getAssignmentStatus(partner.opsState, partner.opsDistrict);
    const normalizedState = normalizeRegionValue(partner.opsState);
    const normalizedDistrict = normalizeRegionValue(partner.opsDistrict) ?? "Unassigned district";

    if (assignmentStatus === "ASSIGNED") {
      fullyAssignedCount += 1;
    } else {
      unassignedPartnersCount += 1;
    }

    if (!normalizedState) {
      continue;
    }

    const stateEntry = ensureStateEntry(normalizedState);
    stateEntry.deliveryPartnersCount += 1;
    stateEntry.districtSet.add(normalizedDistrict);

    if (assignmentStatus === "ASSIGNED") {
      stateEntry.fullyAssignedCount += 1;
    } else {
      stateEntry.unassignedCount += 1;
    }

    const districtEntry = ensureDistrictEntry(normalizedState, normalizedDistrict);
    districtEntry.deliveryPartnersCount += 1;

    if (assignmentStatus === "ASSIGNED") {
      districtEntry.fullyAssignedCount += 1;
    } else {
      districtEntry.unassignedCount += 1;
    }
  }

  const stateSummaries = [...stateMap.values()]
    .map((entry) => ({
      state: entry.state,
      ownersCount: entry.ownersCount,
      deliveryPartnersCount: entry.deliveryPartnersCount,
      restaurantsCount: entry.restaurantIds.size,
      districtsCount: entry.districtSet.size,
      fullyAssignedCount: entry.fullyAssignedCount,
      unassignedCount: entry.unassignedCount,
    }))
    .sort((left, right) => {
      const leftScore = left.ownersCount + left.deliveryPartnersCount;
      const rightScore = right.ownersCount + right.deliveryPartnersCount;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return left.state.localeCompare(right.state, "en-IN");
    });

  const districtSummaries = [...districtMap.values()]
    .map((entry) => ({
      state: entry.state,
      district: entry.district,
      ownersCount: entry.ownersCount,
      deliveryPartnersCount: entry.deliveryPartnersCount,
      restaurantsCount: entry.restaurantIds.size,
      fullyAssignedCount: entry.fullyAssignedCount,
      unassignedCount: entry.unassignedCount,
    }))
    .sort((left, right) => {
      const leftScore = left.ownersCount + left.deliveryPartnersCount;
      const rightScore = right.ownersCount + right.deliveryPartnersCount;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      if (left.state !== right.state) {
        return left.state.localeCompare(right.state, "en-IN");
      }

      return left.district.localeCompare(right.district, "en-IN");
    });

  return {
    filters: {
      state: filters.state ?? null,
      district: filters.district ?? null,
    },
    regionOptions,
    stats: {
      statesCount: stateSummaries.length,
      districtsCount: districtSummaries.length,
      ownersCount: owners.length,
      deliveryPartnersCount: partners.length,
      restaurantsCount: restaurantIds.size,
      fullyAssignedCount,
      unassignedOwnersCount,
      unassignedPartnersCount,
      unassignedCount: unassignedOwnersCount + unassignedPartnersCount,
    },
    stateSummaries,
    districtSummaries,
  };
};

const getRecentUpdates = async (filters: RegionFilters, scope: OperationsScope) => {
  const [regionNotes, updatedUsers] = await Promise.all([
    prisma.operationsRegionNote.findMany({
      where: {
        ...buildRegionNoteWhere(filters, scope),
      },
      select: {
        id: true,
        state: true,
        district: true,
        title: true,
        message: true,
        updatedAt: true,
        updatedBy: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.user.findMany({
      where: {
        role: {
          in: [Role.RESTAURANT_OWNER, Role.DELIVERY_PARTNER],
        },
        ...buildUserRegionWhere(filters, scope),
        OR: [{ opsState: { not: null } }, { opsDistrict: { not: null } }, { opsNotes: { not: null } }],
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        opsState: true,
        opsDistrict: true,
        opsNotes: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);

  return [
    ...regionNotes.map((note) => ({
      id: `note-${note.id}`,
      kind: "REGION_NOTE" as const,
      title: note.title,
      description: note.message,
      state: note.state,
      district: note.district,
      actorName: note.updatedBy?.fullName ?? null,
      updatedAt: note.updatedAt,
    })),
    ...updatedUsers.map((user) => ({
      id: `user-${user.id}`,
      kind:
        user.role === Role.RESTAURANT_OWNER
          ? ("OWNER_ASSIGNMENT" as const)
          : ("DELIVERY_ASSIGNMENT" as const),
      title: user.fullName,
      description:
        user.opsNotes?.trim() ||
        `${user.role === Role.RESTAURANT_OWNER ? "Owner" : "Partner"} assignment updated for ${
          normalizeRegionValue(user.opsDistrict) ?? "district pending"
        }.`,
      state: normalizeRegionValue(user.opsState),
      district: normalizeRegionValue(user.opsDistrict),
      actorName: null,
      updatedAt: user.updatedAt,
    })),
  ]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 8);
};

export const operationsService = {
  async getDashboard(actor: OperationsActor, filters: RegionFilters) {
    const scope = await getOperationsScope(actor);
    const scopedFilters = applyScopeToFilters(filters, scope);

    return {
      ...(await getRegionSummary(scopedFilters, scope)),
      recentUpdates: await getRecentUpdates(scopedFilters, scope),
    };
  },

  async getRegions(actor: OperationsActor, filters: RegionFilters) {
    const scope = await getOperationsScope(actor);
    const scopedFilters = applyScopeToFilters(filters, scope);
    return getRegionSummary(scopedFilters, scope);
  },

  async listOwners(actor: OperationsActor, filters: OwnerFilters) {
    const scope = await getOperationsScope(actor);
    const scopedFilters = applyScopeToFilters(filters, scope);
    const owners = await prisma.user.findMany({
      where: buildOwnerWhere(scopedFilters, scope),
      select: ownerSelect,
      orderBy: [{ opsState: "asc" }, { opsDistrict: "asc" }, { fullName: "asc" }],
    });

    return owners.map(mapOwnerRecord);
  },

  async createOwner(
    actor: OperationsActor,
    input: {
      fullName: string;
      email: string;
      phone?: string;
      password: string;
      profileImage?: string;
      state: string;
      district: string;
      notes?: string;
    },
  ) {
    const scope = await getOperationsScope(actor);
    const scopedRegion = applyScopeToFilters(
      {
        state: input.state,
        district: input.district,
      },
      scope,
    );
    const owner = await usersService.create({
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || undefined,
      password: input.password,
      role: Role.RESTAURANT_OWNER,
      opsState: scopedRegion.state,
      opsDistrict: scopedRegion.district,
      opsNotes: input.notes,
      profileImage: input.profileImage?.trim() || undefined,
      isActive: true,
    });

    return {
      id: owner.id,
      fullName: owner.fullName,
      email: owner.email,
      phone: owner.phone,
      profileImage: owner.profileImage,
      role: owner.role,
      isActive: owner.isActive,
      lastLoginAt: owner.lastLoginAt,
      updatedAt: owner.updatedAt,
      opsState: normalizeRegionValue(owner.opsState),
      opsDistrict: normalizeRegionValue(owner.opsDistrict),
      opsNotes: owner.opsNotes,
      assignmentStatus: getAssignmentStatus(owner.opsState, owner.opsDistrict),
      restaurants: [],
    };
  },

  async listDeliveryPartners(actor: OperationsActor, filters: DeliveryPartnerFilters) {
    const scope = await getOperationsScope(actor);
    const scopedFilters = applyScopeToFilters(filters, scope);
    const partners = await prisma.user.findMany({
      where: buildDeliveryPartnerWhere(scopedFilters, scope),
      select: deliveryPartnerUserSelect,
      orderBy: [{ opsState: "asc" }, { opsDistrict: "asc" }, { fullName: "asc" }],
    });

    return partners.filter((partner) => partner.deliveryProfile).map(mapDeliveryPartnerRecord);
  },

  async createDeliveryPartner(
    actor: OperationsActor,
    input: {
      fullName: string;
      email: string;
      phone?: string;
      password: string;
      profileImage?: string;
      vehicleType: string;
      vehicleNumber?: string;
      licenseNumber?: string;
      availabilityStatus?: string;
      isVerified?: boolean;
      state: string;
      district: string;
      notes?: string;
    },
  ) {
    const scope = await getOperationsScope(actor);
    const scopedRegion = applyScopeToFilters(
      {
        state: input.state,
        district: input.district,
      },
      scope,
    );
    const partner = await deliveryPartnersService.createByAdmin({
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || undefined,
      password: input.password,
      profileImage: input.profileImage?.trim() || undefined,
      vehicleType: input.vehicleType.trim(),
      vehicleNumber: input.vehicleNumber?.trim() || undefined,
      licenseNumber: input.licenseNumber?.trim() || undefined,
      availabilityStatus: input.availabilityStatus,
      isVerified: input.isVerified,
      opsState: scopedRegion.state,
      opsDistrict: scopedRegion.district,
      opsNotes: input.notes,
    });

    return {
      id: partner.user.id,
      userId: partner.user.id,
      fullName: partner.user.fullName,
      email: partner.user.email,
      phone: partner.user.phone,
      profileImage: partner.user.profileImage,
      role: partner.user.role,
      isActive: partner.user.isActive,
      lastLoginAt: partner.user.lastLoginAt,
      updatedAt: partner.updatedAt,
      opsState: normalizeRegionValue(partner.user.opsState),
      opsDistrict: normalizeRegionValue(partner.user.opsDistrict),
      opsNotes: partner.user.opsNotes,
      assignmentStatus: getAssignmentStatus(partner.user.opsState, partner.user.opsDistrict),
      deliveryProfile: {
        id: partner.id,
        vehicleType: partner.vehicleType,
        vehicleNumber: partner.vehicleNumber,
        licenseNumber: partner.licenseNumber,
        availabilityStatus: partner.availabilityStatus,
        avgRating: partner.avgRating,
        totalDeliveries: partner.totalDeliveries,
        isVerified: partner.isVerified,
        currentLatitude: partner.currentLatitude,
        currentLongitude: partner.currentLongitude,
        lastLocationUpdatedAt: partner.lastLocationUpdatedAt,
        createdAt: partner.createdAt,
        updatedAt: partner.updatedAt,
      },
    };
  },

  async updateUserAssignment(
    actor: OperationsActor,
    userId: number,
    input: {
      state?: string;
      district?: string;
      notes?: string;
    },
  ) {
    const scope = await getOperationsScope(actor);
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        fullName: true,
        opsState: true,
        opsDistrict: true,
        opsNotes: true,
      },
    });

    if (
      !target ||
      (target.role !== Role.RESTAURANT_OWNER && target.role !== Role.DELIVERY_PARTNER)
    ) {
      throw new AppError(StatusCodes.NOT_FOUND, "Assignment target not found", "ASSIGNMENT_TARGET_NOT_FOUND");
    }

    const currentState = normalizeRegionValue(target.opsState);
    const currentDistrict = normalizeRegionValue(target.opsDistrict);
    const currentNotes = target.opsNotes ?? null;
    const normalizedState =
      input.state !== undefined ? normalizeRegionValue(input.state) : currentState;
    const normalizedDistrict =
      input.district !== undefined ? normalizeRegionValue(input.district) : currentDistrict;
    const normalizedNotes = input.notes?.trim() ? input.notes.trim() : null;

    if (scope.isRestricted && currentState && currentDistrict && !isRegionWithinScope(scope, currentState, currentDistrict)) {
      throw new AppError(
        StatusCodes.FORBIDDEN,
        "You can only manage assignment records inside your assigned regions",
        "ACCESS_DENIED",
      );
    }

    const stateChanged = normalizedState !== currentState;
    const districtChanged = normalizedDistrict !== currentDistrict;
    const isSensitiveRegionChange = stateChanged || districtChanged;
    const nextNotes =
      input.notes !== undefined ? normalizedNotes : currentNotes;
    const nextRegion =
      input.state !== undefined || input.district !== undefined
        ? await resolveRegionIdForAssignment(prisma, normalizedState, normalizedDistrict)
        : null;

    if (scope.isRestricted && isSensitiveRegionChange) {
      const request = await approvalRequestsService.createUserAssignmentRequest({
        requesterId: actor.id,
        requesterRole: actor.role,
        targetUserId: userId,
        currentState,
        currentDistrict,
        currentNotes,
        nextState: normalizedState,
        nextDistrict: normalizedDistrict,
        nextNotes,
        regionId: nextRegion?.id ?? scope.regionId ?? null,
      });

      return {
        mode: "REQUEST_CREATED" as const,
        request,
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.state !== undefined ? { opsState: normalizedState } : {}),
          ...(input.district !== undefined ? { opsDistrict: normalizedDistrict } : {}),
          ...(input.notes !== undefined ? { opsNotes: normalizedNotes } : {}),
          ...(input.state !== undefined || input.district !== undefined
            ? { regionId: nextRegion?.id ?? null }
            : {}),
        },
        select: {
          id: true,
          fullName: true,
          role: true,
          opsState: true,
          opsDistrict: true,
          opsNotes: true,
          updatedAt: true,
          regionId: true,
        },
      });

      if (user.role === Role.RESTAURANT_OWNER && (input.state !== undefined || input.district !== undefined)) {
        await syncRestaurantsRegionForOwner(tx, user.id, user.regionId ?? null);
      }

      return user;
    });

    return {
      mode: "UPDATED" as const,
      assignment: {
        ...updated,
        opsState: normalizeRegionValue(updated.opsState),
        opsDistrict: normalizeRegionValue(updated.opsDistrict),
        assignmentStatus: getAssignmentStatus(updated.opsState, updated.opsDistrict),
      },
    };
  },

  async listCommunications(actor: OperationsActor, filters: CommunicationsFilters) {
    const scope = await getOperationsScope(actor);
    const scopedFilters = applyScopeToFilters(filters, scope);
    const search = filters.search?.trim();
    const [regionNotes, ownerNotes, partnerNotes] = await Promise.all([
      prisma.operationsRegionNote.findMany({
        where: {
          ...buildRegionNoteWhere(scopedFilters, scope),
          ...(search
            ? {
                OR: [{ title: { contains: search } }, { message: { contains: search } }],
              }
            : {}),
        },
        select: regionNoteSelect,
        orderBy: { updatedAt: "desc" },
        take: 24,
      }),
      prisma.user.findMany({
        where: {
          role: Role.RESTAURANT_OWNER,
          opsNotes: { not: null },
          ...buildUserRegionWhere(scopedFilters, scope),
          ...(search
            ? {
                OR: [
                  { fullName: { contains: search } },
                  { email: { contains: search } },
                  { opsNotes: { contains: search } },
                ],
              }
            : {}),
        },
        select: ownerSelect,
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
      prisma.user.findMany({
        where: {
          role: Role.DELIVERY_PARTNER,
          opsNotes: { not: null },
          ...buildUserRegionWhere(scopedFilters, scope),
          ...(search
            ? {
                OR: [
                  { fullName: { contains: search } },
                  { email: { contains: search } },
                  { opsNotes: { contains: search } },
                  {
                    deliveryProfile: {
                      is: {
                        OR: [
                          { vehicleNumber: { contains: search } },
                          { licenseNumber: { contains: search } },
                        ],
                      },
                    },
                  },
                ],
              }
            : {}),
        },
        select: deliveryPartnerUserSelect,
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
    ]);

    return {
      regionNotes: regionNotes.map((note) => ({
        ...note,
        state: normalizeRegionValue(note.state),
        district: normalizeRegionValue(note.district),
      })),
      ownerNotes: ownerNotes.map((owner) => ({
        id: owner.id,
        fullName: owner.fullName,
        email: owner.email,
        phone: owner.phone,
        opsState: normalizeRegionValue(owner.opsState),
        opsDistrict: normalizeRegionValue(owner.opsDistrict),
        opsNotes: owner.opsNotes,
        updatedAt: owner.updatedAt,
        restaurants: owner.ownedRestaurants,
      })),
      partnerNotes: partnerNotes
        .filter((partner) => partner.deliveryProfile)
        .map((partner) => ({
          id: partner.id,
          fullName: partner.fullName,
          email: partner.email,
          phone: partner.phone,
          opsState: normalizeRegionValue(partner.opsState),
          opsDistrict: normalizeRegionValue(partner.opsDistrict),
          opsNotes: partner.opsNotes,
          updatedAt: partner.updatedAt,
          deliveryProfile: partner.deliveryProfile!,
        })),
    };
  },

  async createRegionNote(
    actor: OperationsActor,
    input: {
      state: string;
      district?: string;
      title: string;
      message: string;
    },
  ) {
    const scope = await getOperationsScope(actor);
    const scopedFilters = applyScopeToFilters(
      {
        state: input.state,
        district: input.district,
      },
      scope,
    );
    const region = await resolveRegionIdForAssignment(
      prisma,
      scopedFilters.state ?? null,
      scopedFilters.district ?? null,
    );

    return prisma.operationsRegionNote.create({
      data: {
        regionId: region?.id ?? scope.regionId ?? null,
        state: scopedFilters.state!.trim(),
        district: normalizeRegionValue(scopedFilters.district),
        title: input.title.trim(),
        message: input.message.trim(),
        updatedById: actor.id,
      },
      select: regionNoteSelect,
    });
  },

  async updateRegionNote(
    actor: OperationsActor,
    noteId: number,
    input: {
      state?: string;
      district?: string;
      title?: string;
      message?: string;
    },
  ) {
    const scope = await getOperationsScope(actor);
    const existingNote = await prisma.operationsRegionNote.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        state: true,
        district: true,
      },
    });

    if (!existingNote) {
      throw new AppError(StatusCodes.NOT_FOUND, "Region note not found", "REGION_NOTE_NOT_FOUND");
    }

    applyScopeToFilters(
      {
        state: existingNote.state,
        district: existingNote.district ?? undefined,
      },
      scope,
    );

    const nextFilters = applyScopeToFilters(
      {
        state: input.state ?? existingNote.state,
        district: input.district ?? existingNote.district ?? undefined,
      },
      scope,
    );
    const nextRegion =
      input.state !== undefined || input.district !== undefined
        ? await resolveRegionIdForAssignment(prisma, nextFilters.state ?? null, nextFilters.district ?? null)
        : null;

    return prisma.operationsRegionNote.update({
      where: { id: noteId },
      data: {
        ...(input.state !== undefined ? { state: nextFilters.state?.trim() } : {}),
        ...(input.district !== undefined ? { district: normalizeRegionValue(nextFilters.district) } : {}),
        ...(input.state !== undefined || input.district !== undefined
          ? { regionId: nextRegion?.id ?? null }
          : {}),
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.message !== undefined ? { message: input.message.trim() } : {}),
        updatedById: actor.id,
      },
      select: regionNoteSelect,
    });
  },

  deliveryAvailabilityOptions: [
    DeliveryAvailabilityStatus.ONLINE,
    DeliveryAvailabilityStatus.OFFLINE,
    DeliveryAvailabilityStatus.BUSY,
  ],
};
