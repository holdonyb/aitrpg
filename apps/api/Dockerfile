FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile=false

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN pnpm --filter @atrpg/shared build
RUN pnpm --filter api build

EXPOSE 4000
CMD ["pnpm", "--filter", "api", "start:prod"]

