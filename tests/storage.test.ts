import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame, playMove } from "../src/lib/chess";
import { deleteGame, loadCurrent, loadHistory, saveCurrent, saveGame } from "../src/lib/storage";

describe("safe guest game persistence", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("saves one up-to-date history entry per game", () => {
    let game = playMove(createGame(), "e2e4"); saveGame(game);
    game = playMove(game, "e7e5"); saveGame(game);
    expect(loadHistory()).toHaveLength(1); expect(loadHistory()[0].moves).toHaveLength(2);
    saveCurrent(game); expect(loadCurrent()?.id).toBe(game.id);
    deleteGame(game.id); expect(loadHistory()).toHaveLength(0);
  });
  it("recovers from corrupt and incompatible stored games", () => {
    localStorage.setItem("knightfall.current.v1", "{broken"); expect(loadCurrent()).toBe(null);
    localStorage.setItem("knightfall.current.v1", JSON.stringify({ ...createGame(), level: "invalid" })); expect(loadCurrent()).toBe(null);
    localStorage.setItem("knightfall.current.v1", JSON.stringify({ ...createGame(), clocks: { w: -10, b: 0, activeSince: null } })); expect(loadCurrent()).toBe(null);
  });
  it("does not crash if storage is unavailable", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("disabled"); }, setItem: () => { throw new Error("quota"); } });
    expect(loadHistory()).toEqual([]); expect(loadCurrent()).toBe(null); expect(saveGame(playMove(createGame(), "e2e4"))).toBe(false);
  });
});