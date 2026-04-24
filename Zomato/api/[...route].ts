import type { IncomingMessage, ServerResponse } from "node:http";
import handler from "../server/src/vercel-handler.js";

export default async function apiCatchAllHandler(
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
) {
  console.log("API FUNCTION HIT:", request.method, request.url);
  return handler(request, response);
}
