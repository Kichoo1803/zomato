import { z } from "zod";
import {
  INDIA_PINCODE_REGEX,
  isValidDistrictForState,
  isValidIndianState,
} from "../../lib/india-region-data.js";

const optionalRegionString = z.string().trim().min(2).max(120).optional();
const optionalRegionCode = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(
    /^[A-Za-z0-9:_-]+$/,
    "Region code can only include letters, numbers, colons, hyphens, and underscores.",
  )
  .optional();
const optionalRegionSlug = z
  .string()
  .trim()
  .min(2)
  .max(160)
  .regex(
    /^[a-z0-9-]+$/,
    "Region slug can only include lowercase letters, numbers, and hyphens.",
  )
  .optional();
const optionalManagerId = z.union([z.coerce.number().int().positive(), z.null()]).optional();
const optionalPincode = z
  .string()
  .trim()
  .regex(INDIA_PINCODE_REGEX, "Enter a valid 6-digit Indian PIN code.")
  .optional();
const optionalPincodeList = z
  .array(z.string().trim().regex(INDIA_PINCODE_REGEX, "Enter valid 6-digit Indian PIN codes."))
  .optional();

const addRegionLocationIssues = (
  values: {
    stateName?: string;
    districtName?: string;
    primaryPincode?: string;
    additionalPincodes?: string[];
  },
  context: z.RefinementCtx,
  mode: "create" | "update",
) => {
  if (values.stateName && !isValidIndianState(values.stateName)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["stateName"],
      message: "Select a valid Indian state or union territory.",
    });
  }

  if (mode === "create" && !values.stateName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["stateName"],
      message: "State is required.",
    });
  }

  if (mode === "create" && !values.districtName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["districtName"],
      message: "District is required.",
    });
  }

  if (values.districtName && values.stateName && !isValidDistrictForState(values.stateName, values.districtName)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["districtName"],
      message: "Select a district that belongs to the chosen state or union territory.",
    });
  }

  if (values.additionalPincodes) {
    const normalized = values.additionalPincodes.map((value) => value.trim());
    const uniqueCount = new Set(normalized).size;

    if (uniqueCount !== normalized.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["additionalPincodes"],
        message: "Additional PIN codes must be unique.",
      });
    }
  }
};

const regionBodyBaseSchema = z.object({
  name: optionalRegionString,
  districtName: optionalRegionString,
  stateName: optionalRegionString,
  code: optionalRegionCode,
  slug: optionalRegionSlug,
  notes: z.string().trim().max(1000).optional(),
  primaryPincode: optionalPincode,
  additionalPincodes: optionalPincodeList,
  isActive: z.boolean().optional(),
  managerUserId: optionalManagerId,
});

export const listRegionsQuerySchema = {
  query: z.object({
    search: z.string().trim().optional(),
    isActive: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    assignmentStatus: z.enum(["ASSIGNED", "UNASSIGNED"]).optional(),
  }),
};

export const createRegionSchema = {
  body: regionBodyBaseSchema.superRefine((values, context) => {
    addRegionLocationIssues(values, context, "create");
  }),
};

export const updateRegionSchema = {
  params: z.object({
    regionId: z.coerce.number().int().positive(),
  }),
  body: regionBodyBaseSchema.partial().superRefine((values, context) => {
    addRegionLocationIssues(values, context, "update");
  }),
};
