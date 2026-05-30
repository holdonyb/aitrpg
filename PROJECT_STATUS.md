# PROJECT_STATUS

## Goal

Ship an initial production-ready AITRPG web system with:

- docs-first product definition
- Next.js frontend
- NestJS backend
- PostgreSQL, Redis, BullMQ infrastructure
- email-code auth
- campaign, character, room, ledger, and media job flows

## Current Slice

Implemented:

- docs and runtime scaffolding
- shared schema package
- PostgreSQL-backed auth, campaigns, rooms, share links, and spectator comments
- persisted character portraits backed by PostgreSQL
- first-pass ledger and media job APIs
- room visibility, share links, password-gated spectator access, and spectator comments
- spectator room route in the web app
- local/dev file-store fallback for auth, campaigns, rooms, ledger, share, comments, portraits, and media jobs
- end-to-end coverage for auth, room sharing, spectator comments, restart persistence, portrait persistence, artifact sharing, and restore flows
- multi-page web workspace:
  - `/` login + campaign list
  - `/campaigns/[campaignId]` character forge + room list
  - `/rooms/[roomId]` Story Ledger + Co-DM + afterplay + share
- SMTP-capable email delivery for login codes with `debug` and `smtp` modes
- Resend-backed email delivery for login codes with explicit sandbox/verified-domain error reporting
- verified Resend sender domain `aitrpg.ifix.xin` with production sender `AITRPG <login@aitrpg.ifix.xin>`
- GitHub Actions deploy secrets for Resend email delivery
- local web-to-api proxy for browser QA via `API_PROXY_TARGET`
- browser smoke verified for:
  - `/` system bootstrap, email-code login, campaign creation
  - `/campaigns/[campaignId]` character creation, portrait generation, room creation
  - `/rooms/[roomId]` room workspace load, DM input panel, afterplay controls, share panel

Next:

- persist story ledger and afterplay/media job flows with the same Prisma path
- connect portrait and afterplay jobs to stored assets
- add admin health surfaces and independent review workflow
- continue browser QA deeper into room events, spectator view, and artifact sharing

## Risks

- provider-specific image/video behavior may vary by configured model
- email delivery and object storage need environment-specific production credentials
- video generation is the most likely place to require provider-specific follow-up

## Next Validation

- workspace install succeeds
- shared package builds
- API tests pass
- web lint passes
- API e2e passes in explicit `DATA_STORE_MODE=file` local mode

