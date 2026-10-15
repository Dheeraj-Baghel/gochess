import { z } from "zod";
import { applyAction, expireClock, publicRoom, RoomError } from "@/lib/server/rooms";
import { compareAndSwap, getRoom, rateLimit } from "@/lib/server/store";
import { authToken, body, clientKey, handleError, response } from "@/lib/server/http";
export const dynamic = "force-dynamic";
const move = z.object({ action: z.literal("move"), move: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/), version: z.number().int().min(0) });
const actionSchema = z.union([move, z.object({ action: z.literal("join"), name: z.string().trim().min(1).max(24) }), z.object({ action: z.enum(["resign", "offer-draw", "accept-draw", "decline-draw"]), version: z.number().int().min(0) })]);
type Context = { params: Promise<{ id: string }> };
function validateId(id: string) { if (!/^[\w-]{12}$/.test(id)) throw new RoomError("Room not found.", 404); }
export async function GET(request: Request, ctx: Context) {
  try {
    const { id } = await ctx.params; validateId(id);
    let room = await getRoom(id);
    const settled = expireClock(room);
    if (settled !== room) room = await compareAndSwap(settled, room.version) ? settled : await getRoom(id);
    return response({ room: publicRoom(room, authToken(request)) });
  } catch (e) { return handleError(e); }
}
export async function POST(request: Request, ctx: Context) {
  try {
    const { id } = await ctx.params; validateId(id);
    const input = actionSchema.parse(await body(request));
    await rateLimit(`action:${clientKey(request)}`, 180, 60);
    const room = await getRoom(id);
    const settled = expireClock(room);
    if (settled !== room) {
      await compareAndSwap(settled, room.version);
      throw new RoomError("The game ended on time. Refreshing the result.", 409);
    }
    const result = applyAction(room, authToken(request), input);
    if (result.room.version !== room.version && !await compareAndSwap(result.room, room.version)) throw new RoomError("The position changed. Please retry your move.", 409);
    return response({ room: publicRoom(result.room, result.token ?? authToken(request)), ...(result.token ? { token: result.token } : {}) });
  } catch (e) { return handleError(e); }
}