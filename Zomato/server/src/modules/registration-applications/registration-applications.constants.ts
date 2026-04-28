import { Role } from "../../constants/enums.js";

export const RegistrationApplicationRoleType = {
  RESTAURANT_OWNER: Role.RESTAURANT_OWNER,
  DELIVERY_PARTNER: Role.DELIVERY_PARTNER,
} as const;

export const RegistrationApplicationStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export const RegistrationApplicationPayoutMethod = {
  BANK_TRANSFER: "BANK_TRANSFER",
  UPI: "UPI",
} as const;
