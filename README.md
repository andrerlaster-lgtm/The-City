# The City Life

A browser city-building simulation. The player builds the settlement; citizens
decide for themselves where to live and work. Stage 1 is the Settlement
Prototype. See [docs/STAGE-1-PLAN.md](docs/STAGE-1-PLAN.md) for the plan,
architecture, milestones and acceptance criteria.

## Run it

```bash
npm install
npm run dev        # dev server (Vite)
npm test           # simulation + architecture tests (Vitest)
npm run typecheck  # TypeScript, no emit
npm run build      # typecheck + production build into dist/
```

## Stack

TypeScript · Vite · PixiJS 8 (map) · pixi-viewport (camera) · React 19 (HUD) ·
idb-keyval (saves) · Vitest. Deploys to Vercel as a static site (private previews).

## Layout rules

- `src/sim/` is pure simulation: no Pixi, React, storage or browser globals,
  and no `Math.random` (use `core/rng.ts`). `tests/architecture` enforces this.
- The player changes the world only through commands; the renderer and UI only
  read snapshots and tick results.
- Buildings, terrain and balance numbers are data in `src/data/`.
- No source file over 400 lines (also enforced by tests).

## Status

- [x] M0 — Scaffold
- [x] M1 — World and camera
- [ ] M2 — Roads
- [ ] M3 — Buildings
- [ ] M4 — Time and economy
- [ ] M5 — Citizens (first full gameplay loop)
- [ ] M6 — Save and load
- [ ] M7 — Polish and deploy

## License

© 2026 Andre Laster. All rights reserved. The source is public for viewing
only; no license is granted to copy, modify or distribute it.
