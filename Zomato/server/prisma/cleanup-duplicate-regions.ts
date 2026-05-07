import "dotenv/config";
import { RegistrationApplicationStatus } from "../src/modules/registration-applications/registration-applications.constants.js";
import { createPrismaClient } from "../src/lib/prisma-client.js";
import {
  buildRegionIdentity,
  buildRegionIdentityKey,
  normalizeRegionCode,
  normalizeRegionValue,
} from "../src/utils/regions.js";

const prisma = createPrismaClient({
  log: ["warn", "error"],
});

type RegionRecord = Awaited<ReturnType<typeof prisma.region.findMany>>[number];

const shouldApply = !process.argv.includes("--dry-run");

const compareRegionsForPriority = (left: RegionRecord, right: RegionRecord) => {
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

const selectPrimaryRegion = (regions: RegionRecord[]) => [...regions].sort(compareRegionsForPriority)[0] ?? null;

const normalizePincode = (value?: string | null) => {
  const normalizedValue = normalizeRegionValue(value);
  return normalizedValue ? normalizedValue.replace(/\D/g, "").slice(0, 6) : null;
};

const normalizePincodeList = (values: Array<string | null | undefined>, primaryPincode?: string | null) => {
  const normalizedPrimaryPincode = normalizePincode(primaryPincode);

  return [...new Set(values.map((value) => normalizePincode(value)).filter((value): value is string => Boolean(value)))]
    .filter((value) => value !== normalizedPrimaryPincode)
    .sort((left, right) => left.localeCompare(right, "en-IN"));
};

const getPreferredPrimaryPincode = (regions: RegionRecord[]) =>
  regions.map((region) => normalizePincode(region.primaryPincode)).find((value): value is string => Boolean(value)) ?? null;

const getPreferredNotes = (regions: RegionRecord[]) =>
  regions.map((region) => normalizeRegionValue(region.notes)).find((value): value is string => Boolean(value)) ?? null;

const syncManagerScope = async (managerUserId: number) => {
  const managedRegions = await prisma.region.findMany({
    where: {
      managerUserId,
    },
    select: {
      id: true,
      stateName: true,
      districtName: true,
    },
    orderBy: [{ stateName: "asc" }, { districtName: "asc" }, { id: "asc" }],
  });

  const primaryRegion = managedRegions[0];
  const primaryIdentity = buildRegionIdentity(primaryRegion?.stateName, primaryRegion?.districtName);

  await prisma.user.updateMany({
    where: {
      id: managerUserId,
    },
    data: {
      regionId: primaryRegion?.id ?? null,
      opsState: primaryIdentity?.state ?? primaryRegion?.stateName ?? null,
      opsDistrict: primaryIdentity?.district ?? primaryRegion?.districtName ?? null,
    },
  });
};

const mergeDuplicateRegionGroup = async (regions: RegionRecord[]) => {
  const primaryRegion = selectPrimaryRegion(regions);

  if (!primaryRegion) {
    return null;
  }

  const duplicateRegions = regions.filter((region) => region.id !== primaryRegion.id);

  if (!duplicateRegions.length) {
    return null;
  }

  const primaryIdentity = buildRegionIdentity(primaryRegion.stateName, primaryRegion.districtName);

  if (!primaryIdentity) {
    throw new Error(`Unable to normalize duplicate region group for region ${primaryRegion.id}.`);
  }

  const duplicateRegionIds = duplicateRegions.map((region) => region.id);
  const mergedRegionIds = regions.map((region) => region.id);
  const chosenManagerUserId =
    primaryRegion.managerUserId ?? duplicateRegions.find((region) => region.managerUserId)?.managerUserId ?? null;
  const primaryPincode = getPreferredPrimaryPincode(regions);
  const additionalPincodes = normalizePincodeList(
    regions.flatMap((region) => [region.primaryPincode, ...region.additionalPincodes]),
    primaryPincode,
  );
  const notes = getPreferredNotes(regions);
  const affectedManagerIds = [
    ...new Set(regions.map((region) => region.managerUserId).filter((managerUserId): managerUserId is number => Boolean(managerUserId))),
  ];

  const summary = {
    identity: primaryIdentity.name,
    primaryRegionId: primaryRegion.id,
    duplicateRegionIds,
    chosenManagerUserId,
  };

  console.log(
    `[regions:cleanup] ${shouldApply ? "Merging" : "Dry run"} ${summary.identity}: primary=${summary.primaryRegionId}, duplicates=${summary.duplicateRegionIds.join(", ")}`,
  );

  if (!shouldApply) {
    return {
      ...summary,
      affectedManagerIds,
    };
  }

  await prisma.$transaction(async (tx) => {
    await Promise.all([
      tx.restaurant.updateMany({
        where: {
          regionId: {
            in: duplicateRegionIds,
          },
        },
        data: {
          regionId: primaryRegion.id,
        },
      }),
      tx.user.updateMany({
        where: {
          regionId: {
            in: mergedRegionIds,
          },
        },
        data: {
          regionId: primaryRegion.id,
          opsState: primaryIdentity.state,
          opsDistrict: primaryIdentity.district,
        },
      }),
      tx.event.updateMany({
        where: {
          regionId: {
            in: duplicateRegionIds,
          },
        },
        data: {
          regionId: primaryRegion.id,
        },
      }),
      tx.approvalRequest.updateMany({
        where: {
          regionId: {
            in: duplicateRegionIds,
          },
        },
        data: {
          regionId: primaryRegion.id,
        },
      }),
      tx.registrationApplication.updateMany({
        where: {
          regionId: {
            in: duplicateRegionIds,
          },
        },
        data: {
          regionId: primaryRegion.id,
        },
      }),
      tx.operationsRegionNote.updateMany({
        where: {
          regionId: {
            in: mergedRegionIds,
          },
        },
        data: {
          regionId: primaryRegion.id,
          state: primaryIdentity.state,
          district: primaryIdentity.district,
        },
      }),
    ]);

    await tx.region.deleteMany({
      where: {
        id: {
          in: duplicateRegionIds,
        },
      },
    });

    await tx.region.update({
      where: {
        id: primaryRegion.id,
      },
      data: {
        name: primaryIdentity.name,
        districtName: primaryIdentity.district,
        stateName: primaryIdentity.state,
        code: normalizeRegionCode(primaryIdentity.code) ?? primaryIdentity.code,
        slug: primaryIdentity.slug,
        notes,
        primaryPincode,
        additionalPincodes,
        isActive: regions.some((region) => region.isActive),
        managerUserId: chosenManagerUserId,
      },
    });

    await tx.registrationApplication.updateMany({
      where: {
        regionId: primaryRegion.id,
        status: RegistrationApplicationStatus.PENDING,
      },
      data: {
        assignedRegionalManagerId: chosenManagerUserId,
      },
    });
  });

  for (const managerUserId of affectedManagerIds) {
    await syncManagerScope(managerUserId);
  }

  return {
    ...summary,
    affectedManagerIds,
  };
};

async function main() {
  const regions = await prisma.region.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const duplicateGroups = new Map<string, RegionRecord[]>();

  for (const region of regions) {
    const identityKey = buildRegionIdentityKey(region.stateName, region.districtName);

    if (!identityKey) {
      continue;
    }

    const currentGroup = duplicateGroups.get(identityKey) ?? [];
    currentGroup.push(region);
    duplicateGroups.set(identityKey, currentGroup);
  }

  const duplicateRegionGroups = [...duplicateGroups.values()].filter((group) => group.length > 1);

  if (!duplicateRegionGroups.length) {
    console.log("[regions:cleanup] No duplicate region groups found.");
    return;
  }

  const results = [];

  for (const group of duplicateRegionGroups) {
    const result = await mergeDuplicateRegionGroup(group);

    if (result) {
      results.push(result);
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: shouldApply ? "apply" : "dry-run",
        duplicateGroups: duplicateRegionGroups.length,
        mergedGroups: results.length,
        results,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[regions:cleanup] Duplicate region cleanup failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
