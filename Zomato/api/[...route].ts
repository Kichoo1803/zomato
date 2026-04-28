import type { IncomingMessage, ServerResponse } from "node:http";

const sendServerlessErrorResponse = (
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
  error: unknown,
) => {
  const errorMessage = error instanceof Error ? error.message : "Unknown serverless error";
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(
    JSON.stringify({
      level: "error",
      message: "Vercel serverless entrypoint failed",
      timestamp: new Date().toISOString(),
      context: {
        method: request.method,
        url: request.url,
        error: errorMessage,
        stack: errorStack,
      },
    }),
  );

  if (response.headersSent) {
    if (!response.writableEnded) {
      response.end();
    }
    return;
  }

  response.statusCode = 500;
  response.setHeader("content-type", "application/json");
  response.end(
    JSON.stringify({
      success: false,
      code: "SERVERLESS_FUNCTION_ERROR",
      message: "Serverless function failed",
    }),
  );
};

export default async function apiCatchAllHandler(
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
) {
  try {
    const { default: handler } = await import("../server/src/vercel-handler.js");
    return await handler(request, response);
  } catch (error) {
    sendServerlessErrorResponse(request, response, error);
  }
}
