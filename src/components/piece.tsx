import type { Color, PieceSymbol } from "chess.js";

// Board, avatar, captured, and promotion pieces are the vendored skak-svg set.
// The two-letter filenames use chess.js colors/types directly (for example wk.svg).
export function Piece({ type, color, className = "" }: { type: PieceSymbol; color: Color; className?: string }) {
  return <img
    className={`chess-piece ${className}`}
    src={`/pieces/skak/${color}${type}.svg`}
    width="100"
    height="100"
    alt=""
    aria-hidden="true"
    draggable={false}
  />;
}
export function KnightMark({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 48 48" className={className} aria-hidden="true"><path d="M12 36c0-9 4-15 16-20l-8 1-6 8-7-5L18 9l1-5 7 4c14-1 15 16 10 28zM11 39h26v5H11z" fill="currentColor"/><circle cx="21" cy="13" r="1.5" fill="var(--knight-eye, #172b25)"/></svg>;
}