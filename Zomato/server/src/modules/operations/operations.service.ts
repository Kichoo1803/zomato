import { Prisma } from "@prisma/client";
import { DeliveryAvailabilityStatus, Role } from "../../constants/enums.js";
import { prisma } from "../../lib/prisma.js";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../../utils/app-error.js";

type RegionFilters = {
  state?: string;
  district?: string;
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

const normalizeRegionValue = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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

const buildRegionWhere = (filters: RegionFilters): Prisma.UserWhereInput => {
  const clauses: Prisma.UserWhereInput[] = [];

  if (filters.state) {
    clauses.push({ opsState: filters.state });
  }

  if (filters.district) {
    clauses.push({ opsDistrict: filters.district });
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

const buildOwnerWhere = (filters: OwnerFilters): Prisma.UserWhereInput => {
  const search = filters.search?.trim();

  return {
    role: Role.RESTAURANT_OWNER,
    ...(filters.status === "ACTIVE" ? { isActive: true } : {}),
    ...(filters.status === "INACTIVE" ? { isActive: false } : {}),
    ...buildRegionWhere(filters),
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

const buildDeliveryPartnerWhere = (filters: DeliveryPartnerFilters): Prisma.UserWhereInput => {
  const search = filters.search?.trim();

  return {
    role: Role.DELIVERY_PARTNER,
    ...buildRegionWhere(filters),
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

const getRegionOptions = async () => {
  const [users, notes, restaurants] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: {
          in: [Role.RESTAURANT_OWNER, Role.DELIVERY_PARTNER],
        },
      },
      select: {
        opsState: true,
        opsDistrict: true,
      },
    }),
    prisma.operationsRegionNote.findMany({
      select: {
        state: true,
        district: true,
      },
    }),
    prisma.restaurant.findMany({
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

const getRegionSummary = async (filters: RegionFilters) => {
  const [owners, partners, regionOptions] = await Promise.all([
    prisma.user.findMany({
      where: buildOwnerWhere(filters),
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
      where: buildDeliveryPartnerWhere(filters),
      select: {
        id: true,
        opsState: true,
        opsDistrict: true,
      },
    }),
    getRegionOptions(),
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

const getRecentUpdates = async (filters: RegionFilters) => {
  const [regionNotes, updatedUsers] = await Promise.all([
    prisma.operationsRegionNote.findMany({
      where: {
        ...(filters.state ? { state: filters.state } : {}),
        ...(filters.district ? { district: filters.district } : {}),
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
        ...(filters.state ? { opsState: filters.state } : {}),
        ...(filters.district ? { opsDistrict: filters.district } : {}),
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
  async getDashboard(filters: RegionFilters) {
    return {
      ...(await getRegionSummary(filters)),
      recentUpdates: await getRecentUpdates(filters),
    };
  },

  async getRegions(filters: RegionFilters) {
    return getRegionSummary(filters);
  },

  async listOwners(filters: OwnerFilters) {
    const owners = await prisma.user.findMany({
      where: buildOwnerWhere(filters),
      select: ownerSelect,
      orderBy: [{ opsState: "asc" }, { opsDistrict: "asc" }, { fullName: "asc" }],
    });

    return owners.map((owner) => ({
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
    }));
  },

  async listDeliveryPartners(filters: DeliveryPartnerFilters) {
    const partners = await prisma.user.findMany({
      where: buildDeliveryPartnerWhere(filters),
      select: deliveryPartnerUserSelect,
      orderBy: [{ opsState: "asc" }, { opsDistrict: "asc" }, { fullName: "asc" }],
    });

    return partners
      .filter((partner) => partner.deliveryProfile)
      .map((partner) => ({
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
      }));
  },

  async updateUserAssignment(
    userId: number,
    input: {
      state?: string;
      district?: string;
      notes?: string;
    },
  ) {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
      },
    });

    if (
      !target ||
      (target.role !== Role.RESTAURANT_OWNER && target.role !== Role.DELIVERY_PARTNER)
    ) {
      throw new AppError(StatusCodes.NOT_FOUND, "Assignment target not found", "ASSIGNMENT_TARGET_NOT_FOUND");
    }

    const normalizedState = normalizeRegionValue(input.state);
    const normalizedDistrict = normalizeRegionValue(input.district);
    const normalizedNotes = input.notes?.trim() ? input.notes.trim() : null;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.state !== undefined ? { opsState: normalizedState } : {}),
        ...(input.district !== undefined ? { opsDistrict: normalizedDistrict } : {}),
        ...(input.notes !== undefined ? { opsNotes: normalizedNotes } : {}),
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
    });

    return {
      ...updated,
      opsState: normalizeRegionValue(updated.opsState),
      opsDistrict: normalizeRegionValue(updated.opsDistrict),
      assignmentStatus: getAssignmentStatus(updated.opsState, updated.opsDistrict),
    };
  },

  async listCommunications(filters: CommunicationsFilters) {
    const search = filters.search?.trim();
    const [regionNotes, ownerNotes, partnerNotes] = await Promise.all([
      prisma.operationsRegionNote.findMany({
        where: {
          ...(filters.state ? { state: filters.state } : {}),
          ...(filters.district ? { district: filters.district } : {}),
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
          ...(filters.state ? { opsState: filters.state } : {}),
          ...(filters.district ? { opsDistrict: filters.district } : {}),
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
          ...(filters.state ? { opsState: filters.state } : {}),
          ...(filters.district ? { opsDistrict: filters.district } : {}),
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
    actorId: number,
    input: {
      state: string;
      district?: string;
      title: string;
      message: string;
    },
  ) {
    return prisma.operationsRegionNote.create({
      data: {
        state: input.state.trim(),
        district: normalizeRegionValue(input.district),
        title: input.title.trim(),
        message: input.message.trim(),
        updatedById: actorId,
      },
      select: regionNoteSelect,
    });
  },

  async updateRegionNote(
    noteId: number,
    actorId: number,
    input: {
      state?: string;
      district?: string;
      title?: string;
      message?: string;
    },
  ) {
    return prisma.operationsRegionNote.update({
      where: { id: noteId },
      data: {
        ...(input.state !== undefined ? { state: input.state.trim() } : {}),
        ...(input.district !== undefined ? { district: normalizeRegionValue(input.district) } : {}),
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.message !== undefined ? { message: input.message.trim() } : {}),
        updatedById: actorId,
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
