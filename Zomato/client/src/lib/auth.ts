import axios from "axios";
import { publicApi } from "@/lib/api";
import type { AuthUser, MembershipStatus, MembershipTier, UserRole } from "@/types/auth";

type BackendAuthUser = {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  profileImage?: string | null;
  role: string;
  walletBalance?: number | null;
  membershipTier?: string | null;
  membershipStatus?: string | null;
  membershipStartedAt?: string | null;
  membershipExpiresAt?: string | null;
};

type AuthResponse = {
  data?: {
    user?: BackendAuthUser;
    accessToken?: string;
  };
};

const allowedRoles: UserRole[] = [
  "CUSTOMER",
  "RESTAURANT_OWNER",
  "DELIVERY_PARTNER",
  "OPERATIONS_MANAGER",
  "ADMIN",
];

const allowedMembershipTiers: MembershipTier[] = ["CLASSIC", "GOLD", "PLATINUM"];
const allowedMembershipStatuses: MembershipStatus[] = ["ACTIVE", "INACTIVE", "EXPIRED"];

export const normalizeAuthUser = (user: BackendAuthUser): AuthUser => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone ?? null,
  profileImage: user.profileImage ?? null,
  role: allowedRoles.includes(user.role as UserRole) ? (user.role as UserRole) : "CUSTOMER",
  walletBalance: user.walletBalance ?? 0,
  membershipTier: allowedMembershipTiers.includes(user.membershipTier as MembershipTier)
    ? (user.membershipTier as MembershipTier)
    : "CLASSIC",
  membershipStatus: allowedMembershipStatuses.includes(user.membershipStatus as MembershipStatus)
    ? (user.membershipStatus as MembershipStatus)
    : "ACTIVE",
  membershipStartedAt: user.membershipStartedAt ?? null,
  membershipExpiresAt: user.membershipExpiresAt ?? null,
});

const parseAuthResponse = (response: AuthResponse) => {
  const accessToken = response.data?.accessToken;
  const user = response.data?.user;

  if (!accessToken || !user) {
    throw new Error("The server returned an incomplete sign-in response. Please try again.");
  }

  return {
    accessToken,
    user: normalizeAuthUser(user),
  };
};

export const loginWithPassword = async (payload: { email: string; password: string }) => {
  const response = await publicApi.post<AuthResponse>("/auth/login", payload);
  return parseAuthResponse(response.data);
};

export const registerWithPassword = async (payload: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}) => {
  const response = await publicApi.post<AuthResponse>("/auth/register", {
    ...payload,
    role: "CUSTOMER",
  });

  return parseAuthResponse(response.data);
};

export const logoutFromServer = async () => {
  await publicApi.post("/auth/logout");
};

export const getDefaultRedirectPath = (role: UserRole) => {
  switch (role) {
    case "ADMIN":
      return "/admin/dashboard";
    case "OPERATIONS_MANAGER":
      return "/ops/dashboard";
    case "RESTAURANT_OWNER":
      return "/owner/dashboard";
    case "DELIVERY_PARTNER":
      return "/delivery";
    case "CUSTOMER":
    default:
      return "/";
  }
};

export const getLoginRedirectPath = (pathname: string) => {
  if (pathname.startsWith("/admin") || pathname.startsWith("/analytics") || pathname.startsWith("/team")) {
    return "/admin/login";
  }

  if (pathname.startsWith("/ops")) {
    return "/ops/login";
  }

  if (pathname.startsWith("/owner")) {
    return "/owner/login";
  }

  if (pathname.startsWith("/partner")) {
    return "/partner/login";
  }

  if (pathname.startsWith("/delivery")) {
    return "/delivery/login";
  }

  return "/login";
};

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }

    return fallback;
  }

  const responseMessage = error.response?.data?.message;
  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }

  if (error.code === "ERR_NETWORK") {
    return "Unable to reach the server. Please check that the backend is running and reachable from this device.";
  }

  if (error.code === "ERR_BAD_RESPONSE" || (error.response?.status ?? 0) >= 500) {
    return "The server couldn't complete your request right now. Please try again in a moment.";
  }

  return fallback;
};
