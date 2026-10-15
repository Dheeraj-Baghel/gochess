import { Chess, type Color } from "chess.js";
import { classifyMove, cpLoss, gameSignature, pvToSan, type Analysis, type Evaluation, type MoveAnalysis } from "./analysis";
import { parseUci, positionAt, type Game } from "./chess";

export type EngineStatus = "loading" | "ready" | "thinking" | "error";
const abortError = () => new DOMException("Engine task cancelled", "AbortError");
export class StockfishEngine {
  private worker: Worker | null = null;
  private listeners = new Set<(line: string) => void>();
  private failures = new Set<(error: Error) => void>();
  private tail: Promise<unknown> = Promise.resolve();
  private ready: Promise<void>;
  private closed = false;
  constructor(private onStatus: (status: EngineStatus) => void) {
    onStatus("loading");
    this.ready = this.initialize();
    this.ready.catch(() => onStatus("error"));
  }
  private async initialize() {
    const response = await fetch("/engine/manifest.json", { cache: "no-cache", signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error("Stockfish download failed. Please check your connection.");
    const { worker } = await response.json();
    if (this.closed) throw abortError();
    this.worker = new Worker(worker);
    this.worker.onmessage = event => {
      for (const line of String(event.data).split("\n")) for (const listener of this.listeners) listener(line);
    };
    this.worker.onerror = () => {
      const error = new Error("Stockfish could not start. Use an updated browser with WebAssembly enabled.");
      this.onStatus("error");
      for (const failure of this.failures) failure(error);
    };
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error("Stockfish download timed out. Reload to retry.")), 45000);
      const finish = (error?: Error) => {
        clearTimeout(timer); this.listeners.delete(listen); this.failures.delete(finish);
        if (error) reject(error); else resolve();
      };
      const listen = (line: string) => {
        if (line === "uciok") {
          this.send("setoption name Hash value 32");
          this.send("isready");
        }
        if (line === "readyok") finish();
      };
      this.failures.add(finish); this.listeners.add(listen); this.send("uci");
    });
    this.onStatus("ready");
  }
  private send(command: string) { this.worker?.postMessage(command); }
  async evaluate(position: string, turn: Color, options: { depth: number; ms: number; skill?: number; signal?: AbortSignal }): Promise<Evaluation> {
    const task = this.tail.catch(() => {}).then(async () => {
      await this.ready;
      if (this.closed || options.signal?.aborted) throw abortError();
      this.onStatus("thinking");
      this.send(`setoption name Skill Level value ${options.skill ?? 20}`);
      this.send("setoption name MultiPV value 1");
      this.send(position);
      try {
        return await new Promise<Evaluation>((resolve, reject) => {
          let best: Evaluation = { cp: 0, mate: null, depth: 0, bestMove: "", pv: [] };
          let cancelled = false;
          const finish = (error?: Error, result?: Evaluation) => {
            clearTimeout(timer); this.listeners.delete(listen); this.failures.delete(fail);
            options.signal?.removeEventListener("abort", abort);
            if (error) reject(error); else resolve(result!);
          };
          const fail = (error: Error) => finish(error);
          const abort = () => { cancelled = true; this.send("stop"); };
          const timer = setTimeout(() => { this.send("stop"); finish(new Error("Engine search timed out. Please retry.")); }, Math.max(15000, options.ms + 10000));
          const listen = (line: string) => {
            if (line.startsWith("info depth") && !line.includes(" upperbound") && !line.includes(" lowerbound")) {
              const score = line.match(/score (cp|mate) (-?\d+)/);
              const depth = line.match(/\bdepth (\d+)/);
              const pv = line.match(/\bpv (.+)/);
              if (score && depth) {
                const sign = turn === "w" ? 1 : -1;
                const value = Number(score[2]);
                const mate = score[1] === "mate" ? value * sign : null;
                best = { cp: mate === null ? value * sign : (mate >= 0 ? 1 : -1) * (100000 - Math.min(Math.abs(mate), 500) * 100), mate, depth: Number(depth[1]), bestMove: "", pv: pv?.[1].trim().split(/\s+/) ?? [] };
              }
            }
            if (line.startsWith("bestmove ")) {
              const move = line.split(" ")[1];
              if (cancelled) finish(abortError());
              else if (!best.depth && !["(none)", "0000"].includes(move)) finish(new Error("Stockfish returned no evaluated search. Please retry."));
              else finish(undefined, { ...best, bestMove: ["(none)", "0000"].includes(move) ? "" : move });
            }
          };
          this.listeners.add(listen); this.failures.add(fail); options.signal?.addEventListener("abort", abort, { once: true });
          this.send(`go depth ${options.depth} movetime ${options.ms}`);
        });
      } finally { if (!this.closed) this.onStatus("ready"); }
    });
    this.tail = task;
    return task;
  }
  dispose() {
    this.closed = true;
    for (const failure of this.failures) failure(abortError());
    this.worker?.terminate(); this.worker = null; this.listeners.clear(); this.failures.clear();
  }
}
export function enginePosition(game: Game, ply = game.moves.length) {
  return `position fen ${game.initialFen}${ply ? ` moves ${game.moves.slice(0, ply).join(" ")}` : ""}`;
}
export async function analyzeGame(engine: StockfishEngine, game: Game, options: { depth: number; ms: number; signal: AbortSignal; progress: (moves: MoveAnalysis[], total: number) => void }): Promise<Analysis> {
  const chess = new Chess(game.initialFen);
  const moves: MoveAnalysis[] = [];
  async function evaluate(ply: number): Promise<Evaluation> {
    if (options.signal.aborted) throw abortError();
    if (chess.isCheckmate()) return { cp: chess.turn() === "w" ? -100000 : 100000, mate: chess.turn() === "w" ? -0 : 0, depth: 0, bestMove: "", pv: [] };
    if (chess.isDraw()) return { cp: 0, mate: null, depth: 0, bestMove: "", pv: [] };
    return engine.evaluate(enginePosition(game, ply), chess.turn(), options);
  }
  let before = await evaluate(0);
  for (let i = 0; i < game.moves.length; i++) {
    const uci = game.moves[i];
    const fen = chess.fen();
    const color = chess.turn();
    const line = pvToSan(fen, before.pv);
    const bestSan = pvToSan(fen, [before.bestMove])[0] ?? "—";
    const san = chess.move(parseUci(uci)).san;
    const after = await evaluate(i + 1);
    const loss = cpLoss(before, after, color);
    moves.push({ ply: i + 1, uci, san, color, before, after, loss, classification: classifyMove(loss, uci === before.bestMove), bestSan, line });
    options.progress([...moves], game.moves.length);
    before = after;
  }
  return { gameId: game.id, signature: gameSignature(game), depth: options.depth, moves, completedAt: Date.now() };
}