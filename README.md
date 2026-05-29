# ATRPG

ATRPG is a web-based AI tabletop RPG platform for real-time text sessions with a human DM, human players, and AI-controlled party members or NPCs.

## Stack

- Frontend: Next.js + TypeScript
- Backend: NestJS + TypeScript
- Shared types: workspace package with Zod schemas
- Database: PostgreSQL + Prisma
- Queue: Redis + BullMQ
- Deployment: Docker Compose

## Workspace

- `apps/web`: player and DM web app
- `apps/api`: HTTP, WebSocket, auth, orchestration, jobs
- `packages/shared`: shared schemas and DTO contracts
- `docs`: PRD, system design, UI prototype
- `infra`: Docker Compose and deployment assets

## Commands

```bash
pnpm install
pnpm --filter @atrpg/shared build
pnpm --filter api test
pnpm --filter web lint
pnpm --filter api start:dev
pnpm --filter web dev
```

## Local URLs

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/system`
- Mailpit: `http://localhost:8025`
- MinIO Console: `http://localhost:9001`

## Docker Compose

```bash
docker compose -f infra/docker-compose.yml up --build
```

Production compose:

```bash
docker-compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up --build -d
```

## GitHub Actions

- `CI`: runs shared tests, API tests, web lint, and both builds
- `Deploy`: manual workflow for VPS deployment after repository secrets are configured

Required repository secrets for deployment:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_TARGET_DIR`
- `APP_DOMAIN`
- `LETSENCRYPT_EMAIL` if the target host does not already have a usable certbot account
- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_TEXT_MODEL`
- `OPENAI_IMAGE_MODEL`
- `OPENAI_VIDEO_MODEL`
- `JWT_SECRET`

Production deploy behavior:

- `nginx` terminates HTTPS on the host
- `certbot` issues and renews the certificate using webroot mode, or reuses an existing host account
- `web` listens on `127.0.0.1:${WEB_HOST_PORT}` and defaults to `127.0.0.1:13100` in production
- `api` listens on `127.0.0.1:${API_HOST_PORT}` and defaults to `127.0.0.1:4000`
- `nginx` proxies `/` to web and `/api/` to api

## Current Status

The repository currently contains the first implementation slice:

- product and architecture docs
- workspace scaffolding
- shared domain schemas
- API foundation for auth, campaigns, characters, rooms, ledger, and media jobs
- web foundation for key product surfaces
