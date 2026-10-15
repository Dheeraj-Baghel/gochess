"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, Check, ChevronRight, Clock3, Copy, Crown, Flame, Globe2, Leaf, Link2, LoaderCircle, Shield, Shuffle, Sparkles, Swords, Users, Zap } from "lucide-react";
import type { Color } from "chess.js";
import type { ChessController, NewGameOptions } from "@/hooks/use-chess";
import { LEVELS, TIMES, formatClock, resultCode, resultLabel, type Game, type LevelId, type Mode, type TimeId } from "@/lib/chess";
import { CLASSIFICATIONS, type MoveAnalysis } from "@/lib/analysis";
import { Piece } from "./piece";

const levelIcons = { leaf: Leaf, shield: Shield, flame: Flame, crown: Crown };
export function NewGameForm({ onStart, busy, initialMode = "computer", compact = false }: { onStart: (options: NewGameOptions) => void; busy: boolean; initialMode?: Mode; compact?: boolean }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [level, setLevel] = useState<LevelId>("club");
  const [color, setColor] = useState<Color | "random">("w");
  const [time, setTime] = useState<TimeId>("none");
  const [name, setName] = useState("");
  return <form className={`new-game-form ${compact ? "compact" : ""}`} onSubmit={e => { e.preventDefault(); onStart({ mode, level, color, time, name }); }}>
    <div className="mode-switch" role="group" aria-label="Game mode">
      <button type="button" className={mode === "computer" ? "active" : ""} onClick={() => setMode("computer")} aria-pressed={mode === "computer"}><Bot size={17}/><span>Computer</span></button>
      <button type="button" className={mode === "online" ? "active" : ""} onClick={() => setMode("online")} aria-pressed={mode === "online"}><Globe2 size={17}/><span>A friend</span></button>
      <button type="button" className={mode === "local" ? "active" : ""} onClick={() => setMode("local")} aria-pressed={mode === "local"}><Users size={17}/><span>Local</span></button>
    </div>
    {mode === "computer" ? <>
      <div className="field-label">CHOOSE YOUR CHALLENGE <span>Stockfish 18</span></div>
      <div className="difficulty-grid">{LEVELS.map(l => { const Icon = levelIcons[l.icon]; return <button key={l.id} type="button" className={`difficulty ${level === l.id ? "chosen" : ""}`} onClick={() => setLevel(l.id)} aria-pressed={level === l.id}><Icon size={19}/><span><strong>{l.name}</strong><small>{l.subtitle}</small></span>{level === l.id && <Check className="selection-check" size={13}/>}</button>; })}</div>
    </> : <div className="mode-explanation"><div className="mode-illustration">{mode === "online" ? <Link2 size={26}/> : <Users size={26}/>}</div><h3>{mode === "online" ? "Good chess. Better company." : "One board. Two minds."}</h3><p>{mode === "online" ? "Create a private room and send the link. Your friend can join from any device." : "Take turns on this device. Perfect for a friendly game across the table."}</p>{mode === "online" && <label className="input-label">Your name<input maxLength={24} value={name} onChange={e => setName(e.target.value)} placeholder="Chess friend" autoComplete="nickname"/></label>}</div>}
    <div className="setup-bottom"><div><label className="field-label" htmlFor={compact ? "time-main" : "time-dialog"}>TIME CONTROL</label><div className="select-wrap"><Clock3 size={16}/><select id={compact ? "time-main" : "time-dialog"} value={time} onChange={e => setTime(e.target.value as TimeId)}>{TIMES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div></div><div><div className="field-label">PLAY AS</div><div className="color-switch" role="group" aria-label="Play as"><button type="button" className={color === "w" ? "chosen" : ""} onClick={() => setColor("w")} aria-label="Play as White" aria-pressed={color === "w"}><span className="side-dot white"/></button><button type="button" className={color === "random" ? "chosen" : ""} onClick={() => setColor("random")} aria-label="Random color" aria-pressed={color === "random"}><Shuffle size={16}/></button><button type="button" className={color === "b" ? "chosen" : ""} onClick={() => setColor("b")} aria-label="Play as Black" aria-pressed={color === "b"}><span className="side-dot black"/></button></div></div></div>
    <button className="primary-button start-button" disabled={busy} type="submit">{busy ? <LoaderCircle size={19} className="spin"/> : <Swords size={19}/>} {mode === "online" ? "Create a friend game" : "Let's play"} <ArrowRight size={17}/></button>
    <p className="tiny-note"><Shield size={12}/>{mode === "online" ? "Private link · No account needed · Casual games" : mode === "computer" ? "Real Stockfish. Right in your browser." : "No connection needed after loading."}</p>
  </form>;
}

export function PlayerBar({ game, color, time, turn, orientation, thinking, captured }: { game: Game; color: Color; time: number; turn: Color; orientation: Color; thinking: boolean; captured: string[] }) {
  const isEngine = game.mode === "computer" && game.humanColor !== color;
  const name = color === "w" ? game.whiteName : game.blackName;
  const active = !game.result && turn === color;
  const level = LEVELS.find(l => l.id === game.level)!;
  return <div className={`player-bar ${active ? "active-player" : ""}`}>
    <div className={`player-avatar ${isEngine ? "engine-avatar" : ""}`}>{isEngine ? <Bot size={24}/> : <Piece type="k" color={color}/>}<span className={`player-dot ${active ? "active" : ""}`}/></div>
    <div className="player-info"><div className="player-name">{isEngine ? "Stockfish" : name}<span className="player-badge">{isEngine ? level.name : game.mode === "online" ? "FRIENDLY" : color === orientation && game.mode === "computer" ? "YOU" : color === "w" ? "WHITE" : "BLACK"}</span></div><div className="player-sub">{isEngine && thinking ? <span className="thinking-dots">Thinking<span>•••</span></span> : captured.length ? <span className="captured-pieces" aria-label={`${captured.length} captured pieces`}>{captured.map((p, i) => <Piece key={i} color={color === "w" ? "b" : "w"} type={p as "p"}/>)}</span> : isEngine ? "Your silicon sparring partner" : game.mode === "computer" ? "The next great move is yours" : "A little friendly competition"}</div></div>
    <div className={`clock ${active ? "clock-active" : ""} ${game.timeControl !== "none" && time < 30000 ? "low-time" : ""}`} aria-label={`${color === "w" ? "White" : "Black"} clock`}><Clock3 size={16}/><span>{game.timeControl === "none" ? "∞" : formatClock(time)}</span></div>
  </div>;
}

export function MoveList({ moves, selectedPly, onSelect, analysisMoves = [], compact = false }: { moves: string[]; selectedPly: number; onSelect?: (ply: number) => void; analysisMoves?: MoveAnalysis[]; compact?: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!onSelect) end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [moves.length, onSelect]);
  return <div className={`move-list ${compact ? "short" : ""}`}>
    {!moves.length ? <div className="empty-moves"><div className="empty-moves-icon"><Swords size={22}/></div><strong>Great games start with one move.</strong><span>Select a piece to see its legal moves.</span></div> : Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => <div className="move-row" key={i}><span className="move-number">{i + 1}.</span>{[i * 2, i * 2 + 1].map(index => {
      const a = analysisMoves[index]; const info = a ? CLASSIFICATIONS[a.classification] : null;
      return index < moves.length ? <button key={index} disabled={!onSelect} className={`move-cell ${selectedPly === index + 1 ? "current-move" : ""}`} onClick={() => onSelect?.(index + 1)} aria-label={`Move ${i + 1}, ${index % 2 === 0 ? "White" : "Black"}: ${moves[index]}${info ? `, ${info.label}` : ""}`}><span>{moves[index]}</span>{info && <span title={info.label} className="move-class" style={{ color: info.color }}>{info.glyph}</span>}</button> : <span key={index}/>;
    })}</div>)}<div ref={end}/>
  </div>;
}

export function RoomPanel({ c }: { c: ChessController }) {
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const { room } = c;
  const url = typeof window !== "undefined" ? `${location.origin}/?room=${c.roomId}` : "";
  async function copy() { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { c.setNotice("Select the invite link below and copy it to share."); } }
  return <div className="card room-panel"><div className="card-title"><span><Globe2 size={18}/> Friend game</span><span className={`connection-badge ${c.connection}`}><i/>{c.connection === "connected" ? "Live" : c.connection === "connecting" ? "Connecting" : "Reconnecting"}</span></div>
    {!room ? <div className="room-status"><LoaderCircle className="spin"/><p>Getting your board ready…</p></div> : <>
      <div className="room-status"><div className="room-hero-icon">{room.status === "waiting" ? <Link2 size={29}/> : <Swords size={29}/>}</div><h3>{room.status === "waiting" ? room.yourColor ? "Save your friend a seat." : "You've been invited." : room.game.result ? resultLabel(room.game.result) : room.yourColor ? "You're in. Let's play." : "A front-row seat."}</h3><p>{room.status === "waiting" ? room.yourColor ? "Send your link. The game starts when they join." : `Join ${room.game.whiteName === "Waiting for a friend" ? room.game.blackName : room.game.whiteName} for a game of chess.` : room.game.result ? room.game.result.reason : room.yourColor ? `You're playing ${room.yourColor === "w" ? "White" : "Black"}. Moves sync automatically.` : "Both seats are taken. You're watching as a spectator."}</p></div>
      {room.status === "waiting" && !room.yourColor ? <form className="join-form" onSubmit={e => { e.preventDefault(); void c.sendAction({ action: "join", name: name.trim() || "Chess friend" }); }}><label className="input-label">Your name<input maxLength={24} value={name} onChange={e => setName(e.target.value)} placeholder="Chess friend" autoComplete="nickname"/></label><button className="primary-button" disabled={c.busy}>{c.busy ? <LoaderCircle className="spin" size={18}/> : <Swords size={18}/>}Join as {room.openColor === "w" ? "White" : "Black"}<ArrowRight size={17}/></button></form> : <><div className="invite-link"><input aria-label="Game invite link" readOnly value={url} onFocus={e => e.target.select()}/><button onClick={copy} className="icon-button" aria-label="Copy invite link">{copied ? <Check size={18}/> : <Copy size={18}/>}</button></div><button className="secondary-button full-width" onClick={copy}>{copied ? <Check size={16}/> : <Link2 size={16}/>} {copied ? "Link copied!" : "Copy game link"}</button></>}
      {room.drawOffer && room.yourColor && <div className="draw-offer">{room.drawOffer === room.yourColor ? <p>Draw offered. Waiting for your opponent.</p> : <><p>Your opponent offered a draw.</p><div className="button-row"><button className="secondary-button" disabled={c.busy} onClick={() => void c.sendAction({ action: "decline-draw" })}>Decline</button><button className="primary-button" disabled={c.busy} onClick={() => void c.sendAction({ action: "accept-draw" })}>Accept draw</button></div></>}</div>}
      <div className="room-fairplay"><Shield size={15}/><span>No engine hints during live play. Just you, your friend, and the board.</span></div>
    </>}
  </div>;
}

export function ResultBanner({ c, onNew }: { c: ChessController; onNew: () => void }) {
  if (!c.game?.result) return null;
  return <div className="result-banner" role="status"><div className="result-emblem"><Crown size={27}/></div><div><span className="eyebrow">WELL PLAYED</span><h2>{resultLabel(c.game.result)} <span>{resultCode(c.game.result)}</span></h2><p>{c.game.result.reason} · Every game makes you a little better.</p></div><div className="result-actions"><button className="primary-button" disabled={!c.game.moves.length} onClick={() => c.switchView("review")}><Sparkles size={17}/>Game review<ChevronRight size={17}/></button><button className="text-button" onClick={onNew}>Play another game <ArrowRight size={14}/></button></div></div>;
}