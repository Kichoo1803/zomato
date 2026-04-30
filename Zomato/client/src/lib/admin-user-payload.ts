import type { UserRole } from "../types/auth";
import { INDIAN_COUNTRY_CODE, parseIndianPhoneInput } from "./phone";

const USER_ROLE_API_VALUES = {
  ADMIN: "ADMIN",
  CUSTOMER: "CUSTOMER",
  DELIVERY_PARTNER: "DELIVERY_PARTNER",
  REGIONAL_MANAGER: "REGIONAL_MANAGER",
  RESTAURANT_OWNER: "RESTAURANT_OWNER",
} satisfies Record<UserRole, UserRole>;

export type AdminUserFormPayloadInput = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  profileImage: string;
  walletBalance: string;
  isActive: boolean;
};

export const normalizeAdminUserPhoneForApi = (value?: string | null) => {
  const localDigits = parseIndianPhoneInput(value);

  return localDigits ? `${INDIAN_COUNTRY_CODE}${localDigits}` : undefined;
};

export const buildAdminUserPayload = (input: AdminUserFormPayloadInput) => {
  const trimmedPassword = input.password.trim();
  const trimmedProfileImage = input.profileImage.trim();

  return {
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    phone: normalizeAdminUserPhoneForApi(input.phone),
    password: trimmedPassword || undefined,
    role: USER_ROLE_API_VALUES[input.role],
    profileImage: trimmedProfileImage || undefined,
    walletBalance: Number(input.walletBalance.trim() || "0"),
    isActive: input.isActive,
  };
};
