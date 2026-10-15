"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Color, type Square } from "chess.js";
import { Piece } from "./piece";

const names = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
interface Props {
  fen: string; orientation: Color; movable: Color | "both" | null;
  lastMove?: string; suggestion?: string | null;
  onMove: (from: Square, to: Square) => void;
  coordinates?: boolean; theme?: "sage" | "walnut" | "slate";
}
export function ChessBoard({ fen, orientation, movable, lastMove, suggestion, onMove, coordinates = true, theme = "sage" }: Props) {
  const chess = useMemo(() => new Chess(fen), [fen]);
  const [selected, setSelected] = useState<Square | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Square | null>(null);
  useEffect(() => { setSelected(null); }, [fen, orientation, movable]);
  const ranks = orientation === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = (orientation === "w" ? "abcdefgh" : "hgfedcba").split("");
  const squares = ranks.flatMap(rank => files.map(file => `${file}${rank}` as Square));
  const targets = useMemo(() => selected ? chess.moves({ square: selected, verbose: true }).map(m => m.to) : [], [chess, selected]);
  const canSelect = (square: Square) => {
    const piece = chess.get(square);
    return Boolean(piece && movable && piece.color === chess.turn() && (movable === "both" || piece.color === movable));
  };
  const select = (square: Square) => {
    if (!movable) return;
    if (selected && targets.includes(square)) { onMove(selected, square); setSelected(null); }
    else setSelected(selected === square ? null : canSelect(square) ? square : null);
  };
  function point(square: string) {
    return { x: files.indexOf(square[0]) * 100 + 50, y: ranks.indexOf(Number(square[1])) * 100 + 50 };
  }
  const a = suggestion ? point(suggestion.slice(0, 2)) : null;
  const b = suggestion ? point(suggestion.slice(2, 4)) : null;
  return <div className={`chessboard ${theme}`} ref={boardRef} role="group" aria-label={`Chessboard. ${chess.turn() === "w" ? "White" : "Black"} to move. Select a piece, then a highlighted square.`}>
    {squares.map((square, index) => {
      const piece = chess.get(square);
      const legal = targets.includes(square);
      const light = (square.charCodeAt(0) - 97 + Number(square[1])) % 2 === 0;
      const last = lastMove && (square === lastMove.slice(0, 2) || square === lastMove.slice(2, 4));
      const check = chess.isCheck() && piece?.type === "k" && piece.color === chess.turn();
      return <button key={square} data-testid={`square-${square}`} type="button"
        className={`square ${light ? "light" : "dark"} ${last ? "last-move" : ""} ${selected === square ? "selected" : ""} ${check ? "in-check" : ""} ${canSelect(square) ? "selectable" : ""}`}
        aria-label={`${square}${piece ? `, ${piece.color === "w" ? "White" : "Black"} ${names[piece.type]}` : ", empty"}${legal ? ", legal destination" : ""}`}
        aria-pressed={selected === square} onClick={() => select(square)}
        onKeyDown={e => {
          const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[e.key];
          if (delta !== undefined) { e.preventDefault(); boardRef.current?.querySelectorAll<HTMLButtonElement>(".square")[(index + delta + 64) % 64]?.focus(); }
          if (e.key === "Escape") setSelected(null);
        }}
        onDragOver={e => { if (movable) e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); const from = drag.current; drag.current = null; if (from && chess.moves({ square: from, verbose: true }).some(m => m.to === square)) { onMove(from, square); setSelected(null); } }}>
        {coordinates && index % 8 === 0 && <span className="coord rank">{square[1]}</span>}
        {coordinates && index >= 56 && <span className="coord file">{square[0]}</span>}
        {piece && <span className="piece-wrap" draggable={canSelect(square)} onDragStart={e => { if (!canSelect(square)) { e.preventDefault(); return; } drag.current = square; setSelected(square); e.dataTransfer.setData("text/plain", square); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { drag.current = null; }}><Piece type={piece.type} color={piece.color}/></span>}
        {legal && <span className={piece ? "legal-capture" : "legal-dot"}/>}
      </button>;
    })}
    {a && b && <svg className="move-arrow" viewBox="0 0 800 800" aria-hidden="true"><defs><marker id="arrowhead" markerWidth="4" markerHeight="4" refX="2.8" refY="2" orient="auto"><path d="M0 0L4 2 0 4z" fill="#eba446"/></marker></defs><line x1={a.x} y1={a.y} x2={b.x - (b.x - a.x) * 0.13} y2={b.y - (b.y - a.y) * 0.13} stroke="#eba446" strokeWidth="18" strokeLinecap="round" markerEnd="url(#arrowhead)" opacity=".88"/></svg>}
  </div>;
}