import { Role } from "../constants/enums.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { AppError } from "./app-error.js";
import { isRegionalOperationsRole, normalizeRegionValue } from "./regions.js";

export type RegionalAccessActor = {
  id: number;
  role: Role;
};

export type ScopedRegion = {
  regionId: number | null;
  state: string;
  district: string;
  regionName: string;
};

export type RequestedRegionAccess = {
  regionId?: number | null;
  state?: string | null;
  district?: string | null;
};

export type RegionalAccessState = {
  isRestricted: boolean;
  role: Role;
  assignedRegion: ScopedRegion | null;
};

const toPositiveInteger = (value: unknown) => {
  const normalizedValue = Number(value);
  return Number.isInteger(normalizedValue) && normalizedValue > 0 ? normalizedValue : null;
};

const normalizeRequestedRegion = (requested?: RequestedRegionAccess | null) => ({
  regionId: toPositiveInteger(requested?.regionId),
  state: normalizeRegionValue(requested?.state),
  district: normalizeRegionValue(requested?.district),
});

const hasRequestedRegion = (requested?: RequestedRegionAccess | null) => {
  const normalizedRequestedRegion = normalizeRequestedRegion(requested);
  return Boolean(
    normalizedRequestedRegion.regionId ||
      normalizedRequestedRegion.state ||
      normalizedRequestedRegion.district,
  );
};

const buildAllowedRegionLogValue = (assignedRegion: ScopedRegion | null) =>
  assignedRegion
    ? {
        regionId: assignedRegion.regionId,
        state: assignedRegion.state,
        district: assignedRegion.district,
      }
    : null;

const buildRequestedRegionLogValue = (requested?: RequestedRegionAccess | null) => {
  const normalizedRequestedRegion = normalizeRequestedRegion(requested);

  if (
    normalizedRequestedRegion.regionId == null &&
    !normalizedRequestedRegion.state &&
    !normalizedRequestedRegion.district
  ) {
    return null;
  }

  return normalizedRequestedRegion;
};

const logRegionalAccessEvent = (
  level: "info" | "warn",
  message: string,
  input: {
    actor: RegionalAccessActor;
    endpoint?: string;
    requestedRegion?: RequestedRegionAccess | null;
    assignedRegion: ScopedRegion | null;
  },
) => {
  logger[level](message, {
    userId: input.actor.id,
    role: input.actor.role,
    endpoint: input.endpoint,
    requestedRegion: buildRequestedRegionLogValue(input.requestedRegion),
    allowedRegion: buildAllowedRegionLogValue(input.assignedRegion),
  });
};

const matchesAssignedRegion = (
  assignedRegion: ScopedRegion,
  requested?: RequestedRegionAccess | null,
  options?: {
    allowBroadState?: boolean;
  },
) => {
  const normalizedRequestedRegion = normalizeRequestedRegion(requested);

  if (
    normalizedRequestedRegion.regionId != null &&
    assignedRegion.regionId != null &&
    normalizedRequestedRegion.regionId !== assignedRegion.regionId
  ) {
    return false;
  }

  if (normalizedRequestedRegion.state && normalizedRequestedRegion.state !== assignedRegion.state) {
    return false;
  }

  if (
    normalizedRequestedRegion.district &&
    normalizedRequestedRegion.district !== assignedRegion.district
  ) {
    return false;
  }

  if (
    normalizedRequestedRegion.state &&
    !normalizedRequestedRegion.district &&
    options?.allowBroadState !== true
  ) {
    return false;
  }

  if (normalizedRequestedRegion.district && !normalizedRequestedRegion.state) {
    return false;
  }

  return true;
};

const buildNoAssignedRegionError = () =>
  new AppError(
    StatusCodes.FORBIDDEN,
    "No region assigned. Contact admin.",
    "REGIONAL_SCOPE_NOT_ASSIGNED",
  );

export const getRegionalAccessState = async (
  actor: RegionalAccessActor,
): Promise<RegionalAccessState> => {
  if (actor.role === Role.ADMIN) {
    return {
      isRestricted: false,
      role: actor.role,
      assignedRegion: null,
    };
  }

  if (!isRegionalOperationsRole(actor.role)) {
    throw new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED");
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: {
      role: true,
      managedRegions: {
        where: {
          isActive: true,
        },
        select: {
          id: true,
          stateName: true,
          districtName: true,
        },
        orderBy: [{ stateName: "asc" }, { districtName: "asc" }, { id: "asc" }],
        take: 1,
      },
    },
  });

  if (!user || !isRegionalOperationsRole(user.role)) {
    throw new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED");
  }

  const primaryRegion = user.managedRegions[0];
  const assignedState = normalizeRegionValue(primaryRegion?.stateName);
  const assignedDistrict = normalizeRegionValue(primaryRegion?.districtName);

  if (!primaryRegion?.id || !assignedState || !assignedDistrict) {
    return {
      isRestricted: true,
      role: Role.REGIONAL_MANAGER,
      assignedRegion: null,
    };
  }

  return {
    isRestricted: true,
    role: Role.REGIONAL_MANAGER,
    assignedRegion: {
      regionId: primaryRegion.id,
      state: assignedState,
      district: assignedDistrict,
      regionName: `${assignedDistrict}, ${assignedState}`,
    },
  };
};

export const ensureAssignedRegionalAccess = (
  access: RegionalAccessState,
  input: {
    actor: RegionalAccessActor;
    endpoint?: string;
    requestedRegion?: RequestedRegionAccess | null;
  },
) => {
  if (!access.isRestricted) {
    return access;
  }

  if (access.assignedRegion) {
    return access;
  }

  logRegionalAccessEvent("warn", "Regional access denied without an assigned region", {
    actor: input.actor,
    endpoint: input.endpoint,
    requestedRegion: input.requestedRegion,
    assignedRegion: null,
  });

  throw buildNoAssignedRegionError();
};

export const applyRegionalReadScope = <T extends RequestedRegionAccess>(
  access: RegionalAccessState,
  filters: T,
  input: {
    actor: RegionalAccessActor;
    endpoint?: string;
  },
) => {
  if (!access.isRestricted || !access.assignedRegion) {
    return filters;
  }

  if (hasRequestedRegion(filters) && !matchesAssignedRegion(access.assignedRegion, filters, { allowBroadState: true })) {
    logRegionalAccessEvent("info", "Regional access filter overridden to the assigned region", {
      actor: input.actor,
      endpoint: input.endpoint,
      requestedRegion: filters,
      assignedRegion: access.assignedRegion,
    });
  }

  return {
    ...filters,
    regionId: access.assignedRegion.regionId ?? undefined,
    state: access.assignedRegion.state,
    district: access.assignedRegion.district,
  } as T;
};

export const assertRegionalWriteScope = (
  access: RegionalAccessState,
  requestedRegion: RequestedRegionAccess | null | undefined,
  input: {
    actor: RegionalAccessActor;
    endpoint?: string;
  },
) => {
  const assignedAccess = ensureAssignedRegionalAccess(access, {
    actor: input.actor,
    endpoint: input.endpoint,
    requestedRegion,
  });

  if (!assignedAccess.isRestricted || !assignedAccess.assignedRegion) {
    return;
  }

  if (matchesAssignedRegion(assignedAccess.assignedRegion, requestedRegion)) {
    return;
  }

  logRegionalAccessEvent("warn", "Regional write access denied outside the assigned region", {
    actor: input.actor,
    endpoint: input.endpoint,
    requestedRegion,
    assignedRegion: assignedAccess.assignedRegion,
  });

  throw new AppError(
    StatusCodes.FORBIDDEN,
    "You can only manage data inside your assigned region",
    "ACCESS_DENIED",
  );
};

export const assertRegionalRecordScope = (
  access: RegionalAccessState,
  recordRegion: RequestedRegionAccess | null | undefined,
  input: {
    actor: RegionalAccessActor;
    endpoint?: string;
  },
) => {
  const assignedAccess = ensureAssignedRegionalAccess(access, {
    actor: input.actor,
    endpoint: input.endpoint,
    requestedRegion: recordRegion,
  });

  if (!assignedAccess.isRestricted || !assignedAccess.assignedRegion) {
    return;
  }

  if (matchesAssignedRegion(assignedAccess.assignedRegion, recordRegion)) {
    return;
  }

  logRegionalAccessEvent("warn", "Regional record access denied outside the assigned region", {
    actor: input.actor,
    endpoint: input.endpoint,
    requestedRegion: recordRegion,
    assignedRegion: assignedAccess.assignedRegion,
  });

  throw new AppError(StatusCodes.FORBIDDEN, "Access denied", "ACCESS_DENIED");
};
