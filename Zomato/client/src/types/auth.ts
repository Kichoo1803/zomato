export type UserRole =
  | "CUSTOMER"
  | "RESTAURANT_OWNER"
  | "DELIVERY_PARTNER"
  | "ADMIN";

export type AuthUser = {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  profileImage?: string | null;
  role: UserRole;
  walletBalance?: number;
};

export type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setSession: (payload: { user: AuthUser; accessToken: string }) => void;
  clearSession: () => void;
};
