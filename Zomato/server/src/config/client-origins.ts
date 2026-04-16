import { env } from "./env.js";

const localhostHostnames = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const privateIpv4Pattern = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;
const defaultDevClientOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
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

const configuredOrigins = Array.from(
  new Set(
    [env.CLIENT_URL, ...defaultDevClientOrigins]
      .map(normalizeOrigin)
      .filter((origin): origin is string => Boolean(origin)),
  ),
);

const configuredPorts = new Set(
  configuredOrigins.map((origin) => {
    const url = new URL(origin);
    return url.port || getDefaultPort(url.protocol);
  }),
);

const isLocalDevelopmentOrigin = (origin: URL) => {
  if (env.isProduction) {
    return false;
  }

  const hostname = origin.hostname.trim().toLowerCase();
  const port = origin.port || getDefaultPort(origin.protocol);

  return (
    (localhostHostnames.has(hostname) || privateIpv4Pattern.test(hostname)) &&
    configuredPorts.has(port)
  );
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
