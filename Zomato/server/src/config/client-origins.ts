import { env } from "./env.js";

const localhostHostnames = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const privateIpv4Pattern = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;
const LOCAL_VITE_PREVIEW_PORT = "4173";
const LOCAL_VITE_DEV_PORT_MIN = 5173;
const LOCAL_VITE_DEV_PORT_MAX = 5199;
const defaultDevClientOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

const normalizeOrigin = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const getDefaultPort = (protocol: string) => (protocol === "https:" ? "443" : "80");

const isLocalDevelopmentPort = (port: string) => {
  if (port === LOCAL_VITE_PREVIEW_PORT) {
    return true;
  }

  const numericPort = Number(port);
  return Number.isInteger(numericPort) && numericPort >= LOCAL_VITE_DEV_PORT_MIN && numericPort <= LOCAL_VITE_DEV_PORT_MAX;
};

const configuredCorsOrigins = (env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => normalizeOrigin(origin.trim()))
  .filter((origin): origin is string => Boolean(origin));

const configuredOrigins = Array.from(
  new Set(
    [env.CLIENT_URL, ...configuredCorsOrigins, ...defaultDevClientOrigins]
      .map(normalizeOrigin)
      .filter((origin): origin is string => Boolean(origin)),
  ),
);

const isLocalDevelopmentOrigin = (origin: URL) => {
  if (!["http:", "https:"].includes(origin.protocol)) {
    return false;
  }

  const hostname = origin.hostname.trim().toLowerCase();
  const port = origin.port || getDefaultPort(origin.protocol);

  if (!(localhostHostnames.has(hostname) || privateIpv4Pattern.test(hostname))) {
    return false;
  }

  return isLocalDevelopmentPort(port);
};

export const getAllowedClientOrigins = () => configuredOrigins;

export const isAllowedClientOrigin = (origin?: string | null) => {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  if (configuredOrigins.includes(normalizedOrigin)) {
    return true;
  }

  return isLocalDevelopmentOrigin(new URL(normalizedOrigin));
};
