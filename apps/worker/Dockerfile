# Worker — build from repository root: docker build -f apps/worker/Dockerfile .
FROM node:20-bookworm-slim
RUN corepack enable pnpm
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/config ./packages/config
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker

RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @storywall/shared build
RUN pnpm --filter @storywall/worker build

ENV NODE_ENV=production
WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]
