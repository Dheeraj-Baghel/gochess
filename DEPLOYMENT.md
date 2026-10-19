# Knightfall deployment

## Live website

**[Open Knightfall](https://knightfall-chess-three.vercel.app)**

Also reachable at [the account-scoped alias](https://knightfall-chess-softtech10.vercel.app).
Initial functional release: `dpl_Cz7Qk3zqD1X87vHkkPYmxEtfJpje`, status `READY`, deployed 2026-10-15.
The final documentation-only release uses the same runtime source and aliases.

Latest release (2026-10-19): the skak-svg piece-set update was pushed to GitHub
(`main` commit `6a1b4f6`) and deployed with the standard Vercel CLI command. The
production alias serves the new `/pieces/skak/` assets (SHA-256 verified against
the repository files), `/api/health` returns 200, and the desktop Chromium
workflow — including the check that all 32 starting pieces load from the local
skak set — passed against the public URL. The remaining browser/API workflows
were not rerun for this asset-only release.

### Verified on the public URL

- All 47 unit tests, TypeScript, optimized production build, and dependency audit passed (zero reported vulnerabilities).
- All 8 browser/API workflows passed against the public domain without any Vercel login, authorization bypass header, or mocked Stockfish responses.
- Stockfish made legal replies; a completed Fool's Mate received real engine analysis identifying the decisive blunder, best move, variation, and terminal evaluation.
- Separate browser contexts created/joined a room, exchanged moves, reloaded into their seats, spectated, and accepted a draw. Unauthorized and out-of-turn API requests were rejected; concurrent moves yielded exactly one committed move.
- Promotion/underpromotion, illegal-move rejection, drag/drop, keyboard controls, history persistence, PGN export/import, mobile overflow checks, and engine failure recovery passed.
- Public health, engine JS/WASM, engine license, and downloadable source returned HTTP 200. Health reported PostgreSQL with `durable: true`.
- Automated homepage accessibility scan: 22 rules passed, zero WCAG 2 A/AA violation categories. Other states and manual assistive-technology testing are not covered by that scan.
- The public source archive was inspected: it includes the example environment file, not private environment values or Vercel authentication configuration.

## Hosting

- Vercel project: `knightfall-chess`, account `softtech10`, Node.js 24, Next.js 16.4.1, region `iad1`.
- Dedicated Neon database: `knightfall-db`, plan `free_v3`, region `iad1`. This does not reuse or modify another application's database.
- Only Production is connected to the database. Preview deployments must use a separate testing database.
- Vercel SSO deployment protection is disabled on this project so visitors do not need a Vercel login.
- Vercel Hobby is personal/non-commercial hosting. Hosting, database, and bandwidth quotas apply. No paid tier was selected.

## GitHub repository

Public source: **[Dheeraj-Baghel/knightfall-chess](https://github.com/Dheeraj-Baghel/knightfall-chess)**.
The repository contains application source, tests, CI, documentation, and deployment configuration.
Private environment files, tokens, local Vercel metadata, and database credentials are excluded.

GitHub hosts the source; Vercel continues to host the working application with Neon PostgreSQL.
GitHub Pages cannot run this application's server-side multiplayer API. GitHub push does not
automatically deploy to Vercel: no Git integration has been connected for this project.

## Release command

```sh
npm ci
npm test
npm run typecheck
npm audit
npx --yes vercel@64.0.2 deploy --prod --yes --scope softtech10
```

The build command is `npm run build:vercel`. It creates the two database tables/indexes idempotently, packages downloadable app source, and performs the production build. The package install step copies Stockfish's single-threaded NNUE worker and WASM files into the public engine directory.

The local folder is linked to this Vercel project. The GitHub Actions workflow runs checks on pushes and pull requests, without production secrets. Deploy updates using the Vercel command above.

## Environment

- `DATABASE_URL`: private Neon PostgreSQL URL, provided by the Vercel Neon integration.
- Other Neon integration environment variables may be present but are not exposed to the browser.
- No AI provider key or authentication service is required. Stockfish runs on visitors' devices.

Never commit `.env.local`, `.vercel`, or authentication files. The downloadable source archive uses an explicit allowlist; it contains only the example environment file, not real credentials. Generated engine/source artifacts are rebuilt during deployment, not uploaded from an untrusted local build directory.

## Verification

```sh
# Local production build and browser workflows
npm run build
npm run test:e2e

# Run the same tests against a public release, without a login or bypass header
BASE_URL=https://knightfall-chess-three.vercel.app npm run test:e2e
BASE_URL=https://knightfall-chess-three.vercel.app node scripts/check-accessibility.mjs
```

The tests cover actual WebAssembly Stockfish replies and analysis, legal move handling, special moves, checkmate, PGN, saved history, desktop/mobile rendering, private online seats, concurrent move submission, spectator restrictions, reconnects, draw acceptance, and engine-load failure recovery. API integration tests use synthetic players whose names start with `E2E`.

## Operations and limitations

- GET `/api/health` checks database connectivity and reports durable storage.
- Rooms use versioned compare-and-swap writes; concurrent requests cannot both apply to the same position.
- Seat capabilities are 256-bit random tokens, hashed in PostgreSQL, stored privately in the player's browser, and never included in the invite link or spectator response.
- Room links expire after 7 days. Expired room data and short-lived rate-limit counters are deleted opportunistically during room creation/writes, not by a paid scheduled job.
- Friend rooms poll about every 1.8 seconds while visible, less often while hidden/finished. This is casual, unrated chess, not a competitive low-latency tournament service.
- History/analysis lives in browser storage (100 games). Export PGN for durable personal backups. Clearing browser data loses history and online seat credentials.
- Server clocks remain authoritative through disconnects. Local/computer clocks also continue after leaving the tab; there is no pause during a timed game.
- Synthetic release-test rooms can be deleted using exact recorded room IDs or the reserved `E2E` test-name prefix in this dedicated database. Never truncate room tables with real games present.