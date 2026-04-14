import { DeliveryAvailabilityStatus } from "../../constants/enums.js";
import { z } from "zod";

const optionalRegionString = z.string().trim().min(2).max(120).optional();

const withRegionFields = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object({
      ...shape,
      state: optionalRegionString,
      district: optionalRegionString,
    })
    .superRefine((values, context) => {
      if (values.district && !values.state) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["district"],
          message: "Select a state before choosing a district.",
        });
      }
    });

export const operationsRegionQuerySchema = {
  query: withRegionFields({}),
};

export const listOperationsOwnersQuerySchema = {
  query: withRegionFields({
    search: z.string().trim().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    assignmentStatus: z.enum(["ASSIGNED", "UNASSIGNED", "PARTIAL"]).optional(),
  }),
};

export const listOperationsDeliveryPartnersQuerySchema = {
  query: withRegionFields({
    search: z.string().trim().optional(),
    availabilityStatus: z
      .enum([
        DeliveryAvailabilityStatus.ONLINE,
        DeliveryAvailabilityStatus.OFFLINE,
        DeliveryAvailabilityStatus.BUSY,
      ])
      .optional(),
    assignmentStatus: z.enum(["ASSIGNED", "UNASSIGNED", "PARTIAL"]).optional(),
  }),
};

export const updateOperationsAssignmentSchema = {
  params: z.object({
    userId: z.coerce.number().int().positive(),
  }),
  body: withRegionFields({
    notes: z.string().trim().max(1000).optional(),
  }),
};

export const listOperationsCommunicationsQuerySchema = {
  query: withRegionFields({
    search: z.string().trim().optional(),
  }),
};

const regionNoteBodySchema = withRegionFields({
  title: z.string().trim().min(2).max(160),
  message: z.string().trim().min(2).max(1600),
}).refine((values) => Boolean(values.state), {
  message: "Select a state before saving this region note.",
  path: ["state"],
});

export const createOperationsRegionNoteSchema = {
  body: regionNoteBodySchema,
};

export const updateOperationsRegionNoteSchema = {
  params: z.object({
    noteId: z.coerce.number().int().positive(),
  }),
  body: withRegionFields({
    title: z.string().trim().min(2).max(160).optional(),
    message: z.string().trim().min(2).max(1600).optional(),
  }),
};
