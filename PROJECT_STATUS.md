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

In progress:

- establishing project docs and runtime scaffolding
- shared schema package
- first-pass API modules and web surfaces

## Risks

- provider-specific image/video behavior may vary by configured model
- email delivery and object storage need environment-specific production credentials
- video generation is the most likely place to require provider-specific follow-up

## Next Validation

- workspace install succeeds
- shared package builds
- API tests pass
- web lint passes

