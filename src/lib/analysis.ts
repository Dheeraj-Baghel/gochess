import type { Color } from "chess.js";
import { Chess } from "chess.js";
import { parseUci, type Game } from "./chess";

export type Classification = "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";
export interface Evaluation {
  cp: number; // Always from White's perspective, including positions where Black moves.
  mate: number | null; // Signed for White. Negative = Black is mating.
  depth: number;
  bestMove: string;
  pv: string[];
}
export interface MoveAnalysis {
  ply: number; san: string; uci: string; color: Color;
  before: Evaluation; after: Evaluation;
  loss: number; classification: Classification; bestSan: string; line: string[];
}
export interface Analysis { gameId: string; signature: string; depth: number; moves: MoveAnalysis[]; completedAt: number; }
export const CLASSIFICATIONS: Record<Classification, { label: string; color: string; glyph: string }> = {
  best: { label: "Best", color: "#638847", glyph: "★" },
  excellent: { label: "Excellent", color: "#77955d", glyph: "!" },
  good: { label: "Good", color: "#6e9681", glyph: "✓" },
  inaccuracy: { label: "Inaccuracy", color: "#cc9a32", glyph: "?!" },
  mistake: { label: "Mistake", color: "#db823f", glyph: "?" },
  blunder: { label: "Blunder", color: "#cd6060", glyph: "??" }
};
export function classifyMove(loss: number, isBest: boolean): Classification {
  if (isBest) return "best";
  if (loss >= 200) return "blunder";
  if (loss >= 100) return "mistake";
  if (loss >= 50) return "inaccuracy";
  if (loss >= 20) return "good";
  return "excellent";
}
export function cpLoss(before: Evaluation, after: Evaluation, color: Color): number {
  return Math.max(0, Math.round((before.cp - after.cp) * (color === "w" ? 1 : -1)));
}
export function evalLabel(e: Pick<Evaluation, "cp" | "mate">) {
  if (e.mate !== null) return `M${Math.abs(e.mate)}`;
  return `${e.cp >= 0 ? "+" : ""}${(e.cp / 100).toFixed(2)}`;
}
export function pvToSan(fen: string, pv: string[], limit = 8): string[] {
  const chess = new Chess(fen);
  const result: string[] = [];
  for (const uci of pv.slice(0, limit)) {
    try { result.push(chess.move(parseUci(uci)).san); } catch { break; }
  }
  return result;
}
export function accuracy(moves: MoveAnalysis[], color: Color): number | null {
  const own = moves.filter(m => m.color === color);
  if (!own.length) return null;
  // Explicitly a Gochess heuristic, not Chess.com's proprietary accuracy formula.
  const avg = own.reduce((sum, m) => sum + Math.min(m.loss, 1000), 0) / own.length;
  return Math.round(100 * Math.exp(-avg / 180));
}
export function gameSignature(game: Game) { return `${game.initialFen}|${game.moves.join(" ")}`; }