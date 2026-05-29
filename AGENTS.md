# AGENTS.md - ATRPG

## Project Focus

ATRPG is a production-oriented web app for AI-assisted tabletop roleplay.
The primary user experience is a real-time text room with a human DM, human players, and AI agents acting as party members, NPCs, or a co-DM.

## First Read

Before changing product behavior, read:

1. `README.md`
2. `PROJECT_STATUS.md`
3. `docs/prd.md`
4. `docs/system-design.md`
5. `docs/ui-prototype.md`

## Rules

- Preserve the docs-first workflow. Product behavior changes must update docs when durable behavior changes.
- Keep AI provider details behind the API layer. Never place secrets in frontend code.
- Treat real-time room flow as the primary product surface. Async media generation must not block room interaction.
- Favor Chinese UI copy, English code and schema names.

## Commands

- `pnpm install`
- `pnpm --filter @atrpg/shared build`
- `pnpm --filter api test`
- `pnpm --filter web lint`

