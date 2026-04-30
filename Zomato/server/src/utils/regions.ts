import { Role } from "../constants/enums.js";
import { normalizeRoleValue } from "./roles.js";

export const normalizeRegionValue = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const districtAliasSuffixPattern = /\s+(urban|district)$/i;

export const getRegionDistrictVariants = (district?: string | null) => {
  const normalizedDistrict = normalizeRegionValue(district);

  if (!normalizedDistrict) {
    return [];
  }

  const variants = new Set([normalizedDistrict]);

  if (districtAliasSuffixPattern.test(normalizedDistrict)) {
    const baseDistrict = normalizedDistrict.replace(districtAliasSuffixPattern, "").trim();

    if (baseDistrict) {
      variants.add(baseDistrict);
    }
  }

  return [...variants];
};

export const matchesRegionDistrict = (district?: string | null, candidate?: string | null) => {
  const normalizedCandidate = normalizeRegionValue(candidate);

  if (!normalizedCandidate) {
    return false;
  }

  return getRegionDistrictVariants(district).includes(normalizedCandidate);
};

const stripDiacritics = (value: string) =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

const normalizeRegionCodeSegment = (value?: string | null) => {
  const normalizedValue = normalizeRegionValue(value);

  if (!normalizedValue) {
    return null;
  }

  const sanitizedValue = stripDiacritics(normalizedValue)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/-+/g, "-")
    .replace(/^[_-]+|[_-]+$/g, "");

  return sanitizedValue || null;
};

export const buildRegionCode = (state?: string | null, district?: string | null) => {
  const stateCode = normalizeRegionCodeSegment(state);
  const districtCode = normalizeRegionCodeSegment(district);

  if (!stateCode || !districtCode) {
    return null;
  }

  return `${stateCode}::${districtCode}`;
};

export const normalizeRegionCode = (value?: string | null) => {
  const normalizedValue = normalizeRegionValue(value);

  if (!normalizedValue) {
    return null;
  }

  const separators = normalizedValue.match(/:+/g) ?? [];
  const segments = normalizedValue
    .split(/:+/)
    .map((segment) => normalizeRegionCodeSegment(segment))
    .filter((segment): segment is string => Boolean(segment));

  if (!segments.length) {
    return null;
  }

  return segments.slice(1).reduce((result, segment, index) => {
    const separator = separators[index]?.length === 1 ? ":" : "::";
    return `${result}${separator}${segment}`;
  }, segments[0]);
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
    code: buildRegionCode(normalizedState, normalizedDistrict) ?? `${stateSlug}::${districtSlug}`.toUpperCase(),
    slug: `${stateSlug}-${districtSlug}`,
  };
};

export const isRegionalOperationsRole = (role?: string | null) =>
  normalizeRoleValue(role) === Role.REGIONAL_MANAGER;
