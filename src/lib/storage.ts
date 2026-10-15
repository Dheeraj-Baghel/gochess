import type { Analysis } from "./analysis";
import { LEVELS, TIMES, positionAt, type Game } from "./chess";

const HISTORY_KEY = "knightfall.games.v1";
const CURRENT_KEY = "knightfall.current.v1";
let cachedRaw: string | null | undefined;
let cachedHistory: Game[] = [];
function read(key: string, fallback: unknown) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}
export function safeWrite(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
function validGame(value: unknown): value is Game {
  try {
    const g = value as Game;
    if (!g || typeof g.id !== "string" || !Array.isArray(g.moves) || g.moves.length > 1000 || !g.clocks || !["computer", "local", "online"].includes(g.mode)) return false;
    if (!LEVELS.some(l => l.id === g.level) || !TIMES.some(t => t.id === g.timeControl) || !["w", "b"].includes(g.humanColor)) return false;
    if (typeof g.whiteName !== "string" || typeof g.blackName !== "string" || !Number.isFinite(g.createdAt) || !Number.isFinite(g.updatedAt)) return false;
    if (![g.clocks.w, g.clocks.b].every(n => Number.isFinite(n) && n >= 0) || (g.clocks.activeSince !== null && !Number.isFinite(g.clocks.activeSince))) return false;
    if (g.result && (!["w", "b", "draw"].includes(g.result.winner) || typeof g.result.reason !== "string")) return false;
    positionAt(g); return true;
  } catch { return false; }
}
export function loadHistory(): Game[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw === cachedRaw) return cachedHistory;
    const data = JSON.parse(raw || "[]");
    cachedHistory = Array.isArray(data) ? data.filter(validGame).slice(0, 100) : [];
    cachedRaw = raw; return cachedHistory;
  } catch { return []; }
}
function writeHistory(games: Game[]) {
  try {
    const raw = JSON.stringify(games); localStorage.setItem(HISTORY_KEY, raw);
    cachedRaw = raw; cachedHistory = games; return true;
  } catch { return false; }
}
export function saveGame(game: Game) {
  if (!game.moves.length && !game.result) return true;
  const history = loadHistory().filter(g => g.id !== game.id);
  const saved = writeHistory([game, ...history].slice(0, 100));
  if (saved) for (const old of history.slice(99)) { try { localStorage.removeItem(`knightfall.analysis.${old.id}`); } catch { /* Best-effort quota cleanup. */ } }
  return saved;
}
export function deleteGame(id: string) {
  writeHistory(loadHistory().filter(g => g.id !== id));
  try { localStorage.removeItem(`knightfall.analysis.${id}`); } catch { /* Storage can be disabled. */ }
}
export function saveCurrent(game: Game) { return safeWrite(CURRENT_KEY, game); }
export function loadCurrent(): Game | null {
  const game = read(CURRENT_KEY, null);
  return validGame(game) && game.mode !== "online" ? game : null;
}
export function saveAnalysis(analysis: Analysis) { return safeWrite(`knightfall.analysis.${analysis.gameId}`, analysis); }
export function loadAnalysis(id: string): Analysis | null {
  const result = read(`knightfall.analysis.${id}`, null) as Analysis | null;
  return result && Array.isArray(result.moves) ? result : null;
}