import { describe, expect, it } from "vitest";
import { applyAction, expireClock, identify, makeRoom, newToken, publicRoom, type Room } from "../src/lib/server/rooms";

const now = Date.now();
function setup() {
  const { room, token: white } = makeRoom("Ada", "w", "none", now);
  const joined = applyAction(room, null, { action: "join", name: "Turing" }, now + 1);
  return { room: joined.room, white, black: joined.token! };
}
describe("authoritative online rooms", () => {
  it("protects seats with hashed 256-bit capability tokens", () => {
    const { room, token } = makeRoom("Ada", "w", "none", now);
    expect(room.whiteToken).not.toBe(token); expect(identify(room, token)).toBe("w"); expect(identify(room, newToken())).toBe(null);
    const publicData = JSON.stringify(publicRoom(room, null)); expect(publicData).not.toContain(room.whiteToken!); expect(publicData).not.toContain(token);
  });
  it("lets the creator choose Black, filling the other seat", () => {
    const { room, token } = makeRoom("Ada", "b", "none", now);
    const joined = applyAction(room, null, { action: "join", name: "Turing" }, now + 1);
    expect(identify(joined.room, token)).toBe("b"); expect(identify(joined.room, joined.token!)).toBe("w");
  });
  it("starts the clock only when the second player joins", () => {
    const { room } = makeRoom("Ada", "w", "5+0", now); expect(room.game.clocks.activeSince).toBe(null);
    const next = applyAction(room, null, { action: "join", name: "Turing" }, now + 10000).room;
    expect(next.game.clocks.activeSince).toBe(now + 10000);
  });
  it("does not let a third visitor claim a seat", () => {
    const { room } = setup(); expect(() => applyAction(room, null, { action: "join", name: "Intruder" }, now + 2)).toThrow("Both seats");
  });
  it("makes joining idempotent for an existing seat", () => {
    const { room, white } = setup(); expect(applyAction(room, white, { action: "join", name: "Ada" }, now + 2).room.version).toBe(room.version);
  });
  it("validates authorization, turn, legal moves, and version", () => {
    const { room, white, black } = setup();
    expect(() => applyAction(room, null, { action: "move", move: "e2e4", version: 1 }, now + 2)).toThrow("Only seated");
    expect(() => applyAction(room, black, { action: "move", move: "e7e5", version: 1 }, now + 2)).toThrow("not your turn");
    expect(() => applyAction(room, white, { action: "move", move: "e2e5", version: 1 }, now + 2)).toThrow("not legal");
    expect(() => applyAction(room, white, { action: "move", move: "e2e4", version: 0 }, now + 2)).toThrow("position changed");
    const next = applyAction(room, white, { action: "move", move: "e2e4", version: 1 }, now + 2).room;
    expect(next.game.moves).toEqual(["e2e4"]); expect(next.version).toBe(2);
  });
  it("requires both sides to agree to a draw", () => {
    const { room, white, black } = setup();
    const offered = applyAction(room, white, { action: "offer-draw", version: 1 }, now + 2).room;
    expect(() => applyAction(offered, white, { action: "accept-draw", version: 2 }, now + 3)).toThrow("no opponent");
    const accepted = applyAction(offered, black, { action: "accept-draw", version: 2 }, now + 3).room;
    expect(accepted.game.result?.winner).toBe("draw"); expect(accepted.status).toBe("finished");
  });
  it("declines an opponent offer by making a move", () => {
    const { room, white, black } = setup(); const offered = applyAction(room, black, { action: "offer-draw", version: 1 }, now + 2).room;
    expect(applyAction(offered, white, { action: "move", move: "e2e4", version: 2 }, now + 3).room.drawOffer).toBe(null);
  });
  it("resignation freezes a game and its clocks", () => {
    const { room, white, black } = setup(); const done = applyAction(room, black, { action: "resign", version: 1 }, now + 2).room;
    expect(done.game.result?.winner).toBe("w"); expect(done.game.clocks.activeSince).toBe(null);
    expect(() => applyAction(done, white, { action: "move", move: "e2e4", version: 2 }, now + 3)).toThrow("not in progress");
  });
  it("resolves server timeouts and rejects expired rooms", () => {
    const initial = makeRoom("Ada", "w", "5+0", now).room;
    const room = applyAction(initial, null, { action: "join", name: "Turing" }, now + 1).room;
    const timeout = expireClock(room, now + 300002);
    expect(timeout.game.result?.winner).toBe("b"); expect(timeout.version).toBe(2);
    expect(() => applyAction(room, null, { action: "join", name: "Ada" }, now + 8 * 86400000)).toThrow("expired");
  });
});