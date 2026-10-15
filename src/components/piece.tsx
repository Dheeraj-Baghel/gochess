import type { Color, PieceSymbol } from "chess.js";

// Original vector piece set: one consistent silhouette, no remote image dependency.
export function Piece({ type, color, className = "" }: { type: PieceSymbol; color: Color; className?: string }) {
  const fill = color === "w" ? "#fffdf4" : "#34443a";
  const stroke = color === "w" ? "#4a5749" : "#17291f";
  const detail = color === "w" ? "#748068" : "#a7b29c";
  return <svg className={`chess-piece ${className}`} viewBox="0 0 48 48" aria-hidden="true">
    <g fill={fill} stroke={stroke} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      {type === "p" && <><circle cx="24" cy="12.5" r="6.5"/><path d="M20 19c1 8-1 11-6 16h20c-5-5-7-8-6-16"/><path d="M15 34h18l3 5H12z"/><path d="M12 39h24v3H12z"/></>}
      {type === "r" && <><path d="M11 7h7v6h4V7h5v6h4V7h6v13l-6 4 1 11H16l1-11-6-4z"/><path d="M14 35h20l3 7H11z"/><path d="M13 20h22M17 25h14M14 38h20" fill="none" stroke={detail}/></>}
      {type === "n" && <><path d="M12 36c0-9 4-15 16-20l-8 1-6 8-7-5L18 9l1-5 7 4c14-1 15 16 10 28z"/><path d="M13 35h23l3 7H10z"/><path d="M29 12c5 7 5 15 2 21M14 38h21" fill="none" stroke={detail}/><circle cx="21" cy="13" r="1.5" fill={stroke} stroke="none"/><path d="m10 20 4 1" fill="none"/></>}
      {type === "b" && <><circle cx="24" cy="5.5" r="2.3"/><path d="M24 8C8 20 17 26 20 27l-4 8h16l-4-8c10-5 7-13-4-19z"/><path d="m24 13-4 7M17 27h14" fill="none" stroke={detail}/><path d="M15 35h18l5 7H10z"/><path d="M15 38h18" stroke={detail}/></>}
      {type === "q" && <><path d="m10 13 6 8 2-11 6 10 6-10 2 11 6-8-5 20H15z"/><circle cx="10" cy="11" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="30" cy="8" r="2.5"/><circle cx="38" cy="11" r="2.5"/><circle cx="24" cy="6" r="2.5"/><path d="M14 33h20l3 9H11z"/><path d="M16 28h16M14 37h20" stroke={detail} fill="none"/></>}
      {type === "k" && <><path d="M22 3h4v4h4v4h-4v7h-4v-7h-4V7h4z"/><path d="M24 19c-7-13-24-1-9 10l2 5h14l2-5c15-11-2-23-9-10z"/><path d="M24 18v11M16 29h16" stroke={detail} fill="none"/><path d="M15 34h18l4 8H11z"/><path d="M15 38h18" stroke={detail}/></>}
    </g>
  </svg>;
}
export function KnightMark({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 48 48" className={className} aria-hidden="true"><path d="M12 36c0-9 4-15 16-20l-8 1-6 8-7-5L18 9l1-5 7 4c14-1 15 16 10 28zM11 39h26v5H11z" fill="currentColor"/><circle cx="21" cy="13" r="1.5" fill="var(--knight-eye, #172b25)"/></svg>;
}