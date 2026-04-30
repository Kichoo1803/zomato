export const normalizeRegionValue = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const stripRegionCodeDiacritics = (value: string) =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

const normalizeRegionCodeSegment = (value?: string | null) => {
  const normalizedValue = normalizeRegionValue(value);

  if (!normalizedValue) {
    return "";
  }

  return stripRegionCodeDiacritics(normalizedValue)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/-+/g, "-")
    .replace(/^[_-]+|[_-]+$/g, "");
};

export const buildRegionCode = (stateName?: string | null, districtName?: string | null) => {
  const stateCode = normalizeRegionCodeSegment(stateName);
  const districtCode = normalizeRegionCodeSegment(districtName);

  return stateCode && districtCode ? `${stateCode}::${districtCode}` : "";
};

export const normalizeRegionCode = (value?: string | null) => {
  const normalizedValue = normalizeRegionValue(value);

  if (!normalizedValue) {
    return "";
  }

  const separators = normalizedValue.match(/:+/g) ?? [];
  const segments = normalizedValue
    .split(/:+/)
    .map((segment) => normalizeRegionCodeSegment(segment))
    .filter(Boolean);

  if (!segments.length) {
    return "";
  }

  return segments.slice(1).reduce((result, segment, index) => {
    const separator = separators[index]?.length === 1 ? ":" : "::";
    return `${result}${separator}${segment}`;
  }, segments[0]);
};
