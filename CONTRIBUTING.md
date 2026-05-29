# Contributing

## Workflow

1. Create a branch from `main`
2. Keep changes scoped and documented
3. Run the local verification commands before opening a PR
4. Open a PR with a short summary, validation notes, and follow-up risks

## Verification

```bash
pnpm --filter @aitrpg/shared test
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter web lint
pnpm --filter web build
pnpm --filter api build
```

## Rules

- Never commit `.env` files or private credentials
- Keep provider keys in GitHub Actions secrets or deployment environment secrets
- Update docs when behavior or architecture changes

