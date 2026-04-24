import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { connectPrisma } from "./lib/prisma.js";

let prismaReadyPromise: Promise<void> | null = null;
const INTERNAL_ROUTE_QUERY_KEY = "__vercel_route";

const ensurePrismaConnected = () => {
  if (!prismaReadyPromise) {
    prismaReadyPromise = connectPrisma({ maxAttempts: 1 }).catch((error) => {
      prismaReadyPromise = null;
      throw error;
    });
  }

  return prismaReadyPromise;
};

const hasKnownApiPrefix = (requestUrl: string) =>
  requestUrl === "/api" ||
  requestUrl.startsWith("/api/") ||
  requestUrl.startsWith("/api?") ||
  requestUrl === "/api/v1" ||
  requestUrl.startsWith("/api/v1/") ||
  requestUrl.startsWith("/api/v1?");

const restoreRewrittenApiUrl = (requestUrl?: string) => {
  const nextUrl = requestUrl?.trim() || "/";
  const parsedUrl = new URL(nextUrl, "http://127.0.0.1");
  const rewrittenRoute = parsedUrl.searchParams.get(INTERNAL_ROUTE_QUERY_KEY)?.trim();

  if (parsedUrl.pathname === "/api/index") {
    parsedUrl.pathname = "/api";
  } else if (parsedUrl.pathname === "/api/[...route]" && rewrittenRoute) {
    parsedUrl.pathname = `/api/${rewrittenRoute.replace(/^\/+|\/+$/g, "")}`;
  }

  parsedUrl.searchParams.delete(INTERNAL_ROUTE_QUERY_KEY);

  const normalizedSearch = parsedUrl.searchParams.toString();
  return `${parsedUrl.pathname}${normalizedSearch ? `?${normalizedSearch}` : ""}`;
};

const normalizeApiRequestUrl = (requestUrl?: string) => {
  const nextUrl = restoreRewrittenApiUrl(requestUrl);

  if (hasKnownApiPrefix(nextUrl)) {
    return nextUrl;
  }

  if (nextUrl === "/") {
    return "/api";
  }

  if (nextUrl.startsWith("/?")) {
    return `/api${nextUrl.slice(1)}`;
  }

  if (nextUrl.startsWith("?")) {
    return `/api${nextUrl}`;
  }

  return `/api${nextUrl.startsWith("/") ? nextUrl : `/${nextUrl}`}`;
};

export default async function handler(request: IncomingMessage, response: ServerResponse<IncomingMessage>) {
  try {
    await ensurePrismaConnected();
    request.url = normalizeApiRequestUrl(request.url);
    app(request as Parameters<typeof app>[0], response as Parameters<typeof app>[1]);
  } catch (error) {
    logger.error("Failed to initialize Vercel API handler", {
      error: error instanceof Error ? error.message : "Unknown initialization error",
      path: request.url,
    });

    if (response.headersSent) {
      response.end();
      return;
    }

    response.statusCode = 500;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        success: false,
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong on the server",
      }),
    );
  }
}
