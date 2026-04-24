import type { IncomingMessage, ServerResponse } from "node:http";
import handler from "../server/src/vercel-handler.js";

export default async function apiCatchAllHandler(
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
) {
  return handler(request, response);
}
