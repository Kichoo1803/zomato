import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { resolveApiBaseUrl } from "@/lib/runtime-urls";
import { normalizeStoredAuthUser } from "@/lib/roles";
import { useAuthStore } from "@/store/auth.store";

const baseURL = resolveApiBaseUrl();
const API_REQUEST_TIMEOUT_MS = 10_000;
const API_RETRY_LIMIT = 1;
const RETRYABLE_METHODS = new Set(["get", "head", "options"]);
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retryCount?: number;
  _skipAutoRetry?: boolean;
};

const delay = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs));

const shouldRetryRequest = (error: AxiosError) => {
  const requestConfig = error.config as RetriableRequestConfig | undefined;
  if (!requestConfig || requestConfig._skipAutoRetry) {
    return false;
  }

  const method = requestConfig.method?.toLowerCase() ?? "get";
  if (!RETRYABLE_METHODS.has(method)) {
    return false;
  }

  const retryCount = requestConfig._retryCount ?? 0;
  if (retryCount >= API_RETRY_LIMIT || error.code === "ERR_CANCELED") {
    return false;
  }

  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT" || error.code === "ERR_NETWORK") {
    return true;
  }

  const statusCode = error.response?.status ?? 0;
  return RETRYABLE_STATUS_CODES.has(statusCode);
};

const attachRetryInterceptor = (client: AxiosInstance) => {
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (!shouldRetryRequest(error)) {
        return Promise.reject(error);
      }

      const requestConfig = error.config as RetriableRequestConfig;
      requestConfig._retryCount = (requestConfig._retryCount ?? 0) + 1;

      await delay(400 * requestConfig._retryCount);
      return client(requestConfig);
    },
  );
};

const createApiClient = () =>
  axios.create({
    baseURL,
    withCredentials: true,
    timeout: API_REQUEST_TIMEOUT_MS,
  });

export const publicApi = createApiClient();
export const apiClient = createApiClient();

attachRetryInterceptor(publicApi);
attachRetryInterceptor(apiClient);

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
        const user = normalizeStoredAuthUser(response.data?.data?.user ?? null);

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
