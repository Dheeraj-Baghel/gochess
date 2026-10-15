import { createHash } from "node:crypto";
import { ZodError } from "zod";
import { RoomError } from "./rooms";
export function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}
export function handleError(error: unknown) {
  if (error instanceof RoomError) return response({ error: error.message }, error.status);
  if (error instanceof ZodError || error instanceof SyntaxError) return response({ error: "Please check your request and try again." }, 400);
  console.error("Room request failed:", error instanceof Error ? error.name : "UnknownError");
  return response({ error: "The game server is temporarily unavailable. Please try again." }, 503);
}
export function authToken(request: Request) { return request.headers.get("authorization")?.replace(/^Bearer /, "") ?? null; }
export function clientKey(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return createHash("sha256").update(`knightfall:${ip}`).digest("hex").slice(0, 32);
}
export async function body(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new RoomError("Cross-site requests are not allowed.", 403);
  if (!request.headers.get("content-type")?.includes("application/json")) throw new RoomError("Expected JSON.", 415);
  if (Number(request.headers.get("content-length")) > 2048) throw new RoomError("Request too large.", 413);
  const raw = await request.text();
  if (raw.length > 2048) throw new RoomError("Request too large.", 413);
  return JSON.parse(raw);
}