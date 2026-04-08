import axios from "axios";
import { useAuthStore } from "@/store/auth.store";

const baseURL = import.meta.env.VITE_API_BASE_URL;

export const publicApi = axios.create({
  baseURL,
  withCredentials: true,
});

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let refreshPromise: Promise<string | null> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };
    const hasSession = Boolean(useAuthStore.getState().accessToken);

    if (error.response?.status !== 401 || originalRequest?._retry || !hasSession) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    refreshPromise ??= publicApi
      .post("/auth/refresh")
      .then((response) => {
        const accessToken = response.data?.data?.accessToken as string | undefined;
        const user = response.data?.data?.user;

        if (accessToken && user) {
          useAuthStore.getState().setSession({ accessToken, user });
          return accessToken;
        }

        useAuthStore.getState().clearSession();
        return null;
      })
      .catch(() => {
        useAuthStore.getState().clearSession();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });

    const token = await refreshPromise;
    if (!token) {
      return Promise.reject(error);
    }

    originalRequest.headers.Authorization = `Bearer ${token}`;
    return apiClient(originalRequest);
  },
);
