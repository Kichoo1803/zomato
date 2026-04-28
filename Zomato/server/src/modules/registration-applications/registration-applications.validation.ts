import { z } from "zod";
import {
  INDIA_PINCODE_REGEX,
  isValidDistrictForState,
  isValidIndianState,
} from "../../lib/india-region-data.js";
import {
  RegistrationApplicationPayoutMethod,
  RegistrationApplicationRoleType,
  RegistrationApplicationStatus,
} from "./registration-applications.constants.js";
import { optionalIndianPhoneSchema, requiredIndianPhoneSchema } from "../../utils/phone.js";

const phoneSchema = requiredIndianPhoneSchema();
const optionalPhoneSchema = optionalIndianPhoneSchema();
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character");
const optionalText = z.string().trim().min(2).max(160).optional();
const optionalDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format.")
  .optional();
const payoutMethodSchema = z
  .enum([
    RegistrationApplicationPayoutMethod.BANK_TRANSFER,
    RegistrationApplicationPayoutMethod.UPI,
  ])
  .optional();

const withRegionValidation = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((values, context) => {
    const state = values.state;
    const district = values.district;

    if (!isValidIndianState(state)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["state"],
        message: "Select a valid Indian state or union territory.",
      });
    }

    if (state && district && !isValidDistrictForState(state, district)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["district"],
        message: "Select a district that belongs to the chosen state.",
      });
    }

    if (values.payoutMethod === RegistrationApplicationPayoutMethod.BANK_TRANSFER) {
      if (!values.accountHolderName?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["accountHolderName"],
          message: "Account holder name is required for bank transfers.",
        });
      }

      if (!values.bankName?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bankName"],
          message: "Bank name is required for bank transfers.",
        });
      }

      if (!values.accountNumberLast4?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["accountNumberLast4"],
          message: "Enter the last 4 digits of the payout account number.",
        });
      }

      if (!values.ifscCode?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ifscCode"],
          message: "IFSC code is required for bank transfers.",
        });
      }
    }

    if (values.payoutMethod === RegistrationApplicationPayoutMethod.UPI && !values.upiId?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["upiId"],
        message: "UPI ID is required when UPI is selected as the payout method.",
      });
    }

    if (values.alternatePhone && values.alternatePhone === values.phone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alternatePhone"],
        message: "Alternate phone number should be different from the primary phone number.",
      });
    }
  });

const applicationBodyBaseSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: phoneSchema,
  alternatePhone: optionalPhoneSchema,
  password: passwordSchema,
  state: z.string().trim().min(2).max(120),
  district: z.string().trim().min(2).max(120),
  pincode: z.string().trim().regex(INDIA_PINCODE_REGEX, "Enter a valid 6-digit Indian PIN code."),
  idProofType: z.string().trim().min(2).max(60),
  idProofNumber: z.string().trim().min(4).max(120),
  payoutMethod: payoutMethodSchema,
  accountHolderName: optionalText,
  bankName: optionalText,
  accountNumberLast4: z.string().trim().regex(/^\d{4}$/, "Enter exactly 4 digits.").optional(),
  ifscCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, "Enter a valid IFSC code.")
    .optional(),
  upiId: z
    .string()
    .trim()
    .regex(/^[a-z0-9._-]{2,256}@[a-z]{2,64}$/i, "Enter a valid UPI ID.")
    .optional(),
  termsAccepted: z
    .enum(["true", "1", "on"])
    .transform(() => true),
});

export const submitRestaurantOwnerApplicationSchema = {
  body: withRegionValidation(
    applicationBodyBaseSchema.extend({
      restaurantName: z.string().trim().min(2).max(160),
      restaurantAddress: z.string().trim().min(8).max(300),
      fssaiCertificateNumber: z.string().trim().min(6).max(80),
    }),
  ),
};

export const submitDeliveryPartnerApplicationSchema = {
  body: withRegionValidation(
    applicationBodyBaseSchema.extend({
      addressLine: z.string().trim().min(8).max(300),
      vehicleType: z.enum(["BIKE", "CYCLE", "SCOOTER", "CAR"]),
      vehicleNumber: z.string().trim().min(4).max(40),
      drivingLicenseNumber: z.string().trim().min(6).max(80),
    }),
  ),
};

export const listRegistrationApplicationsQuerySchema = {
  query: z.object({
    search: z.string().trim().optional(),
    roleType: z
      .enum([
        RegistrationApplicationRoleType.RESTAURANT_OWNER,
        RegistrationApplicationRoleType.DELIVERY_PARTNER,
      ])
      .optional(),
    status: z
      .enum([
        RegistrationApplicationStatus.PENDING,
        RegistrationApplicationStatus.APPROVED,
        RegistrationApplicationStatus.REJECTED,
      ])
      .optional(),
    regionId: z.coerce.number().int().positive().optional(),
    state: z.string().trim().optional(),
    district: z.string().trim().optional(),
    createdFrom: optionalDateString,
    createdTo: optionalDateString,
    unassignedOnly: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  }),
};

export const approveRegistrationApplicationSchema = {
  params: z.object({
    applicationId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    remarks: z.string().trim().max(1000).optional(),
  }),
};

export const rejectRegistrationApplicationSchema = {
  params: z.object({
    applicationId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    remarks: z.string().trim().min(2).max(1000),
  }),
};
