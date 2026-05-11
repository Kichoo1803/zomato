const localhostHostnames = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const privateIpv4Pattern = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;
const devClientPorts = new Set(["5173", "5174", "4173"]);
const LOCAL_API_SERVER_ORIGIN = "http://localhost:4000";
const LOCAL_API_BASE_PATH = "/api/v1";
const LOCAL_API_BASE_URL = `${LOCAL_API_SERVER_ORIGIN}${LOCAL_API_BASE_PATH}`;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const trimLeadingSlash = (value: string) => value.replace(/^\/+/, "");

const isLocalHostname = (hostname: string) => {
  const normalizedHostname = hostname.trim().toLowerCase();
  return localhostHostnames.has(normalizedHostname) || privateIpv4Pattern.test(normalizedHostname);
};

const shouldMirrorCurrentHostname = (targetUrl: URL, currentHostname: string) =>
  Boolean(currentHostname) &&
  isLocalHostname(currentHostname) &&
  localhostHostnames.has(targetUrl.hostname);

const getUrlResolutionBase = () =>
  typeof window === "undefined" ? LOCAL_API_SERVER_ORIGIN : window.location.origin;

const normalizeApiBasePath = (pathname: string) => {
  const normalizedPathname = trimTrailingSlash(pathname);

  if (!normalizedPathname || normalizedPathname === "/") {
    return LOCAL_API_BASE_PATH;
  }

  if (normalizedPathname.endsWith(LOCAL_API_BASE_PATH)) {
    return normalizedPathname;
  }

  if (normalizedPathname.endsWith("/api")) {
    return `${normalizedPathname}/v1`;
  }

  return `${normalizedPathname}${LOCAL_API_BASE_PATH}`;
};

const getDefaultApiBaseUrl = () => {
  if (typeof window !== "undefined" && (import.meta.env.DEV || devClientPorts.has(window.location.port))) {
    return `${window.location.protocol}//${window.location.hostname}:4000${LOCAL_API_BASE_PATH}`;
  }

  return LOCAL_API_BASE_URL;
};

const getDefaultRealtimeServerUrl = () => {
  if (typeof window !== "undefined" && devClientPorts.has(window.location.port)) {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  return LOCAL_API_SERVER_ORIGIN;
};

const resolveConfiguredUrl = (configuredUrl: string | undefined, fallbackUrl: string) => {
  if (!configuredUrl || typeof window === "undefined") {
    return trimTrailingSlash(configuredUrl ?? fallbackUrl);
  }

  try {
    const resolvedUrl = new URL(configuredUrl, getUrlResolutionBase());

    if (shouldMirrorCurrentHostname(resolvedUrl, window.location.hostname)) {
      resolvedUrl.hostname = window.location.hostname;
    }

    return trimTrailingSlash(resolvedUrl.toString());
  } catch {
    return trimTrailingSlash(configuredUrl);
  }
};

export const resolveApiBaseUrl = () => {
  const configuredApiUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const resolvedApiBaseUrl = resolveConfiguredUrl(configuredApiUrl, getDefaultApiBaseUrl());

  try {
    const normalizedApiBaseUrl = new URL(resolvedApiBaseUrl, getUrlResolutionBase());
    normalizedApiBaseUrl.pathname = normalizeApiBasePath(normalizedApiBaseUrl.pathname);
    return trimTrailingSlash(normalizedApiBaseUrl.toString());
  } catch {
    return trimTrailingSlash(resolvedApiBaseUrl);
  }
};

export const resolveApiRequestUrl = (path: string) => {
  const normalizedPath = trimLeadingSlash(path);

  try {
    return new URL(normalizedPath, `${resolveApiBaseUrl()}/`).toString();
  } catch {
    return `${resolveApiBaseUrl()}/${normalizedPath}`;
  }
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
