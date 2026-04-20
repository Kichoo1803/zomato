import { INDIA_REGION_OPTIONS } from "@/lib/india-region-data";

export type RegionOptions = {
  states: string[];
  districtsByState: Record<string, string[]>;
};

const sortValues = (values: Iterable<string>) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right, "en-IN"));

export const INDIA_PINCODE_REGEX = /^[1-9][0-9]{5}$/;

export const mergeRegionOptions = (dynamicOptions?: Partial<RegionOptions> | null): RegionOptions => {
  const states = sortValues([
    ...Object.keys(INDIA_REGION_OPTIONS),
    ...(dynamicOptions?.states ?? []),
  ]);

  const districtsByState = Object.fromEntries(
    states.map((state) => [
      state,
      sortValues([
        ...(INDIA_REGION_OPTIONS[state] ?? []),
        ...(dynamicOptions?.districtsByState?.[state] ?? []),
      ]),
    ]),
  );

  return {
    states,
    districtsByState,
  };
};

export const getIndianStateOptions = (dynamicOptions?: Partial<RegionOptions> | null) =>
  mergeRegionOptions(dynamicOptions).states;

export const getDistrictOptions = (state?: string | null, options?: Partial<RegionOptions> | null) => {
  if (!state) {
    return [];
  }

  return mergeRegionOptions(options).districtsByState[state] ?? [];
};

export const isValidIndianPincode = (value?: string | null) =>
  Boolean(value && INDIA_PINCODE_REGEX.test(value.trim()));
