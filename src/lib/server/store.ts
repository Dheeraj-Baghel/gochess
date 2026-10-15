import { neon } from "@neondatabase/serverless";
import { RoomError, type Room } from "./rooms";

const globalStore = globalThis as typeof globalThis & { knightfallRooms?: Map<string, Room>; knightfallLimits?: Map<string, { hits: number; expires: number }> };
const memory = globalStore.knightfallRooms ??= new Map();
const limits = globalStore.knightfallLimits ??= new Map();
function sql() {
  if (process.env.DATABASE_URL) return neon(process.env.DATABASE_URL);
  if (process.env.NODE_ENV === "production") throw new RoomError("Online play is temporarily unavailable. Computer and local games still work.", 503);
  return null;
}
export async function createRoom(room: Room) {
  const db = sql();
  if (!db) { memory.set(room.id, structuredClone(room)); return; }
  await db`INSERT INTO knightfall_rooms (id, version, data, expires_at) VALUES (${room.id}, ${room.version}, ${JSON.stringify(room)}::jsonb, to_timestamp(${room.expiresAt / 1000}))`;
  if (Math.random() < 0.05) await db`DELETE FROM knightfall_rooms WHERE expires_at < now()`;
}
export async function getRoom(id: string): Promise<Room> {
  const db = sql();
  const room: Room | undefined = db ? (await db`SELECT data FROM knightfall_rooms WHERE id = ${id} AND expires_at > now()`)[0]?.data : memory.get(id);
  if (!room || room.expiresAt <= Date.now()) throw new RoomError("Room not found or expired. Ask your friend for a new link.", 404);
  return structuredClone(room);
}
export async function compareAndSwap(room: Room, expectedVersion: number): Promise<boolean> {
  const db = sql();
  if (!db) {
    if (memory.get(room.id)?.version !== expectedVersion) return false;
    memory.set(room.id, structuredClone(room)); return true;
  }
  const result = await db`UPDATE knightfall_rooms SET data = ${JSON.stringify(room)}::jsonb, version = ${room.version} WHERE id = ${room.id} AND version = ${expectedVersion} RETURNING id`;
  return result.length === 1;
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const db = sql();
  const window = Math.floor(Date.now() / (seconds * 1000));
  const id = `${key}:${window}`;
  let hits: number;
  if (!db) {
    const record = limits.get(id) ?? { hits: 0, expires: Date.now() + seconds * 1000 };
    hits = ++record.hits; limits.set(id, record);
    for (const [k, v] of limits) if (v.expires < Date.now()) limits.delete(k);
  } else {
    const result = await db`INSERT INTO knightfall_limits (id, hits, expires_at) VALUES (${id}, 1, now() + (${seconds} * interval '1 second')) ON CONFLICT (id) DO UPDATE SET hits = knightfall_limits.hits + 1 RETURNING hits`;
    hits = result[0].hits;
    if (Math.random() < 0.01) await db`DELETE FROM knightfall_limits WHERE expires_at < now()`;
  }
  if (hits > limit) throw new RoomError("A few too many requests. Please wait a moment and try again.", 429);
}
export async function health() {
  const db = sql();
  if (!db) return { storage: "development-memory", durable: false };
  await db`SELECT id FROM knightfall_rooms LIMIT 1`;
  return { storage: "postgresql", durable: true };
}