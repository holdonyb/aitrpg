# AITRPG

AITRPG is a web-based AI tabletop RPG platform for real-time text sessions with a human DM, human players, and AI-controlled party members or NPCs.

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
pnpm --filter @aitrpg/shared build
pnpm --filter api test
pnpm --filter web lint
pnpm --filter api build
pnpm --filter api start
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
- PostgreSQL-backed API foundation for auth, campaigns, characters, rooms, sharing, and spectator comments
- persisted character portrait generation with local SVG portrait assets
- API foundation for ledger and media jobs
- web foundation for key product surfaces

## Email Delivery

The login flow supports two modes:

- `EMAIL_DELIVERY_MODE=debug`: the API returns `debugCode` for local development
- `EMAIL_DELIVERY_MODE=smtp`: the API sends the code through SMTP and does not expose the code in the response
- `EMAIL_DELIVERY_MODE=resend`: the API sends the code through the Resend Email API and does not expose the code in the response

Recommended setup:

- local development: `Mailpit` or any local SMTP sink
- production starter tier: `Resend API` or `Brevo SMTP`

Notes:

- Resend API mode requires `RESEND_API_KEY`
- Resend also requires a valid `EMAIL_FROM` sender, usually from a verified domain
- For initial testing, Resend documents `onboarding@resend.dev` as the sample sender in their Node.js guide
- Until you verify a domain in Resend, sandbox delivery is limited to the account owner email
- Production setup should switch `EMAIL_FROM` to a sender on your verified domain, for example `AITRPG <login@aitrpg.ifix.xin>`
- This deployment is configured for the verified sender domain `aitrpg.ifix.xin`
