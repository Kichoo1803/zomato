import { Role } from "../constants/enums.js";
import { INDIA_REGION_OPTIONS, INDIA_STATE_OPTIONS } from "../lib/india-region-data.js";
import { normalizeRoleValue } from "./roles.js";

export const normalizeRegionValue = (value?: string | null) => {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed : null;
};

const districtAliasSuffixPattern = /\s+(urban|district)$/i;
const stripDiacritics = (value: string) =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

const toComparableRegionValue = (value?: string | null) => {
  const normalizedValue = normalizeRegionValue(value);

  if (!normalizedValue) {
    return null;
  }

  const comparableValue = stripDiacritics(normalizedValue)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return comparableValue || null;
};

const stateAliasOverrides: Record<string, string> = {
  "orissa": "Odisha",
  "pondicherry": "Puducherry",
};

const districtAliasOverridesByState: Record<string, Record<string, string>> = {
  "Tamil Nadu": {
    "kanyakumari": "Kanniyakumari",
  },
};

const getBaseDistrictVariants = (district?: string | null) => {
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

const getConfiguredDistrictAliasVariants = (district?: string | null) => {
  const districtKey = toComparableRegionValue(district);

  if (!districtKey) {
    return [];
  }

  const variants = new Set<string>();

  for (const aliases of Object.values(districtAliasOverridesByState)) {
    for (const [alias, canonicalDistrictName] of Object.entries(aliases)) {
      const aliasKey = toComparableRegionValue(alias);
      const canonicalKeys = getBaseDistrictVariants(canonicalDistrictName)
        .map((variant) => toComparableRegionValue(variant))
        .filter((variant): variant is string => Boolean(variant));

      if (aliasKey === districtKey || canonicalKeys.includes(districtKey)) {
        variants.add(alias);

        for (const variant of getBaseDistrictVariants(canonicalDistrictName)) {
          variants.add(variant);
        }
      }
    }
  }

  return [...variants];
};

const buildCanonicalStateLookup = () => {
  const stateLookup = new Map<string, string>();

  for (const state of INDIA_STATE_OPTIONS) {
    const stateKey = toComparableRegionValue(state);

    if (stateKey) {
      stateLookup.set(stateKey, state);
    }
  }

  for (const [alias, state] of Object.entries(stateAliasOverrides)) {
    const aliasKey = toComparableRegionValue(alias);

    if (aliasKey) {
      stateLookup.set(aliasKey, state);
    }
  }

  return stateLookup;
};

const canonicalStateLookup = buildCanonicalStateLookup();

const districtAliasLookupByState = new Map<string, Map<string, string>>();

for (const state of INDIA_STATE_OPTIONS) {
  const stateKey = toComparableRegionValue(state);
  const districtLookup = new Map<string, string>();

  for (const district of INDIA_REGION_OPTIONS[state] ?? []) {
    for (const variant of getBaseDistrictVariants(district)) {
      const variantKey = toComparableRegionValue(variant);

      if (variantKey) {
        districtLookup.set(variantKey, district);
      }
    }
  }

  for (const [alias, district] of Object.entries(districtAliasOverridesByState[state] ?? {})) {
    const aliasKey = toComparableRegionValue(alias);

    if (aliasKey) {
      districtLookup.set(aliasKey, district);
    }
  }

  if (stateKey) {
    districtAliasLookupByState.set(stateKey, districtLookup);
  }
}

export const resolveCanonicalRegionState = (state?: string | null) => {
  const stateKey = toComparableRegionValue(state);
  return stateKey ? canonicalStateLookup.get(stateKey) ?? null : null;
};

export const resolveCanonicalRegionDistrict = (
  state?: string | null,
  district?: string | null,
) => {
  const districtKey = toComparableRegionValue(district);

  if (!districtKey) {
    return null;
  }

  const canonicalState = resolveCanonicalRegionState(state) ?? normalizeRegionValue(state);
  const stateKey = toComparableRegionValue(canonicalState);
  const districtLookup = stateKey ? districtAliasLookupByState.get(stateKey) : null;

  if (!districtLookup) {
    return null;
  }

  return districtLookup.get(districtKey) ?? null;
};

export const buildRegionIdentityKey = (state?: string | null, district?: string | null) => {
  const identity = buildRegionIdentity(state, district);
  const stateKey = toComparableRegionValue(identity?.state ?? state);
  const districtKey = toComparableRegionValue(identity?.district ?? district);

  if (!stateKey || !districtKey) {
    return null;
  }

  return `${stateKey}::${districtKey}`;
};

export const getRegionStateVariants = (state?: string | null) => {
  const normalizedState = normalizeRegionValue(state);

  if (!normalizedState) {
    return [];
  }

  const variants = new Set([normalizedState]);
  const canonicalState = resolveCanonicalRegionState(normalizedState);

  if (canonicalState) {
    variants.add(canonicalState);
  }

  return [...variants];
};

export const getRegionDistrictVariants = (district?: string | null) => {
  const normalizedDistrict = normalizeRegionValue(district);

  if (!normalizedDistrict) {
    return [];
  }

  const variants = new Set(getBaseDistrictVariants(normalizedDistrict));

  for (const variant of getConfiguredDistrictAliasVariants(normalizedDistrict)) {
    variants.add(variant);
  }

  return [...variants];
};

export const matchesRegionDistrict = (district?: string | null, candidate?: string | null) => {
  const normalizedCandidate = toComparableRegionValue(candidate);

  if (!normalizedCandidate) {
    return false;
  }

  return getRegionDistrictVariants(district)
    .map((variant) => toComparableRegionValue(variant))
    .includes(normalizedCandidate);
};

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
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

export const buildRegionIdentity = (state?: string | null, district?: string | null) => {
  const normalizedState = resolveCanonicalRegionState(state) ?? normalizeRegionValue(state);
  const canonicalState = normalizedState ?? null;
  const normalizedDistrict =
    resolveCanonicalRegionDistrict(canonicalState, district) ?? normalizeRegionValue(district);

  if (!canonicalState || !normalizedDistrict) {
    return null;
  }

  const stateSlug = toSlugPart(canonicalState);
  const districtSlug = toSlugPart(normalizedDistrict);

  return {
    state: canonicalState,
    district: normalizedDistrict,
    name: `${normalizedDistrict}, ${canonicalState}`,
    code: buildRegionCode(canonicalState, normalizedDistrict) ?? `${stateSlug}::${districtSlug}`.toUpperCase(),
    slug: `${stateSlug}-${districtSlug}`,
  };
};

export const isRegionalOperationsRole = (role?: string | null) =>
  normalizeRoleValue(role) === Role.REGIONAL_MANAGER;
