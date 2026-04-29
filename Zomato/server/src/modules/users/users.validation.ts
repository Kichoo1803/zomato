import { Role } from "../../constants/enums.js";
import { optionalIndianPhoneSchema } from "../../utils/phone.js";
import { z } from "zod";

const optionalRegionString = z.string().trim().min(2).max(120).optional();

export const updateProfileSchema = {
  body: z.object({
    fullName: z.string().trim().min(2).max(120).optional(),
    phone: optionalIndianPhoneSchema(),
    profileImage: z.string().trim().url().optional(),
  }),
};

export const updateMembershipSchema = {
  body: z
    .object({
      tier: z.enum(["CLASSIC", "GOLD", "PLATINUM"]),
      paymentMode: z.enum(["CARD", "UPI"]).optional(),
      paymentMethodId: z.coerce.number().int().positive().optional(),
    })
    .superRefine((values, context) => {
      if (values.tier !== "CLASSIC") {
        if (!values.paymentMode) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Select a payment mode before continuing.",
            path: ["paymentMode"],
          });
        }

        if (!values.paymentMethodId) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Add a payment method to upgrade this plan.",
            path: ["paymentMethodId"],
          });
        }
      }
    }),
};

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character");

export const listUsersQuerySchema = {
  query: z.object({
    role: z.nativeEnum(Role).optional(),
    search: z.string().trim().optional(),
    isActive: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  }),
};

const adminUserBodyBaseSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: optionalIndianPhoneSchema(),
  password: passwordSchema.optional(),
  role: z.nativeEnum(Role),
  managedRegionIds: z.array(z.coerce.number().int().positive()).optional(),
  assignedRegionIds: z.array(z.coerce.number().int().positive()).optional(),
  opsState: optionalRegionString,
  opsDistrict: optionalRegionString,
  opsNotes: z.string().trim().max(1000).optional(),
  profileImage: z.string().trim().url().optional(),
  walletBalance: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  phoneVerified: z.boolean().optional(),
});

const withAdminUserBodyValidation = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((values, context) => {
    const requestedRegionIds = values.assignedRegionIds ?? values.managedRegionIds;

    if (values.opsDistrict && !values.opsState) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["opsDistrict"],
        message: "Select a state before choosing a district.",
      });
    }

    if (values.assignedRegionIds && values.managedRegionIds) {
      const normalizedAssignedIds = [...new Set(values.assignedRegionIds)];
      const normalizedManagedIds = [...new Set(values.managedRegionIds)];
      const areAssignmentsEquivalent =
        normalizedAssignedIds.length === normalizedManagedIds.length &&
        normalizedAssignedIds.every((value) => normalizedManagedIds.includes(value));

      if (!areAssignmentsEquivalent) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assignedRegionIds"],
          message: "Use matching region assignments when both assignment fields are provided.",
        });
      }
    }

    if (requestedRegionIds) {
      const uniqueIds = new Set(requestedRegionIds);

      if (uniqueIds.size !== requestedRegionIds.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: values.assignedRegionIds ? ["assignedRegionIds"] : ["managedRegionIds"],
          message: "Assigned regions must be unique.",
        });
      }

      if (uniqueIds.size > 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: values.assignedRegionIds ? ["assignedRegionIds"] : ["managedRegionIds"],
          message: "Regional managers can only be assigned to one region at a time.",
        });
      }
    }
  });

const adminUserBodySchema = withAdminUserBodyValidation(adminUserBodyBaseSchema);

export const createUserSchema = {
  body: withAdminUserBodyValidation(adminUserBodyBaseSchema.extend({
    password: passwordSchema,
  })),
};

export const updateUserSchema = {
  params: z.object({
    userId: z.coerce.number().int().positive(),
  }),
  body: withAdminUserBodyValidation(adminUserBodyBaseSchema.partial()),
};

export const userIdParamSchema = {
  params: z.object({
    userId: z.coerce.number().int().positive(),
  }),
};
