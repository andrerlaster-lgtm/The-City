# The-City — Codex Rules

## Role

Codex is primarily responsible for:

- Focused implementation
- Bug fixes
- Tests
- Small refactors
- Mechanical code changes

## Before Work

Read:

- PROJECT_STATE.md
- docs/STAGE-1-PLAN.md
- package.json
- relevant source files
- git status

Do not start coding until the current milestone and task are clear.

## Architecture Rules

The simulation must remain independent from rendering and UI.

Keep:

- `src/sim/` pure TypeScript
- `src/render/` for Pixi
- `src/ui/` for React
- `src/app/` for composition

Never add:

- React to simulation code
- Pixi to simulation code
- DOM/browser APIs to simulation code
- `Math.random()` to deterministic simulation systems

## Coding Rules

- Keep files under 400 lines.
- Use existing patterns first.
- Do not add dependencies without approval.
- Do not rewrite working systems unnecessarily.
- Add tests for new simulation logic.
- Keep changes scoped to the requested task.

## Validation

Before calling a task complete, run:

```bash
npm test
npm run typecheck
npm run build