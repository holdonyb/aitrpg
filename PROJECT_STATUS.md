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
- independent Codex review fixes:
  - portrait generation now checks campaign DM ownership
  - character list/create and room mutation APIs require the owning DM
  - file-store fallback is limited to store connectivity/timeouts, not Prisma constraint errors
  - API package scripts generate Prisma client before test/build
- schema validation errors now return structured `400` responses instead of leaking as `500`
- browser smoke verified for:
  - `/` system bootstrap, email-code login, campaign creation
  - `/campaigns/[campaignId]` character creation, portrait generation, room creation
  - `/rooms/[roomId]` room workspace load, DM input panel, afterplay controls, share panel
- local API chain verified end-to-end for:
  - campaign creation
  - character creation + portrait
  - room creation + ledger event
  - Co-DM suggestions
  - room share + password access
  - spectator comment
  - afterplay illustration + artifact share
- browser QA verified on local production web (`next start`):
  - direct entry to `/campaigns/[campaignId]` now restores token-backed workspace data after refresh
  - `/rooms/[roomId]` loads ledger and afterplay state
  - room share link generation renders correctly
  - spectator page password unlock and comment posting both work in-browser
  - artifact share page loads shared metadata and prompt content
- operator surface implemented:
  - `/api/system/health` returns runtime checks, totals, and media job counts
  - `/api/system/review-reports` supports authenticated create/list
  - `/admin` shows health data and persisted review report history
- review reports now support:
  - `SYSTEM / ROOM / ARTIFACT` targets
  - persisted `OPEN / RESOLVED`回流状态
  - backend resolve action and admin-side resolution button
- review runs now support:
  - authenticated create/list APIs
  - automatic write-back into linked review reports
  - target-aware room/artifact/system snapshots
  - room page one-click launch into independent review flow
  - admin-side auto refresh while tasks are queued/running
  - linked report anchors and room-page deep links for target inspection
- invite-only onboarding now supports:
  - invite-code gating before verification-code send for first-time users
  - existing-user login without invite re-entry
  - invite consumption only after first successful verification
  - seed invite codes via `INVITE_CODE_SEEDS`
  - operator invite-code create/list/disable controls in `/admin`

Next:

- persist story ledger and afterplay/media job flows with the same Prisma path
- connect portrait and afterplay jobs to stored assets
- continue browser QA deeper into room events, spectator view, artifact sharing, and review-run regression loops

## Risks

- provider-specific image/video behavior may vary by configured model
- email delivery and object storage need environment-specific production credentials
- video generation is the most likely place to require provider-specific follow-up
- production onboarding now depends on setting `INVITE_CODE_SEEDS` or creating invite codes from an existing operator account

## Next Validation

- workspace install succeeds
- shared package builds
- API tests pass
- web lint passes
- API e2e passes in explicit `DATA_STORE_MODE=file` local mode

