# Storywall v1

AI-first, creator-led **non-fiction** stories with mandatory **timeline** and **references**, human final edit control, and first-class **trust** signals. Implementation follows `/docs` (see **Implementation Brief** in development notes below).

## Repository layout

| Path | Role |
|------|------|
| `apps/web` | React + Vite + TypeScript (mobile-first UI) |
| `apps/api` | Node + NestJS + Prisma + PostgreSQL |
| `apps/worker` | Redis (BullMQ) background jobs for AI/validation/derivatives |
| `packages/shared` | Shared types, enums, `API_CONTRACT_VERSION` |
| `packages/config` | Shared `tsconfig` base |
| `docs/` | Product and contract source of truth |

## Stack

- **Web:** React 19, Vite 6, TypeScript  
- **API:** NestJS 11, TypeScript, Prisma, PostgreSQL  
- **Jobs:** BullMQ + Redis (queue); DB-backed job state in later milestones  
- **Storage:** S3-compatible (local MinIO in Docker Compose)  
- **Auth:** Standards-based session/JWT in M1+ (not scaffolded in M0)  
- **Deploy:** Dockerfiles per app; **Railway**-friendly (`PORT`, health check)

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 9+
- Docker (optional, for Postgres / Redis / MinIO)

## Local setup

1. Clone and install:

   ```bash
   pnpm install
   pnpm --filter @storywall/shared build
   ```

2. Copy environment:

   ```bash
   cp .env.example .env
   ```

3. Start infrastructure (optional):

   ```bash
   docker compose up -d
   ```

4. Apply database migrations (when Postgres is up):

   ```bash
   pnpm db:deploy
   ```

   Local development (creates/applies migrations from `apps/api/prisma/schema.prisma`):

   ```bash
   pnpm db:migrate
   ```

   See `apps/api/prisma/MIGRATIONS.md` (M1-T01 migration framework).

5. Run apps in separate terminals or use filtered dev:

   ```bash
   pnpm --filter @storywall/api dev
   pnpm --filter @storywall/web dev
   pnpm --filter @storywall/worker dev
   ```

## Health checks (Railway)

- **API:** `GET /health` → JSON with `ok`, `service`, `api_version`, `generated_at` (aligns with public envelope fields in `storywall_api_response_contracts_homepage_timeline.md`).
- **Readiness (DB):** `GET /health/ready` → `200` when PostgreSQL is reachable (`PrismaService` / M1-T01); `503` if not. Use after `pnpm db:deploy` on deploy.

Set the deployment **health check path** to `/health` and **port** from `PORT` (default `3001`).

**API start command (staging/production):** Use the package **`start`** script from `apps/api` (for example `pnpm --filter @storywall/api start` or Railway **Start Command** `pnpm start` with root directory `apps/api`). It runs **`prisma migrate deploy`** before `node dist/main.js`, so the database schema is not left behind application code. Avoid a bare `node dist/main.js` start unless you run an equivalent release-phase migration step.

## Docker images

From the repository root:

```bash
docker build -f apps/api/Dockerfile -t storywall-api .
docker build -f apps/web/Dockerfile -t storywall-web .
docker build -f apps/worker/Dockerfile -t storywall-worker .
```

## Implementation order

Follow `docs/storywall_ticket_ready_implementation_backlog.md` (M0 → M1 → …). After trust/public work through **M3-T14** and bridge **M4-T01**, milestone **M4** is **Creator Workflow Foundation** — see `docs/storywall_m4_creator_workflow_foundation.md` (next ticket **M4-T02**). Do not prioritize homepage polish before the creator-to-publish vertical slice (`storywall_cursor_master_prompt_and_workflow.md`).

## Doc conflict note

`storywall_sprint_by_sprint_build_matrix.md` orders an early “reader foundation” sprint before creator intake; the **ticket backlog** and **master prompt** prioritize backend + creator workflow before broad reader polish. Treat the backlog sequence as authoritative for implementation. The matrix header notes alignment with the updated **M4** definition (April 2026).

## Repository checkpoint (review)

**Branch `checkpoint/m1-t09-current-state`:** codebase as of creator foundation through **M1-T09** (brief intake UI + M1-T06–M1-T08 API slice). Feature work pauses here so GitHub is the review surface; later tickets (e.g. M1-T10+) continue from this baseline. Copy `.env.example` to `.env` locally — committed secrets are not used.
