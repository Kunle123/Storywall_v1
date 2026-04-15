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
# Vite embeds `import.meta.env.VITE_*` at build time. Railway passes service env into `docker build`
# only for declared ARGs; without this, the bundle falls back to relative `/api/v1`.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @storywall/web build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
