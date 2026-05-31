# AGENTS.md - AITRPG

## Project Focus

AITRPG is a production-oriented web app for AI-assisted tabletop roleplay.
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
- User-facing pages must read like a finished product, not a build log or internal tool.
- Do not render process words such as `demo`, `debug`, `临时`, `占位`, `工作台说明`, `开发环境会直接回填`, `独立审查任务`, or similar implementation-facing copy on player, DM, spectator, or shared artifact surfaces.
- Keep internal operations language on `/admin` only. Public routes should use product language such as `冒险`, `剧情记录`, `观战`, `留言`, `角色肖像`, and `会后创作`.

## Commands

- `pnpm install`
- `pnpm --filter @aitrpg/shared build`
- `pnpm --filter api test`
- `pnpm --filter web lint`

