# Gochess — a good day for a great move

**[Play the live website](https://gochess-chess.vercel.app)** · No signup required.

[GitHub source](https://github.com/Dheeraj-Baghel/gochess) · [Deployment notes](DEPLOYMENT.md)

A complete browser chess app with an original sage-and-ivory interface, real Stockfish gameplay/analysis, and server-authoritative online rooms. No signup or AI API key is required. Inspired by familiar online chess workflows, not affiliated with Chess.com.

## Play

- **Computer:** Stockfish 18 lite NNUE in a dedicated Web Worker, with Casual, Club player, Expert, and Master levels. Skill and time/depth limits determine strength; no unverified Elo ratings are advertised.
- **A friend:** create a private room and send its link. Your friend joins the open seat from another device. Moves are validated on the server, clocks are authoritative, and seats survive reloads in the same browser. Additional visitors can spectate.
- **Local:** pass and play on one device, using touch/click or desktop drag-and-drop.
- **Controls:** legal-move highlighting, all four promotion choices, castling, en passant, check/checkmate, automatic threefold/fifty-move draws, stalemate, insufficient material, 5/10/15+10 clocks, takebacks with clock restoration for offline games, hints, resignation, draw agreement, board flip, sound, and three board palettes.
- **Review:** move-by-move centipawn evaluations, best moves, principal variations, blunders, mistakes, inaccuracies, an interactive evaluation chart, and keyboard replay controls.
- **History:** the last 100 games and engine reviews are saved in browser storage. Import/export PGN to move games between devices or keep permanent copies.

Online games intentionally disable hints, takebacks, and engine review until the game has ended. All games are casual and unrated; this is not an anti-cheat-certified tournament platform.

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open `http://localhost:3100`. The install script copies the real single-threaded Stockfish worker and approximately 7 MB WASM payload into the application; no engine CDN or SharedArrayBuffer setup is needed. Fonts and the vendored skak SVG pieces are also served locally.

For development without a database, friend rooms use an explicitly development-only in-memory store. Production refuses room creation without durable storage; it never silently substitutes ephemeral memory for PostgreSQL.

For persistent local rooms, create a dedicated Neon database, copy [.env.example](.env.example) to a local environment file, set `DATABASE_URL`, then run:

```sh
npm run db:setup
```

## Test and deploy

```sh
npm test
npm run typecheck
npm audit
npm run build
npm run test:e2e
```

Verified on 2026-10-15: **47 unit tests**, **8 real Chromium/API browser workflows against the public website**, successful production build/type checks, and **zero npm audit vulnerabilities**. An automated homepage WCAG 2 A/AA scan passed 22 checks with zero detected violations. This is not an exhaustive manual accessibility certification. See [release verification](artifacts/testing/release-verification.json) and [deployment notes](DEPLOYMENT.md).

The local skak-piece update was verified on 2026-10-19 with all 47 unit tests, TypeScript, a production build, and the focused desktop Chromium workflow. That browser check asserts that all 32 starting pieces load from the local skak asset directory at their expected 100 px intrinsic size. The other seven browser/API workflows were not rerun for this asset-only change.

The included Vercel configuration provisions schema on build, serves the browser engine, and connects a dedicated Neon database. See [deployment notes](DEPLOYMENT.md) for the public release, hosting limitations, production environment, test procedures, and update commands. The CI workflow is ready for a standalone repository; no GitHub connection is required for Vercel CLI releases.

## Architecture

- [Chess app](src/components/app.tsx): responsive application shell and accessible controls.
- [Chessboard](src/components/board.tsx): locally vendored skak vector pieces, click/touch, drag-and-drop, coordinates, legal targets, engine arrows, and keyboard operation.
- [Game controller](src/hooks/use-chess.ts): gameplay, Stockfish scheduling/cancellation, clocks, room synchronization, replay, and history.
- [Chess rules](src/lib/chess.ts): pure chess.js-based position reconstruction, move validation, results, clocks, takeback snapshots, and PGN.
- [Engine integration](src/lib/engine.ts): serialized UCI tasks, lifecycle, error recovery, cancellation, and real per-position analysis.
- [Analysis](src/lib/analysis.ts): White-normalized centipawns, move classifications, SAN variations, and a transparent accuracy heuristic.
- [Room protocol](src/lib/server/rooms.ts): hashed capabilities, authorization, draw/resign transitions, server clocks, and public response redaction.
- [Durable store](src/lib/server/store.ts): Neon PostgreSQL, optimistic locking, expiring rooms, and rate limiting.
- [API tests](e2e/api.spec.ts) and [browser tests](e2e/chess.spec.ts): exercise the real engine and multi-visitor workflows rather than mocking the core features.

## Analysis semantics

Centipawn scores are **always from White's perspective**: positive favors White, negative favors Black. `M<n>` indicates a forced mate; the evaluation bar and side-to-move context identify the favored side. A terminal checkmate displays `M0`. Zero-move terminal evaluations have depth 0; normal evaluations show actual reached depth.

Move loss is the nonnegative drop in evaluation from the mover's perspective. The engine's selected move is **Best**; other moves are Excellent (<20 cp), Good (20–49 cp), Inaccuracy (50–99 cp), Mistake (100–199 cp), or Blunder (200+ cp). Forced-mate scores are represented by large signed internal values for classification. Evaluations can change with search depth, time, and device speed.

Accuracy is `round(100 * exp(-mean(min(cp_loss, 1000)) / 180))`. It is a Gochess heuristic, **not** Chess.com's proprietary accuracy formula or a strength rating. Analysis runs sequentially on-device and streams progress; it can be cancelled. A full long-game review can take several minutes on a slower phone.

## Persistence, privacy, and limits

- Online game state uses a dedicated PostgreSQL database. Random 256-bit seat tokens are hashed server-side and never exposed in invite URLs or spectator data.
- Anyone possessing an invite link can watch/join its open seat. Do not use player names for sensitive personal information.
- Room links expire after 7 days. Expired rows and hashed-IP rate counters are removed opportunistically during writes.
- The local history is not an account/cloud backup. Clearing browser data removes saved games, analysis, and seat credentials.
- Clocks continue during tab changes/disconnects; there is no timed-game pause. Online clocks start when both players have joined; offline clocks start after the first move.
- Online updates poll approximately every 1.8 seconds, slower in background tabs. This is friendly casual play, not a low-latency tournament service.
- Hosted on Vercel Hobby and Neon Free; personal/non-commercial hosting and free-tier quotas apply. No paid AI inference is used.
- Modern WebAssembly-capable browsers are required for the engine. If loading fails, a retry/error UI appears and friend/local modes remain usable. Chromium and mobile-viewport flows are automated; browser support is not a claim of exhaustive device testing.

## License and source

Gochess's application source is GPL-3.0-or-later; [LICENSE](LICENSE) is included. Every build produces a downloadable corresponding-source archive at `/source/gochess-source.tar.gz`, with a strict file allowlist that excludes credentials, databases, dependencies, and machine-local configuration.

- Engine: [Stockfish.js 18.0.8](https://github.com/nmrugg/stockfish.js/tree/v18.0.8), GPLv3. [Exact upstream source archive](https://github.com/nmrugg/stockfish.js/archive/refs/tags/v18.0.8.tar.gz), including its build instructions, is linked adjacent to the engine license in the application.
- Rules: [chess.js](https://github.com/jhlywa/chess.js), BSD-2-Clause.
- Icons: [Lucide](https://lucide.dev/license), ISC.
- Fonts: DM Sans and Manrope via Fontsource, SIL Open Font License.
- Chess pieces: verbatim SVGs from [MuTsunTsai/skak-svg](https://github.com/MuTsunTsai/skak-svg) at commit `aeef99c6b95cbe51990f402027349c982dc9b51f`, based on the skak set designed by Piet Tutelaers and modified by Torben Hoffmann. The upstream skak work is LPPL 1.3c; the conversion repository has no standalone license file at the pinned commit. Preserve the bundled asset notice, LPPL text, attribution, and source links when redistributing these files.
- Gochess's branding and board interface remain original to this project.
