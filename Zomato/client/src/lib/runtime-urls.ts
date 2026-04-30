const localhostHostnames = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const privateIpv4Pattern = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;
const devClientPorts = new Set(["5173", "5174", "4173"]);

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const isLocalHostname = (hostname: string) => {
  const normalizedHostname = hostname.trim().toLowerCase();
  return localhostHostnames.has(normalizedHostname) || privateIpv4Pattern.test(normalizedHostname);
};

const shouldMirrorCurrentHostname = (targetUrl: URL, currentHostname: string) =>
  Boolean(currentHostname) &&
  isLocalHostname(currentHostname) &&
  localhostHostnames.has(targetUrl.hostname);

const getDefaultApiBaseUrl = () => {
  if (typeof window === "undefined") {
    return "/api/v1";
  }

  if (import.meta.env.DEV || devClientPorts.has(window.location.port)) {
    return `${window.location.protocol}//${window.location.hostname}:4000/api/v1`;
  }

  return `${window.location.origin}/api/v1`;
};

const getDefaultRealtimeServerUrl = () => {
  if (typeof window === "undefined") {
    return "";
  }

  if (devClientPorts.has(window.location.port)) {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  return window.location.origin;
};

const resolveConfiguredUrl = (configuredUrl: string | undefined, fallbackUrl: string) => {
  if (!configuredUrl || typeof window === "undefined") {
    return trimTrailingSlash(configuredUrl ?? fallbackUrl);
  }

  try {
    const resolvedUrl = new URL(configuredUrl, window.location.origin);

    if (shouldMirrorCurrentHostname(resolvedUrl, window.location.hostname)) {
      resolvedUrl.hostname = window.location.hostname;
    }

    return trimTrailingSlash(resolvedUrl.toString());
  } catch {
    return trimTrailingSlash(configuredUrl);
  }
};

export const resolveApiBaseUrl = () => {
  const configuredApiUrl =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
    (import.meta.env.VITE_API_URL as string | undefined);

  return resolveConfiguredUrl(configuredApiUrl, getDefaultApiBaseUrl());
};

export const resolveRealtimeServerUrl = () => {
  const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL as string | undefined;
  if (configuredSocketUrl) {
    return resolveConfiguredUrl(configuredSocketUrl, getDefaultRealtimeServerUrl());
  }

  if (typeof window === "undefined") {
    return getDefaultRealtimeServerUrl();
  }

  try {
    return new URL(resolveApiBaseUrl(), window.location.origin).origin;
  } catch {
    return getDefaultRealtimeServerUrl();
  }
};
