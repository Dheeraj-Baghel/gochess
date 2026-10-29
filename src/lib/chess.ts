import { Chess, DEFAULT_POSITION, type Color, type Square } from "chess.js";

export type Mode = "computer" | "local" | "online";
export type Result = { winner: Color | "draw"; reason: string };
export const LEVELS = [
  { id: "casual", name: "Casual", subtitle: "Find your footing", skill: 0, depth: 3, ms: 120, icon: "leaf" },
  { id: "club", name: "Club player", subtitle: "A worthy challenge", skill: 5, depth: 8, ms: 450, icon: "shield" },
  { id: "expert", name: "Expert", subtitle: "Every move matters", skill: 12, depth: 13, ms: 1000, icon: "flame" },
  { id: "master", name: "Master", subtitle: "Bring your best", skill: 20, depth: 19, ms: 2200, icon: "crown" }
] as const;
export type LevelId = typeof LEVELS[number]["id"];
export const TIMES = [
  { id: "none", label: "No clock", minutes: 0, increment: 0 },
  { id: "5+0", label: "5 min", minutes: 5, increment: 0 },
  { id: "10+0", label: "10 min", minutes: 10, increment: 0 },
  { id: "15+10", label: "15 | 10", minutes: 15, increment: 10 }
] as const;
export type TimeId = typeof TIMES[number]["id"];

export interface Game {
  id: string;
  mode: Mode;
  initialFen: string;
  moves: string[];
  humanColor: Color;
  level: LevelId;
  timeControl: TimeId;
  whiteName: string;
  blackName: string;
  createdAt: number;
  updatedAt: number;
  clocks: { w: number; b: number; activeSince: number | null };
  clockHistory?: { w: number; b: number }[];
  result: Result | null;
}

export function createGame(options: Partial<Pick<Game, "mode" | "humanColor" | "level" | "timeControl" | "whiteName" | "blackName" | "initialFen">> = {}, now = Date.now()): Game {
  const mode = options.mode ?? "computer";
  const humanColor = options.humanColor ?? "w";
  const level = options.level ?? "club";
  const timeControl = options.timeControl ?? "none";
  const time = TIMES.find(t => t.id === timeControl)!;
  const engineName = `Stockfish · ${LEVELS.find(l => l.id === level)!.name}`;
  return {
    id: crypto.randomUUID(), mode, initialFen: options.initialFen ?? DEFAULT_POSITION, moves: [],
    humanColor, level, timeControl,
    whiteName: options.whiteName ?? (mode === "computer" && humanColor === "b" ? engineName : mode === "local" ? "White" : "You"),
    blackName: options.blackName ?? (mode === "computer" && humanColor === "w" ? engineName : mode === "local" ? "Black" : "You"),
    createdAt: now, updatedAt: now,
    clocks: { w: time.minutes * 60_000, b: time.minutes * 60_000, activeSince: null }, clockHistory: [], result: null
  };
}

export function positionAt(game: Pick<Game, "initialFen" | "moves">, ply = game.moves.length): Chess {
  const chess = new Chess(game.initialFen);
  for (const move of game.moves.slice(0, ply)) chess.move(parseUci(move));
  return chess;
}

export function parseUci(uci: string) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error("Invalid move format");
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci[4] };
}

export function outcome(chess: Chess): Result | null {
  if (chess.isCheckmate()) return { winner: chess.turn() === "w" ? "b" : "w", reason: "Checkmate" };
  if (chess.isStalemate()) return { winner: "draw", reason: "Stalemate" };
  if (chess.isInsufficientMaterial()) return { winner: "draw", reason: "Insufficient material" };
  if (chess.isThreefoldRepetition()) return { winner: "draw", reason: "Threefold repetition" };
  if (chess.isDrawByFiftyMoves()) return { winner: "draw", reason: "Fifty-move rule" };
  return null;
}

export function clockValues(game: Game, now = Date.now()): { w: number; b: number } {
  const values = { w: game.clocks.w, b: game.clocks.b };
  if (game.timeControl !== "none" && !game.result && game.clocks.activeSince !== null) {
    const turn = game.moves.length % 2 === 0 ? new Chess(game.initialFen).turn() : new Chess(game.initialFen).turn() === "w" ? "b" : "w";
    values[turn] = Math.max(0, values[turn] - Math.max(0, now - game.clocks.activeSince));
  }
  return values;
}

// Flagging is a draw if the opponent has no possible mating material.
// K+minor can mate with opposing material, but not a bare king.
export function canMate(chess: Chess, color: Color): boolean {
  const pieces = chess.board().flat().filter(p => p && p.type !== "k");
  const own = pieces.filter(p => p!.color === color);
  if (!own.length) return false;
  if (own.some(p => ["p", "r", "q"].includes(p!.type))) return true;
  if (own.length === 1) return pieces.length > own.length;
  if (own.some(p => p!.type === "n")) return true;
  const colors = new Set(own.map(p => (p!.square.charCodeAt(0) + Number(p!.square[1])) % 2));
  return colors.size > 1 || pieces.length > own.length;
}

export function settleTimeout(game: Game, now = Date.now()): Game {
  if (game.result || game.timeControl === "none" || game.clocks.activeSince === null) return game;
  const chess = positionAt(game);
  const values = clockValues(game, now);
  if (values[chess.turn()] > 0) return game;
  const other = chess.turn() === "w" ? "b" : "w";
  return { ...game, clocks: { ...values, activeSince: null }, updatedAt: now,
    result: canMate(chess, other) ? { winner: other, reason: "Time out" } : { winner: "draw", reason: "Time out · insufficient mating material" } };
}

export function playMove(game: Game, uci: string, now = Date.now()): Game {
  const settled = settleTimeout(game, now);
  if (settled.result) throw new Error("This game is already over");
  const chess = positionAt(game);
  const turn = chess.turn();
  const clock = clockValues(game, now);
  chess.move(parseUci(uci)); // chess.js throws on illegal or ambiguous promotion moves.
  const result = outcome(chess);
  const time = TIMES.find(t => t.id === game.timeControl)!;
  if (time.minutes) clock[turn] += time.increment * 1000;
  return { ...game, moves: [...game.moves, uci], result, updatedAt: now,
    clockHistory: [...(game.clockHistory ?? []), { w: game.clocks.w, b: game.clocks.b }],
    clocks: { ...clock, activeSince: time.minutes && !result ? now : null } };
}

export function takeBack(game: Game, count: number, now = Date.now()): Game {
  if (game.mode === "online" || game.result || !game.moves.length) return game;
  const ply = Math.max(0, game.moves.length - Math.max(1, count));
  const snapshot = game.clockHistory?.[ply] ?? game.clocks;
  return { ...game, moves: game.moves.slice(0, ply), clockHistory: game.clockHistory?.slice(0, ply), updatedAt: now,
    clocks: { w: snapshot.w, b: snapshot.b, activeSince: game.timeControl !== "none" && ply > 0 ? now : null } };
}

export function resultLabel(result: Result | null) {
  return !result ? "In progress" : result.winner === "draw" ? "Draw" : `${result.winner === "w" ? "White" : "Black"} wins`;
}
export function resultCode(result: Result | null) {
  return !result ? "*" : result.winner === "draw" ? "1/2-1/2" : result.winner === "w" ? "1-0" : "0-1";
}
export function toPgn(game: Game): string {
  const chess = positionAt(game);
  chess.header("Event", "Gochess casual game", "Site", "Gochess", "Date", new Date(game.createdAt).toISOString().slice(0, 10).replaceAll("-", "."), "White", game.whiteName, "Black", game.blackName, "Result", resultCode(game.result));
  if (game.result) chess.header("Termination", game.result.reason);
  const pgn = chess.pgn();
  return pgn;
}
export function fromPgn(pgn: string): Game {
  if (pgn.length > 200_000) throw new Error("PGN is too large (maximum 200 KB)");
  const chess = new Chess();
  chess.loadPgn(pgn);
  const history = chess.history({ verbose: true });
  if (!history.length) throw new Error("This PGN contains no moves");
  if (history.length > 600) throw new Error("Please import a game with at most 600 half-moves");
  const headers = chess.getHeaders();
  const game = createGame({ mode: "local", initialFen: headers.FEN ?? DEFAULT_POSITION, whiteName: headers.White || "White", blackName: headers.Black || "Black" });
  game.moves = history.map(m => m.from + m.to + (m.promotion ?? ""));
  game.result = outcome(chess) ?? (headers.Result === "1-0" ? { winner: "w", reason: "Imported game" } : headers.Result === "0-1" ? { winner: "b", reason: "Imported game" } : headers.Result === "1/2-1/2" ? { winner: "draw", reason: "Imported game" } : null);
  return game;
}
export function formatClock(ms: number) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}