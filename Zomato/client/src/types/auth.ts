export const USER_ROLES = [
  "CUSTOMER",
  "RESTAURANT_OWNER",
  "DELIVERY_PARTNER",
  "REGIONAL_MANAGER",
  "ADMIN",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type MembershipTier = "CLASSIC" | "GOLD" | "PLATINUM";
export type MembershipStatus = "ACTIVE" | "INACTIVE" | "EXPIRED";

export type AuthUser = {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  profileImage?: string | null;
  role: UserRole;
  walletBalance?: number;
  membershipTier?: MembershipTier;
  membershipStatus?: MembershipStatus;
  membershipStartedAt?: string | null;
  membershipExpiresAt?: string | null;
};

export type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setSession: (payload: { user: AuthUser; accessToken: string }) => void;
  clearSession: () => void;
};
