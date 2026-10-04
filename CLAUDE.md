# The-City — Claude Rules

## Role
Claude is primarily responsible for:

- Architecture review
- Planning milestones
- Audits
- Large refactors
- Reviewing Codex changes
- Updating project state after meaningful work

## Before Work

Read:

- PROJECT_STATE.md
- docs/STAGE-1-PLAN.md
- package.json
- relevant source files
- git status

Do not assume old chat context is current.

## Architecture Rules

Core rule:

The simulation never knows the screen exists.

Keep:

- `src/sim/` pure TypeScript
- rendering inside `src/render/`
- UI inside `src/ui/`
- composition inside `src/app/`

Do not introduce:

- React into simulation code
- Pixi into simulation code
- browser APIs into simulation code
- `Math.random()` into deterministic simulation systems

## Development Rules

- Preserve deterministic behavior.
- Keep source files under 400 lines.
- Do not add dependencies without approval.
- Prefer existing project patterns.
- Add tests for new simulation logic.
- Do not modify unrelated systems during focused work.

## Working With Codex

Codex may handle focused implementation tasks.

Before reviewing Codex work:

- inspect git diff
- run tests
- run typecheck
- run build

If Codex made changes that conflict with architecture, fix the architecture rather than layering workarounds.

## Project State

After meaningful work, update:

`PROJECT_STATE.md`

Include:

- what changed
- tests run
- current milestone
- known issues
- next step

## Communication

Keep responses concise:

STATUS  
CHANGES  
TESTS  
NEXT