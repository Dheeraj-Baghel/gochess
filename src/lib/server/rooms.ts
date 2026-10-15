import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Color } from "chess.js";
import { clockValues, createGame, playMove, positionAt, settleTimeout, type Game, type TimeId } from "../chess";

export class RoomError extends Error { constructor(message: string, public status = 400) { super(message); } }
export interface Room {
  id: string; version: number; game: Game;
  whiteToken: string | null; blackToken: string | null;
  status: "waiting" | "playing" | "finished";
  drawOffer: Color | null; expiresAt: number;
}
export interface PublicRoom { id: string; version: number; game: Game; status: Room["status"]; drawOffer: Color | null; yourColor: Color | null; openColor: Color | null; serverNow: number; expiresAt: number; }
export function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function newToken() { return randomBytes(32).toString("base64url"); }
export function identify(room: Room, token: string | null): Color | null {
  if (!token || token.length > 200) return null;
  const hash = Buffer.from(tokenHash(token));
  if (room.whiteToken && timingSafeEqual(hash, Buffer.from(room.whiteToken))) return "w";
  if (room.blackToken && timingSafeEqual(hash, Buffer.from(room.blackToken))) return "b";
  return null;
}
export function publicRoom(room: Room, token: string | null, now = Date.now()): PublicRoom {
  return { id: room.id, version: room.version, game: room.game, status: room.status, drawOffer: room.drawOffer, yourColor: identify(room, token), openColor: !room.whiteToken ? "w" : !room.blackToken ? "b" : null, serverNow: now, expiresAt: room.expiresAt };
}
export function makeRoom(name: string, color: Color, timeControl: TimeId, now = Date.now()) {
  const token = newToken();
  const id = randomBytes(9).toString("base64url");
  const game = createGame({ mode: "online", timeControl, humanColor: color, whiteName: color === "w" ? name : "Waiting for a friend", blackName: color === "b" ? name : "Waiting for a friend" }, now);
  game.id = id;
  const room: Room = { id, version: 0, game, whiteToken: color === "w" ? tokenHash(token) : null, blackToken: color === "b" ? tokenHash(token) : null, status: "waiting", drawOffer: null, expiresAt: now + 7 * 86400000 };
  return { room, token };
}
export type RoomAction = { action: "join"; name: string } | { action: "move"; move: string; version: number } | { action: "resign" | "offer-draw" | "accept-draw" | "decline-draw"; version: number };
export function expireClock(room: Room, now = Date.now()): Room {
  if (room.status !== "playing") return room;
  const game = settleTimeout(room.game, now);
  return game === room.game ? room : { ...room, game, status: "finished", version: room.version + 1, drawOffer: null };
}
export function applyAction(input: Room, token: string | null, action: RoomAction, now = Date.now()): { room: Room; token?: string } {
  if (input.expiresAt <= now) throw new RoomError("This room has expired. Create a new game.", 410);
  const room = expireClock(input, now);
  const color = identify(room, token);
  if (action.action === "join") {
    if (color) return { room };
    if (room.status !== "waiting") throw new RoomError("Both seats are taken. You can still watch the game.", 409);
    const side: Color = room.whiteToken ? "b" : "w";
    const newSeatToken = newToken();
    return { room: { ...room, [side === "w" ? "whiteToken" : "blackToken"]: tokenHash(newSeatToken), status: "playing", version: room.version + 1,
      game: { ...room.game, [side === "w" ? "whiteName" : "blackName"]: action.name, updatedAt: now, clocks: { ...room.game.clocks, activeSince: room.game.timeControl === "none" ? null : now } } }, token: newSeatToken };
  }
  if (!color) throw new RoomError("Only seated players can change this game.", 403);
  if (room.version !== action.version) throw new RoomError("The position changed. Syncing the latest game.", 409);
  if (room.status !== "playing" || room.game.result) throw new RoomError("This game is not in progress.", 409);
  let game = room.game;
  let drawOffer = room.drawOffer;
  if (action.action === "move") {
    if (positionAt(game).turn() !== color) throw new RoomError("It is not your turn.", 403);
    try { game = playMove(game, action.move, now); } catch { throw new RoomError("That move is not legal.", 422); }
    if (drawOffer && drawOffer !== color) drawOffer = null;
  } else if (action.action === "resign") {
    game = { ...game, result: { winner: color === "w" ? "b" : "w", reason: "Resignation" }, updatedAt: now, clocks: { ...clockValues(game, now), activeSince: null } };
  } else if (action.action === "offer-draw") {
    if (drawOffer) throw new RoomError("A draw offer is already pending.", 409);
    drawOffer = color;
  } else if (action.action === "accept-draw") {
    if (!drawOffer || drawOffer === color) throw new RoomError("There is no opponent draw offer to accept.", 409);
    game = { ...game, result: { winner: "draw", reason: "Draw by agreement" }, updatedAt: now, clocks: { ...clockValues(game, now), activeSince: null } };
    drawOffer = null;
  } else if (action.action === "decline-draw") {
    if (!drawOffer || drawOffer === color) throw new RoomError("There is no opponent draw offer to decline.", 409);
    drawOffer = null;
  }
  return { room: { ...room, game, drawOffer: game.result ? null : drawOffer, version: room.version + 1, status: game.result ? "finished" : "playing" } };
}