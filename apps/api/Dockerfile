# Build from repository root: docker build -f apps/api/Dockerfile .
FROM node:20-bookworm-slim
RUN corepack enable pnpm
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/config ./packages/config
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile || pnpm install

RUN pnpm --filter @storywall/shared build
RUN pnpm --filter @storywall/api exec prisma generate
RUN pnpm --filter @storywall/api build

ENV NODE_ENV=production
EXPOSE 3001
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
