# M7 — Polish and Deploy: Implementation Plan

Status: **planned 2026-10-04 (tooling decisions approved).** Not started.
Parent plan: `docs/STAGE-1-PLAN.md`, section 5 (M7) and section 6 (Quality
and deploy acceptance). Builds on M1–M6.

The core rule still holds: **the simulation never knows the screen exists.**

- All M7 polish happens in `src/render/`, `src/ui/` and `src/app/`.
- `src/sim/` is touched only by the balance pass, and only through `BALANCE`
  values.

---

## 1. Approved tooling decisions (2026-10-04)

| Tool | Decision | Notes |
|---|---|---|
| `@playwright/test` | **Install now, dev dependency only** | Uses the locally installed Google Chrome (`channel: 'chrome'`), so there's no browser download. Never imported by `src/`, so it can't reach the production bundle (a guard test enforces this). Used for M7 smoke and regression tests, then against the Vercel preview URL. |
| `rollup-plugin-visualizer` | **Defer** | First use Vite's build log plus Rolldown's built-in chunking. Add it only if the bundle warning can't be explained or improved that way. |
| `pixi-filters` | **Defer** | Use built-in PixiJS for shadows, pop-in, dust, highlights and general polish. Reconsider only for a specific effect that's hard to build cleanly without it. |
| PixiJS AssetPack | **Skip for Stage 1** | There are no external image or audio assets yet. Revisit in Stage 2 if real asset pipelines are needed. |
| Vercel | **Use the existing CLI (53.4.0)** | Not a project dependency. Logged in as `andrerlaster-lgtm`. The project isn't linked yet; `.vercel/` is already gitignored. |

No other dependencies.

## 2. Scope

1. Playwright smoke tests, run locally against a production build and later
   against the deployed preview.
2. Building pop-in animation.
3. Demolish dust puff.
4. UI transitions (panels, menu, toasts).
5. Number tweening in the top bar.
6. `prefers-reduced-motion` support across the renderer, CSS and tweening.
7. A unified toast system.
8. A balance pass, changing `BALANCE` values only.
9. Fix the Food stat wrapping in the top bar.
10. Reasonable bundle optimization and code splitting.
11. A private Vercel preview.
12. Playwright tests against the deployed preview.

### Not in M7

These wait for Stage 2:
- building construction states (a simulation change)
- Well-coverage and road-access overlays beyond the current hints
- per-day job-matching limits
- `pixi-filters` effects
- an AssetPack pipeline
- a production deploy (only on Andre's explicit request)

## 3. Playwright plan

### Setup

- **Dependency:** `@playwright/test` (currently 1.63.x) as a dev dependency,
  with an exact version.
- **`playwright.config.ts`** at the repo root:
  - `testDir: tests/e2e`, test files named `*.spec.ts`. Vitest only collects
    `*.test.ts`, so the two runners never pick up each other's files.
  - `use.channel: 'chrome'` uses the installed Chrome. A `PW_BUNDLED=1`
    fallback runs `npx playwright install chromium` only if Chrome ever
    breaks.
  - `baseURL` comes from `PLAYWRIGHT_BASE_URL`. If it isn't set, a
    `webServer` runs `npm run build && npm run preview -- --port 4173
    --strictPort` and tests target `http://localhost:4173`. That's the
    production build, not the dev server.
  - `extraHTTPHeaders['x-vercel-protection-bypass']` is set from
    `VERCEL_AUTOMATION_BYPASS_SECRET` when present, for the protected
    preview.
  - Each test gets a fresh browser context, so IndexedDB starts empty.
    Workers run in parallel.
- **Scripts:**
  - `test:e2e` runs `playwright test`.
  - `test:e2e:preview` runs the same suite with `PLAYWRIGHT_BASE_URL` set.
- **Guard:** the boundaries test fails if anything in `src/` imports
  `@playwright/test`.

### Step 1: prove the environment

The first spec only checks that the game boots under Playwright on this Mac:
- the canvas has WebGL
- the IndexedDB probe answers
- timers run

Earlier one-shot headless-Chrome checks hung on IndexedDB and timers. If
Playwright headless shows the same problem, fall back to headed mode or a
persistent profile, and document what works.

### How tests drive the game (DOM only, no test hooks in the shipped game)

- The camera opens centred on the Entrance.
- Tile coordinates are read from the TileInfo chip. A `pointer` helper moves
  the mouse, reads the hovered tile, and corrects using the isometric math
  from `core/grid.ts`, until it's on the target tile.
- Assertions read the top bar, the menu, the toasts and the info panel.
- Nothing like `window.__game` is added to the production bundle.

### Smoke suite (each test about 10 s or less, using 3× speed)

1. **Boots:**
   - canvas visible, no console errors
   - top bar shows treasury 5,000 and the date
   - the Entrance is on screen
2. **Clock:**
   - 1× advances the hour
   - Space pauses, and the hour stops
   - 3× advances faster
3. **Build:**
   - drag a road from the Entrance, and the treasury drops by 10 per tile
   - place a Cottage, a Farm and a Workshop on it
   - within a few game days at 3×, population is above 0 and the Farm
     panel shows food per day
4. **Save and continue:**
   - save to Slot 1 and note the seed
   - reload the page
   - the game continues paused (⏸) on the same date, with the same seed
   - Slot 1 shows that seed
5. **New game with a seed:**
   - typing seed 12345 starts a running game
   - the menu shows seed 12345
6. **Reduced motion:** with `emulateMedia({ reducedMotion: 'reduce' })`,
   there are no CSS transitions or animations, and top-bar numbers jump
   instead of tweening.
7. **Layout:** at a 400 px viewport, the Food stat is a single line and no
   panel overflows horizontally.
8. **Toasts:** a failed action, for example a building with no road access,
   shows an error toast that disappears on its own.

### Regression habit

Every M7 step must keep `npm run test:e2e` green. Store screenshots of
failures as test artifacts (gitignored), and use them for visual review.

## 4. Visual polish plan (built-in PixiJS, CSS and React only)

### Shared motion helpers

- `src/render/anim.ts`: pure easing functions (`easeOutBack`,
  `easeOutCubic`), tested in Node, plus a tiny `Tween` runner driven by
  `app.ticker`.
- `src/app/motion.ts`: `prefersReducedMotion()`. It reads `matchMedia` once
  and updates when the setting changes. This is the one source used by the
  renderer, React hooks and CSS.

### Building pop-in

- When `place-building` succeeds, the building's sprite eases its scale from
  0.6 to 1 with `easeOutBack`, and its alpha from 0 to 1, over about 280 ms.
- It's anchored at the footprint's bottom corner, so it grows out of the
  ground.
- `Game.commit` passes the new building id to `Renderer.animateBuildingIn(id)`.
  `ObjectLayer` keeps the animation when it rebuilds sprites.
- With reduced motion, the building appears instantly.

### Demolish dust puff

- Over each removed footprint (and at a smaller size over removed roads),
  6–10 soft `Graphics` circles in palette soil tones drift up and out while
  fading, over about 450 ms. Particles are pooled.
- With reduced motion, there's no puff.

### Shadows

Contact shadows are already baked into the building textures. Only tune
their alpha and size for consistency. No filters.

### UI transitions

- Shared CSS keyframes, `panel-in` (fade plus about 6 px slide), for:
  - Economy, Citizens and Save panels
  - the info panel
  - the build menu
  - toasts
- Duration 160–220 ms, using the existing `--ease-out` token.

### Top-bar number tweening

- A `useTweenedNumber(value, ms = 400)` hook (`requestAnimationFrame`, UI
  layer only) for treasury, population, free housing, open jobs and food.
- Values always round to whole coins and people.
- The final value is always exact.

### Reduced motion

- **CSS:** one `@media (prefers-reduced-motion: reduce)` block that turns off
  transitions and animations app-wide. `hud.css` already has two of these
  blocks; they get consolidated.
- **Renderer:** pop-in, dust and the hover pulse are skipped.
- **Hooks:** values update instantly.

### Unified toast system

- `src/app/toasts.ts`: a `ToastStore` with a queue of at most 3 visible
  toasts.
  - Kinds: info, success, warning, error.
  - Auto-dismiss after 4 s (6 s for errors), plus a close button.
  - Duplicates within 1 s are merged.
- `src/ui/Toasts.tsx` renders them in an `aria-live="polite"` region, with
  `role="alert"` for errors.
- **What sends toasts:**
  - SaveService: saved, loaded, autosave failed, saving unavailable
  - failed commands: the reason text, for example "Needs road access" or
    "Not enough money"
  - the treasury going into debt ("Funds empty — immigration paused"),
    once per transition
- The ad-hoc `save-toast` is removed. The persistent debt banner stays.

### Food stat wrapping fix

- Render it like the treasury stat: the main value, with the daily change in
  a `<small>` (for example "30" and "+12/day").
- Use `white-space: nowrap`.
- Check the narrow two-column top-bar layout.
- Covered by Playwright test 7.

## 5. Balance pass (`BALANCE` values only)

- **Allowed changes:** values in `src/data/balance.ts` only. Building
  definitions, rules and code stay as they are.
- **Method:** a test-only balance report (`tests/sim/balance.test.ts`) runs
  scripted towns for 60 days. It logs, by day:
  - population
  - treasury
  - net per day
  - food
  - departures
- **Starting targets** (Andre to confirm during the pass):
  1. A starter town (a few houses, 1 Farm, 1 Workshop) becomes net-positive
     within about 10 game days, and never runs out of money if the player
     builds nothing more.
  2. A town of only houses slowly loses money: upkeep exceeds the resident
     tax.
  3. Food stays positive with 1 Farm per about 10–12 citizens.
  4. Population levels off and doesn't oscillate wildly.
- **Must keep passing:** the existing Stage 1 citizen scenario tests.
- **Record:** every changed value goes in PROJECT_STATE.md, with old → new
  and the reason.

## 6. Bundle plan (built-in Vite and Rolldown first)

- **Baseline:** one main JS chunk of 627 kB (186 kB gzipped), which triggers
  the 500 kB warning.
- **Step 1, vendor split** using Rolldown's own chunk grouping
  (`build.rolldownOptions.output.advancedChunks` or `codeSplitting`, as
  Vite 8 supports). Three groups:
  - `pixi` (pixi.js and pixi-viewport)
  - `react` (react, react-dom, scheduler)
  - the app
  This lets browsers cache the libraries across our releases.
- **Step 2, measure** each chunk's raw and gzipped size from `vite build`.
- **Step 3, if the `pixi` chunk alone is still over 500 kB,** check Pixi 8's
  tree-shaking options, such as not importing unused renderer or extension
  bundles. If it's still Pixi's own baseline, set `chunkSizeWarningLimit`
  for that known chunk, with a comment giving the measured size. Don't
  silence it globally.
- **Step 4, only if the split can't explain or reduce the size:** propose
  `rollup-plugin-visualizer` (deferred, needs approval).
- **Record:** before and after sizes in PROJECT_STATE.md. The game must load
  and pass the e2e suite after splitting.

## 7. Vercel plan (existing CLI, private preview only)

1. **Pre-flight:**
   - `npm test`, typecheck, build, `git diff --check` and `npm run test:e2e`
     all pass.
   - Confirm there are no environment variables to set (the game needs
     none).
2. **Link:** run `vercel link` in the repo.
   - Reuse an existing project if one is found; otherwise create
     `the-city`.
   - Framework: Vite. Build command: `npm run build`. Output directory:
     `dist`. Node 24.
   - `.vercel/` stays gitignored.
3. **Preview deploy:** run `vercel deploy`, without `--prod`.
   - Caveat from the Stage 1 plan: on a new project the first deployment can
     be assigned production. If that happens, remove its production alias
     (`vercel alias rm` / domain settings) and redeploy as a preview.
   - Never run `vercel --prod` unless Andre explicitly asks.
4. **Keep it private:**
   - Vercel Authentication (Deployment Protection) stays on, so previews
     need a Vercel login.
   - For automated tests, create a "Protection Bypass for Automation"
     secret. Store it only in local env (`.env.local`, gitignored) as
     `VERCEL_AUTOMATION_BYPASS_SECRET`. Never commit it.
5. **Smoke test the preview:**
   `PLAYWRIGHT_BASE_URL=<preview-url> npm run test:e2e:preview`.
   The same suite runs against the live preview, including IndexedDB saves
   on that origin.
6. **Record:** the preview URL, deployment id and test result go in
   PROJECT_STATE.md's Vercel section.
7. **If the build fails on Vercel,** read the build logs with
   `vercel inspect <url> --logs` before changing anything.

## 8. Suggested order

1. Playwright harness, plus spec 1 (prove the environment).
2. The full smoke suite against the local production build.
3. Bundle split and measurement.
4. Motion helpers and reduced-motion support.
5. Then:
   - pop-in
   - dust
   - UI transitions
   - number tweening
   - the Food stat fix
6. The unified toast system.
7. The balance pass.
8. The private Vercel preview, then Playwright against the preview.

Each step keeps `npm test`, typecheck, build and `test:e2e` green.

## 9. Acceptance criteria

1. Playwright, a dev dependency using local Chrome, runs the smoke suite
   green against the local production build and against the private Vercel
   preview. Nothing in `src/` imports it.
2. Buildings pop in, demolition leaves a dust puff, and panels and toasts
   transition in. All of it is off under `prefers-reduced-motion`.
3. Top-bar numbers tween to exact final values.
4. One toast system handles save, load, command-failure and debt messages,
   using an accessible live region.
5. The Food stat never wraps, including at 400 px wide.
6. The balance pass meets the agreed targets using `BALANCE` changes only,
   and the existing scenario tests still pass.
7. The bundle is split into vendor and app chunks, with the before and after
   sizes recorded. The 500 kB warning is fixed, or justified for Pixi's own
   chunk only.
8. A private, protected Vercel preview URL exists. No production deploy was
   made.
9. `src/sim/` stays pure. Tests, typecheck and build pass, and no file is
   over 400 lines.
