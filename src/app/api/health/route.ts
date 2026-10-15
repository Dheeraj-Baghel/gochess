import { health } from "@/lib/server/store";
import { handleError, response } from "@/lib/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return response({ status: "ok", ...(await health()), engine: "Stockfish 18 lite single-thread WASM" }); }
  catch (e) { return handleError(e); }
}