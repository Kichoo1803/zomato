import axios from "axios";
import { publicApi } from "@/lib/api";
import type { AuthUser, UserRole } from "@/types/auth";

type BackendAuthUser = {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  profileImage?: string | null;
  role: string;
  walletBalance?: number | null;
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
  "ADMIN",
];

export const normalizeAuthUser = (user: BackendAuthUser): AuthUser => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone ?? null,
  profileImage: user.profileImage ?? null,
  role: allowedRoles.includes(user.role as UserRole) ? (user.role as UserRole) : "CUSTOMER",
  walletBalance: user.walletBalance ?? 0,
});

const parseAuthResponse = (response: AuthResponse) => {
  const accessToken = response.data?.accessToken;
  const user = response.data?.user;

  if (!accessToken || !user) {
    throw new Error("The authentication response was incomplete.");
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
      return "/admin";
    case "RESTAURANT_OWNER":
      return "/partner";
    case "DELIVERY_PARTNER":
      return "/delivery";
    case "CUSTOMER":
    default:
      return "/";
  }
};

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const responseMessage = error.response?.data?.message;
  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }

  if (error.code === "ERR_NETWORK") {
    return "Unable to reach the server. Please check that the backend is running.";
  }

  return fallback;
};
