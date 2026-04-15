# Static web — build from repository root: docker build -f apps/web/Dockerfile .
FROM node:20-bookworm-slim AS build
RUN corepack enable pnpm
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/config ./packages/config
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @storywall/shared build
RUN pnpm --filter @storywall/web build

FROM nginx:1.27-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
