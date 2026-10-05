# Handoff: The-City (review-only session)

## Your role
You are a **second reviewer** for The-City while another Claude Code session
does the active work. **Read and review only.**
- Don't edit, commit, push or deploy anything.
- Don't touch the `production` branch, Vercel settings or `BALANCE` values.
- Report your findings back to Andre, and he'll pass them on.
- If you think something needs changing, describe it (file, line, why, and
  the smallest fix). Don't apply it.

## Project
- **The-City** (in-game title "The City Life"): a browser isometric city
  builder.
  - The player builds roads and buildings.
  - Citizens move in, work, eat, pay taxes and leave on their own.
- **Repo:** https://github.com/andrerlaster-lgtm/The-City (public).
  Local: `/Users/andrelaster/projects/The-City`.
- **Stack:** TypeScript, Vite 8 (Rolldown), PixiJS 8, pixi-viewport, React 19,
  idb-keyval, Vitest, Playwright (dev only, local Chrome). Node 24.
- **Scripts:**
  - `npm run dev` (localhost:5199 is often already running)
  - `npm test`
  - `npm run typecheck`
  - `npm run build`
  - `npm run test:e2e`

## Read these first, in this order
1. `CLAUDE.md` and `AGENTS.md`: the rules for Claude and Codex
2. `PROJECT_STATE.md`: current state, decisions, known issues, Vercel setup
3. `docs/STAGE-1-COMPLETION.md`: the Stage 1 audit, criterion by criterion
4. `docs/STAGE-2-FEATURE-BANK.md`: the source of truth for Stage 2 ideas
5. `docs/STAGE-2-PLAN.md`: the approved Stage 2 roadmap (M1–M8) and Andre's
   9 decisions
6. `docs/S2-M1-PLAN.md`: the next milestone in detail
7. Older history, if useful: `docs/STAGE-1-PLAN.md` and `docs/M3-PLAN.md`
   through `M7-PLAN.md`

## Architecture rules (non-negotiable)
- **The simulation never knows the screen exists.** `src/sim/` is pure
  TypeScript:
  - no Pixi, React or DOM
  - no timers, `performance`, `crypto` or `Math.random`
  - this is enforced by `tests/architecture/boundaries.test.ts`
- **Layers:**
  - `src/render` (Pixi)
  - `src/ui` (React)
  - `src/app` (composition, save service, loop, toasts)
  - `src/save` (versioned save format)
  - `src/data` (building definitions and `BALANCE`)
- **Deterministic:** the same seed plus the same commands gives the same
  state. Player changes only go through `Simulation.applyCommand`.
- **Buildings are data-driven.** A new building is a data entry plus art.
- **Files stay under 400 lines.** No new dependencies without Andre's
  approval.

## Where it's at (2026-10-05)
- **Stage 1 is complete (M0–M7):** 25 criteria PASS, 3 PARTIAL, 0 FAIL.
  The game has:
  - seeded 128×128 maps
  - roads with connectivity
  - 5 buildings: Cottage, Rowhouse, Farm, Workshop, Well
  - citizens: housing, jobs matched by road distance, food, departures
  - an economy with taxes, upkeep and debt
  - pause, 1×, 2× and 3× speeds
  - saving and loading: IndexedDB, 3 slots plus autosave, versioned v1,
    paused on load, seeds made by the app
  - polish: pop-in, dust, toasts, number tweening, reduced-motion support
- **Tests:**
  - 378 unit, scenario, balance and architecture tests
  - 10 Playwright smoke tests (local, and against the protected Vercel
    preview)
  - last QA run: **PASS** at `806af94`
- **Performance:**
  - normal simulation day about 1.9 ms
  - worst case (everyone unemployed, jobs far away) about 6.4 ms, over the
    5 ms target, which S2-M1 addresses
  - 59–60 fps with 2,000 citizens
- **Latest commit:** `main` = `71d41ff` at the time of writing. It added the
  `qa` and `performance` agents in `.claude/agents/`, which you can run.
  `PROJECT_STATE.md` is always the authority for the current state.

## Deploy model (do not change)
- Push to `main` → an automatic **protected Vercel preview**. Logging in to
  Vercel is required.
- `production` is the deliberate public-release branch, at `e1fc012`.
  - It's protected on GitHub: a pull request is required, enforced for
    admins.
  - There are 0 production deployments.
  - Releases happen only on Andre's explicit request.
- Playwright reaches previews with a short-lived Vercel OIDC token
  (`tests/e2e/fixtures.ts`).

## Next: S2-M1 Foundations (not started), per `docs/S2-M1-PLAN.md`
- **Generic coverage system.** The Well becomes the first `water` service,
  with its exact current rule, so gameplay doesn't change.
- **Overlay framework,** with Water and Road connectivity overlays (and the
  `O` key).
- **Zoom-to-Entrance:** a button and the `Home` key.
- **Job matching:** cache first. Add a per-day cap only if the benchmark still
  misses 5 ms.
- **Midnight frames:** fix the long frames at day boundaries.
- **Testing:** an opt-in `@perf` Playwright fps spec, and harden the
  load-sensitive tests.
- **Acceptance:** every Stage 1 test passes **unchanged**.

## What Andre would like from you
1. Sanity-check the Stage 2 plan against the feature bank and the codebase:
   gaps, risky ordering, unrealistic milestones.
2. Review `docs/S2-M1-PLAN.md` for correctness against the actual code, in
   particular:
   - `src/sim/services/coverage.ts`
   - `src/sim/citizens/jobs.ts`, `housing.ts` and `migration.ts`
   - `src/sim/daily.ts`
   - `src/app/Game.ts`
   - `src/render/Renderer.ts`
3. Flag any architecture, determinism or performance risks you see in the
   current code.
4. Keep your output short. Use these sections:
   - FINDINGS (with severity)
   - PLAN RISKS
   - SUGGESTED CHANGES (described, not applied)
   - QUESTIONS FOR ANDRE

## Known issues (don't re-report unless you have new information)
See `PROJECT_STATE.md` → Known Issues and `docs/STAGE-1-COMPLETION.md` §5:
- the worst-case simulation day at about 6.4 ms
- occasional 49 ms frames at midnight with 2,000 citizens
- touch input isn't a target (desktop first)
- two tabs autosaving: the last write wins
- only same-size maps can be loaded
- timing tests can be flaky under heavy machine load
