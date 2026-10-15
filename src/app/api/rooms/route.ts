import { z } from "zod";
import { makeRoom, publicRoom } from "@/lib/server/rooms";
import { createRoom, rateLimit } from "@/lib/server/store";
import { body, clientKey, handleError, response } from "@/lib/server/http";
const schema = z.object({ name: z.string().trim().min(1).max(24), color: z.enum(["w", "b"]), timeControl: z.enum(["none", "5+0", "10+0", "15+10"]) });
export async function POST(request: Request) {
  try {
    const input = schema.parse(await body(request));
    await rateLimit(`create:${clientKey(request)}`, 20, 3600);
    const { room, token } = makeRoom(input.name, input.color, input.timeControl);
    await createRoom(room);
    return response({ room: publicRoom(room, token), token }, 201);
  } catch (e) { return handleError(e); }
}