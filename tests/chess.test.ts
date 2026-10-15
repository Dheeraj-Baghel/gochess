import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { canMate, clockValues, createGame, formatClock, fromPgn, outcome, parseUci, playMove, positionAt, settleTimeout, takeBack, toPgn } from "../src/lib/chess";

describe("legal chess, not a board mockup", () => {
  it("starts with exactly 20 legal moves and 32 pieces", () => {
    const game = createGame(); const chess = positionAt(game);
    expect(chess.moves()).toHaveLength(20); expect(chess.board().flat().filter(Boolean)).toHaveLength(32);
  });
  it("rejects impossible moves and moving the wrong color", () => {
    const game = createGame();
    expect(() => playMove(game, "e2e5")).toThrow(); expect(() => playMove(game, "e7e5")).toThrow();
    expect(game.moves).toHaveLength(0);
  });
  it("supports kingside and queenside castling", () => {
    const game = createGame({ initialFen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1" });
    const next = playMove(playMove(game, "e1g1"), "e8c8");
    expect(positionAt(next).get("f1")?.type).toBe("r"); expect(positionAt(next).get("d8")?.type).toBe("r");
  });
  it("forbids castling through check", () => {
    const game = createGame({ initialFen: "4kr2/8/8/8/8/8/8/4K2R w K - 0 1" });
    expect(() => playMove(game, "e1g1")).toThrow();
  });
  it("handles en passant and expires it after one move", () => {
    let game = createGame(); for (const m of ["e2e4", "a7a6", "e4e5", "d7d5", "e5d6"]) game = playMove(game, m);
    expect(positionAt(game).get("d5")).toBeUndefined(); expect(positionAt(game).get("d6")?.type).toBe("p");
  });
  it.each(["q", "r", "b", "n"])("supports promotion to %s", p => {
    const next = playMove(createGame({ initialFen: "8/P6k/8/8/8/8/8/7K w - - 0 1" }), `a7a8${p}`);
    expect(positionAt(next).get("a8")?.type).toBe(p);
  });
  it("does not silently queen a missing promotion choice", () => {
    expect(() => playMove(createGame({ initialFen: "8/P6k/8/8/8/8/8/7K w - - 0 1" }), "a7a8")).toThrow();
  });
  it("detects checkmate and locks the final position", () => {
    let game = createGame(); for (const m of ["f2f3", "e7e5", "g2g4", "d8h4"]) game = playMove(game, m);
    expect(game.result).toEqual({ winner: "b", reason: "Checkmate" });
    expect(() => playMove(game, "a2a3")).toThrow();
  });
  it("detects stalemate and insufficient material", () => {
    expect(outcome(new Chess("7k/5Q2/7K/8/8/8/8/8 b - - 0 1"))?.reason).toBe("Stalemate");
    expect(outcome(new Chess("7k/8/7K/8/8/8/8/8 w - - 0 1"))?.reason).toBe("Insufficient material");
  });
  it("preserves move history for threefold repetition", () => {
    let game = createGame(); for (const m of ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"]) game = playMove(game, m);
    expect(game.result?.reason).toBe("Threefold repetition");
  });
  it("enforces the fifty-move rule", () => {
    const next = playMove(createGame({ initialFen: "7k/8/8/8/8/8/8/R3K3 w Q - 99 51" }), "a1a2");
    expect(next.result?.reason).toBe("Fifty-move rule");
  });
  it("tracks clocks and increment using timestamps", () => {
    let game = createGame({ timeControl: "15+10" }, 1000);
    game = playMove(game, "e2e4", 2000); expect(game.clocks.w).toBe(910000);
    expect(clockValues(game, 5000).b).toBe(897000);
    game = playMove(game, "e7e5", 5000); expect(game.clocks.b).toBe(907000);
    expect(clockValues(game, 8000).w).toBe(907000);
  });
  it("restores clock snapshots on takeback without banking increments", () => {
    let game = createGame({ mode: "local", timeControl: "15+10" }, 1000);
    game = playMove(playMove(game, "e2e4", 2000), "e7e5", 5000);
    const undone = takeBack(game, 2, 10000);
    expect(undone.moves).toHaveLength(0); expect(undone.clockHistory).toHaveLength(0);
    expect(undone.clocks).toEqual({ w: 900000, b: 900000, activeSince: null });
    expect(takeBack({ ...game, mode: "online" }, 2)).toEqual({ ...game, mode: "online" });
  });
  it("settles timeout, and a bare king cannot win on time", () => {
    let game = createGame({ timeControl: "5+0" }, 0); game = playMove(game, "e2e4", 1);
    expect(settleTimeout(game, 300002).result).toEqual({ winner: "w", reason: "Time out" });
    const position = new Chess("7k/8/8/8/8/8/8/R3K3 w - - 0 1"); expect(canMate(position, "b")).toBe(false);
  });
  it("round-trips PGN, including a custom starting FEN and result", () => {
    const game = fromPgn('[White "Ada"]\n[Black "Turing"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1');
    expect(game.moves).toEqual(["f2f3", "e7e5", "g2g4", "d8h4"]);
    const restored = fromPgn(toPgn(game)); expect(restored.moves).toEqual(game.moves); expect(restored.result?.winner).toBe("b");
    const custom = playMove(createGame({ initialFen: "8/P6k/8/8/8/8/8/7K w - - 0 1" }), "a7a8q");
    expect(fromPgn(toPgn(custom)).initialFen).toBe(custom.initialFen);
  });
  it("validates PGN and UCI inputs", () => {
    expect(() => fromPgn("not a game" )).toThrow(); expect(() => parseUci("e2e9")).toThrow(); expect(() => fromPgn("x".repeat(200001))).toThrow();
  });
  it("formats clocks without negative displays", () => { expect(formatClock(299999)).toBe("5:00"); expect(formatClock(-1)).toBe("0:00"); });
});