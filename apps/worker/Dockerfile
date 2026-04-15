# Worker — build from repository root: docker build -f apps/worker/Dockerfile .
FROM node:20-bookworm-slim
RUN corepack enable pnpm
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/config ./packages/config
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker
# Worker postinstall: prisma generate --schema ../api/prisma/schema.prisma
# Prisma requires a package.json next to the schema path so it does not try (and fail) to auto-install under /app/apps.
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/prisma ./apps/api/prisma

RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @storywall/shared build
RUN pnpm --filter @storywall/worker build

ENV NODE_ENV=production
WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]
