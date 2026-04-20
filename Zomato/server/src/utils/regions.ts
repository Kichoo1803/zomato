import { Role } from "../constants/enums.js";

export const normalizeRegionValue = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const toSlugPart = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const buildRegionIdentity = (state?: string | null, district?: string | null) => {
  const normalizedState = normalizeRegionValue(state);
  const normalizedDistrict = normalizeRegionValue(district);

  if (!normalizedState || !normalizedDistrict) {
    return null;
  }

  const stateSlug = toSlugPart(normalizedState);
  const districtSlug = toSlugPart(normalizedDistrict);

  return {
    state: normalizedState,
    district: normalizedDistrict,
    name: `${normalizedDistrict}, ${normalizedState}`,
    code: `${normalizedState.toUpperCase()}::${normalizedDistrict.toUpperCase()}`,
    slug: `${stateSlug}-${districtSlug}`,
  };
};

export const isRegionalOperationsRole = (role?: string | null) =>
  role === Role.REGIONAL_MANAGER || role === Role.OPERATIONS_MANAGER;

