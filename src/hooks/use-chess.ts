"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Color, Square } from "chess.js";
import { analyzeGame, enginePosition, StockfishEngine, type EngineStatus } from "@/lib/engine";
import { clockValues, createGame, LEVELS, playMove, positionAt, settleTimeout, takeBack, type Game, type LevelId, type Mode, type TimeId } from "@/lib/chess";
import { gameSignature, type Analysis, type MoveAnalysis } from "@/lib/analysis";
import { loadAnalysis, loadCurrent, loadHistory, safeWrite, saveAnalysis, saveCurrent, saveGame } from "@/lib/storage";
import type { PublicRoom } from "@/lib/server/rooms";

export interface Settings { sound: boolean; coordinates: boolean; theme: "sage" | "walnut" | "slate"; }
export interface NewGameOptions { mode: Mode; level: LevelId; color: Color | "random"; time: TimeId; name: string; }
type View = "play" | "review" | "history";
function seatToken(id: string) { try { return localStorage.getItem(`knightfall.seat.${id}`); } catch { return null; } }

export function useChess() {
  const [game, setGame] = useState<Game | null>(null);
  const [view, setView] = useState<View>("play");
  const [history, setHistory] = useState<Game[]>([]);
  const [orientation, setOrientation] = useState<Color>("w");
  const [settings, setSettings] = useState<Settings>({ sound: true, coordinates: true, theme: "sage" });
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("loading");
  const [engineReady, setEngineReady] = useState(false);
  const [engineAttempt, setEngineAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square; color: Color } | null>(null);
  const [reviewPly, setReviewPly] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisMoves, setAnalysisMoves] = useState<MoveAnalysis[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [connection, setConnection] = useState<"connecting" | "connected" | "offline">("connecting");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const engine = useRef<StockfishEngine | null>(null);
  const analysisAbort = useRef<AbortController | null>(null);
  const hintAbort = useRef<AbortController | null>(null);
  const gameRef = useRef<Game | null>(null);
  const roomRef = useRef<PublicRoom | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const offset = useRef(0);
  const audio = useRef<AudioContext | null>(null);
  const requestBusy = useRef(false);
  const viewRef = useRef<View>("play");
  gameRef.current = game; roomRef.current = room; roomIdRef.current = roomId; viewRef.current = view;

  useEffect(() => {
    const initial = loadCurrent() ?? createGame();
    setGame(settleTimeout(initial)); setOrientation(initial.humanColor); setHistory(loadHistory());
    const id = new URLSearchParams(location.search).get("room");
    if (id) setRoomId(id);
    try { const saved = JSON.parse(localStorage.getItem("knightfall.settings") || "null"); if (saved && ["sage", "walnut", "slate"].includes(saved.theme)) setSettings(saved); } catch { /* Defaults remain usable. */ }
    const onPop = () => { const next = new URLSearchParams(location.search).get("room"); setRoomId(next); setRoom(null); setView("play"); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    let active = true;
    setEngineReady(false);
    const instance = new StockfishEngine(status => { if (active) { setEngineStatus(status); if (status === "ready") setEngineReady(true); if (status === "error") setEngineReady(false); } });
    engine.current = instance;
    return () => { active = false; instance.dispose(); };
  }, [engineAttempt]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 4500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (game) { saveGame(game); if (game.mode !== "online") saveCurrent(game); setHistory(loadHistory()); } }, [game]);
  useEffect(() => {
    if (!game || game.mode === "online" || game.result) return;
    const settled = settleTimeout(game, now);
    if (settled !== game) setGame(settled);
  }, [game, now]);
  useEffect(() => { setHint(null); hintAbort.current?.abort(); setPendingPromotion(null); }, [game?.id, game?.moves.length]);
  useEffect(() => () => { analysisAbort.current?.abort(); hintAbort.current?.abort(); audio.current?.close(); }, []);

  const sound = useCallback((capture = false) => {
    if (!settings.sound) return;
    try {
      audio.current ??= new AudioContext();
      const ctx = audio.current; if (ctx.state === "suspended") void ctx.resume();
      const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.type = "sine"; oscillator.frequency.setValueAtTime(capture ? 340 : 510, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(capture ? 100 : 220, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.07, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      oscillator.start(); oscillator.stop(ctx.currentTime + 0.13);
    } catch { /* Sound is optional and never prevents a move. */ }
  }, [settings.sound]);

  useEffect(() => {
    if (!game || game.mode !== "computer" || game.result || !engineReady || !engine.current || view !== "play" || roomId || positionAt(game).turn() === game.humanColor) return;
    const controller = new AbortController();
    const id = game.id; const length = game.moves.length;
    const level = LEVELS.find(l => l.id === game.level)!;
    engine.current.evaluate(enginePosition(game), positionAt(game).turn(), { depth: level.depth, ms: level.ms, skill: level.skill, signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted || !result.bestMove) return;
        setGame(current => {
          if (!current || current.id !== id || current.moves.length !== length || current.result) return current;
          try { return playMove(current, result.bestMove); } catch { return settleTimeout(current); }
        });
        sound();
      }).catch(e => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [game?.id, game?.moves.length, game?.result, game?.mode, game?.humanColor, game?.level, engineReady, engineAttempt, view, roomId, sound]);

  const ingestRoom = useCallback((next: PublicRoom) => {
    if (roomIdRef.current !== next.id) return;
    if (roomRef.current?.id === next.id && roomRef.current.version > next.version) return;
    offset.current = next.serverNow - Date.now();
    setConnection("connected");
    const old = roomRef.current;
    if (!old || old.id !== next.id || old.version !== next.version || old.yourColor !== next.yourColor) {
      roomRef.current = next; setRoom(next); setGame(next.game);
      if (!old || old.id !== next.id || old.yourColor !== next.yourColor) setOrientation(next.yourColor ?? "w");
      if (old && next.game.moves.length > old.game.moves.length) sound();
    }
  }, [sound]);

  const syncRoom = useCallback(async (id: string, signal?: AbortSignal) => {
    const token = seatToken(id);
    const response = await fetch(`/api/rooms/${encodeURIComponent(id)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: signal ?? AbortSignal.timeout(10000), cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load the room");
    ingestRoom(data.room);
  }, [ingestRoom]);
  useEffect(() => {
    if (!roomId) return;
    let disposed = false; let timer: ReturnType<typeof setTimeout>; let abort: AbortController;
    setConnection("connecting");
    const poll = async () => {
      abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 12000);
      try { await syncRoom(roomId, abort.signal); }
      catch (e) { if (!disposed) { setConnection("offline"); setError(e instanceof Error && e.name !== "AbortError" ? e.message : "Connection interrupted. Reconnecting automatically…"); } }
      finally { clearTimeout(timeout); if (!disposed) timer = setTimeout(poll, document.hidden ? 10000 : roomRef.current?.status === "finished" ? 15000 : 1800); }
    };
    void poll();
    return () => { disposed = true; clearTimeout(timer); abort?.abort(); };
  }, [roomId, syncRoom]);

  const sendAction = useCallback(async (action: Record<string, unknown>) => {
    if (!roomIdRef.current || requestBusy.current) return;
    const id = roomIdRef.current;
    requestBusy.current = true; setBusy(true); setError(null);
    try {
      const token = seatToken(id);
      const response = await fetch(`/api/rooms/${encodeURIComponent(id)}`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ version: roomRef.current?.version ?? 0, ...action }), signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not submit this move");
      if (data.token) {
        try { localStorage.setItem(`knightfall.seat.${id}`, data.token); }
        catch { throw new Error("Enable browser storage to keep your player seat, then reload."); }
      }
      ingestRoom(data.room);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The request failed");
      await syncRoom(id).catch(() => setConnection("offline"));
    } finally { requestBusy.current = false; setBusy(false); }
  }, [ingestRoom, syncRoom]);

  const commitMove = useCallback((from: Square, to: Square, promotion?: string) => {
    const current = gameRef.current;
    if (!current || current.result || viewRef.current !== "play") return;
    const chess = positionAt(current);
    if (current.mode === "computer" && chess.turn() !== current.humanColor) return;
    if (current.mode === "online" && (roomRef.current?.yourColor !== chess.turn() || roomRef.current?.status !== "playing")) return;
    const candidates = chess.moves({ square: from, verbose: true }).filter(m => m.to === to);
    if (!candidates.length) return;
    if (candidates.some(m => m.promotion) && !promotion) { setPendingPromotion({ from, to, color: chess.turn() }); return; }
    const uci = from + to + (promotion ?? "");
    if (current.mode === "online") void sendAction({ action: "move", move: uci });
    else {
      try { setGame(playMove(current, uci)); sound(Boolean(candidates[0].captured)); setError(null); }
      catch (e) { setError(e instanceof Error ? e.message : "Illegal move"); }
    }
    setPendingPromotion(null); setHint(null);
  }, [sendAction, sound]);

  const stopReview = useCallback(() => { analysisAbort.current?.abort(); hintAbort.current?.abort(); setAnalyzing(false); }, []);
  const newGame = useCallback(async (options: NewGameOptions) => {
    if (requestBusy.current) return false;
    stopReview(); setError(null);
    const color = options.color === "random" ? (crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? "w" : "b") : options.color;
    if (options.mode === "online") {
      requestBusy.current = true; setBusy(true);
      try {
        // Without persistent storage a reload would silently lose the private seat.
        localStorage.setItem("knightfall.storage-check", "1"); localStorage.removeItem("knightfall.storage-check");
        const response = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: options.name.trim() || "Chess friend", color, timeControl: options.time }), signal: AbortSignal.timeout(20000) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not create a room");
        localStorage.setItem(`knightfall.seat.${data.room.id}`, data.token);
        window.history.pushState(null, "", `/?room=${data.room.id}`);
        roomIdRef.current = data.room.id; roomRef.current = null; setRoomId(data.room.id); ingestRoom(data.room);
      } catch (e) { setError(e instanceof Error ? e.message : "Could not create the room"); return false; }
      finally { requestBusy.current = false; setBusy(false); }
    } else {
      window.history.pushState(null, "", "/"); roomIdRef.current = null; roomRef.current = null; setRoomId(null); setRoom(null);
      const created = createGame({ mode: options.mode, humanColor: color, level: options.level, timeControl: options.time });
      setGame(created); setOrientation(color);
    }
    setView("play"); setAnalysis(null); setAnalysisMoves([]); setReviewPly(0); setHint(null); setPendingPromotion(null);
    return true;
  }, [ingestRoom, stopReview]);

  const openGame = useCallback((saved: Game, review = true) => {
    stopReview();
    if (saved.mode === "online" && !review) {
      window.history.pushState(null, "", `/?room=${saved.id}`); roomIdRef.current = saved.id; roomRef.current = null; setRoomId(saved.id); setRoom(null); setView("play"); return;
    }
    window.history.pushState(null, "", "/"); roomIdRef.current = null; roomRef.current = null; setRoomId(null); setRoom(null);
    setGame(saved); setOrientation(saved.humanColor); setReviewPly(saved.moves.length);
    const cached = loadAnalysis(saved.id); const valid = cached?.signature === gameSignature(saved) ? cached : null;
    setAnalysis(valid); setAnalysisMoves(valid?.moves ?? []); setView(review ? "review" : "play"); setError(null);
  }, [stopReview]);
  const startAnalysis = useCallback(async (depth = 14) => {
    const current = gameRef.current;
    if (!current || !current.moves.length || !engine.current || !engineReady || analyzing) return;
    if (current.mode === "online" && !current.result) { setNotice("Engine review is available after the online game ends. Fair play first."); return; }
    setView("review"); setReviewPly(Math.min(1, current.moves.length)); setError(null); setAnalysis(null); setAnalysisMoves([]); setAnalyzing(true);
    const controller = new AbortController(); analysisAbort.current?.abort(); analysisAbort.current = controller;
    try {
      const result = await analyzeGame(engine.current, current, { depth, ms: depth >= 18 ? 1800 : depth <= 12 ? 350 : 700, signal: controller.signal, progress: moves => { if (!controller.signal.aborted) setAnalysisMoves(moves); } });
      if (!controller.signal.aborted) { setAnalysis(result); if (!saveAnalysis(result)) setNotice("Review complete. Browser storage is full, so it could not be saved."); }
    } catch (e) { if (e instanceof Error && e.name !== "AbortError") setError(e.message); }
    finally { if (analysisAbort.current === controller) setAnalyzing(false); }
  }, [engineReady, analyzing]);

  const requestHint = useCallback(async () => {
    const current = gameRef.current;
    if (!current || current.result || current.mode === "online" || !engineReady || !engine.current || engineStatus === "thinking") return;
    const controller = new AbortController(); hintAbort.current?.abort(); hintAbort.current = controller;
    try {
      const result = await engine.current.evaluate(enginePosition(current), positionAt(current).turn(), { depth: 14, ms: 800, signal: controller.signal });
      if (!controller.signal.aborted) setHint(result.bestMove);
    } catch (e) { if (e instanceof Error && e.name !== "AbortError") setError(e.message); }
  }, [engineReady, engineStatus]);
  const undo = useCallback(() => {
    const current = gameRef.current;
    if (!current || current.mode === "online" || !current.moves.length || current.result) return;
    hintAbort.current?.abort();
    const turn = positionAt(current).turn();
    const count = current.mode === "computer" && turn === current.humanColor ? 2 : 1;
    // Restore the clock snapshot as well as the position; don't accumulate increments.
    setGame(takeBack(current, count));
    setAnalysis(null); setAnalysisMoves([]);
  }, []);
  const resign = useCallback(() => {
    const current = gameRef.current; if (!current || current.result) return;
    if (current.mode === "online") { void sendAction({ action: "resign" }); return; }
    const color = current.mode === "computer" ? current.humanColor : positionAt(current).turn();
    setGame({ ...current, result: { winner: color === "w" ? "b" : "w", reason: "Resignation" }, updatedAt: Date.now(), clocks: { ...clockValues(current), activeSince: null } });
  }, [sendAction]);
  const agreeDraw = useCallback(() => {
    const current = gameRef.current; if (!current || current.result) return;
    if (current.mode === "online") { void sendAction({ action: "offer-draw" }); return; }
    if (current.mode !== "local") return;
    setGame({ ...current, result: { winner: "draw", reason: "Draw by agreement" }, updatedAt: Date.now(), clocks: { ...clockValues(current), activeSince: null } });
  }, [sendAction]);
  const changeSettings = useCallback((next: Settings) => { setSettings(next); safeWrite("knightfall.settings", next); }, []);
  const switchView = useCallback((next: View) => {
    if (next === "review" && gameRef.current?.mode === "online" && !gameRef.current.result) { setNotice("Finish the online game before using engine review."); return; }
    if (next !== "review") stopReview();
    if (next === "review" && gameRef.current) {
      const current = gameRef.current; setReviewPly(current.moves.length);
      const cached = loadAnalysis(current.id);
      if (cached?.signature === gameSignature(current)) { setAnalysis(cached); setAnalysisMoves(cached.moves); }
      else { setAnalysis(null); setAnalysisMoves([]); }
    }
    setView(next);
  }, [stopReview]);
  const chess = useMemo(() => game ? positionAt(game) : null, [game]);
  const displayedChess = useMemo(() => game ? positionAt(game, view === "review" ? reviewPly : game.moves.length) : null, [game, view, reviewPly]);
  const clocks = game ? clockValues(game, now + (game.mode === "online" ? offset.current : 0)) : { w: 0, b: 0 };
  const movable: Color | "both" | null = !game || game.result || view !== "play" || busy || roomId && !room ? null : game.mode === "online" ? (room?.status === "playing" && connection === "connected" ? room.yourColor : null) : game.mode === "local" ? "both" : game.humanColor;
  return {
    game, chess, displayedChess, clocks, view, switchView, history, setHistory, orientation, setOrientation,
    settings, changeSettings, engineStatus, engineReady, retryEngine: () => { setError(null); setEngineAttempt(n => n + 1); },
    error, setError, notice, setNotice, hint, requestHint, pendingPromotion, setPendingPromotion,
    commitMove, movable, newGame, undo, resign, agreeDraw, room, roomId, busy, connection, sendAction,
    reviewPly, setReviewPly, analysis, analysisMoves, analyzing, startAnalysis, stopReview, openGame
  };
}
export type ChessController = ReturnType<typeof useChess>;