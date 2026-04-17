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

### M5-T06 local E2E (research → synthesis package → chronology)

Checked-in script: `apps/api/scripts/e2e-m5-t06-research-chronology.mjs` (also `pnpm --filter @storywall/api run e2e:m5-t06`).

**What it proves:** bounded retrieval (live when configured), persisted `research_synthesis_package` (`m5-t05-v1`), chronology extraction at `m5-t06-v1` with M5-T06 `context_label` / `creator_note` provenance and `[temporal]` honesty markers, plus persisted **`draft_enrichment_package`** (`m5-t08-v1`: M5-T07 scaffolding + **M5-T08** per-node `provenance` / `support_status`) and companion **`draft_enrichment_provenance`** flat index on `GET …/package` for creator audit.

**Operational:** restart the **worker** after deploy so the queue runs the build that persists M5-T08 shapes; keep **API and worker on the same `REDIS_URL` logical DB** (see isolation rule below) so jobs are not acked by a stale worker binary.

**Prerequisites**

- **Postgres:** use an empty or dedicated database for this flow; run `pnpm db:deploy` (or `pnpm db:migrate`) so schema includes M5-T05 (`research_synthesis_package`).
- **API + worker** both running, with **identical** `DATABASE_URL` on both processes.
- **Live Wikipedia (recommended for this script’s live assertions):** on **both** API and worker, set `STORYWALL_RETRIEVAL_ENABLED=true`, `STORYWALL_RETRIEVAL_ALLOWED_API_HOSTS` (must allow `en.wikipedia.org` for the bundled adapter), and `STORYWALL_RETRIEVAL_USER_AGENT` per `.env.example`. If retrieval is stub, the script still passes synthesis/chronology checks but skips the live Wikipedia URL assertion.
- **`JWT_SECRET`** (and other API env) set for the API process.

**Redis isolation (required for reliable local runs)**

BullMQ uses Redis. If API and worker do **not** share the same `REDIS_URL` **and** `DATABASE_URL`, or if another stale worker on the same logical Redis DB consumes jobs, you can see **Bull jobs “completed” in Redis while `research_job` stays `pending`** and no rows appear in your intended Postgres — a false-positive from the script’s point of view.

Recommended practice:

1. Point **API and worker** at the same URL, e.g. `REDIS_URL=redis://127.0.0.1:6379/15` (dedicated **logical database 15**, not default `0`).
2. Optionally clear only that DB before a run: `redis-cli -n 15 FLUSHDB`.
3. Run the script from the same machine; it **refuses** default Redis DB `0` unless you set `STORYWALL_E2E_ALLOW_REDIS_DB0=true` to acknowledge the risk.

**Example (three terminals)**

```bash
# 0) Optional: flush isolated queue DB only
redis-cli -n 15 FLUSHDB

# 1) Export once (adjust DATABASE_URL for your Postgres)
export DATABASE_URL='postgresql://USER:PASS@127.0.0.1:5432/storywall_m5t06_e2e'
export REDIS_URL='redis://127.0.0.1:6379/15'
export JWT_SECRET='change-me-in-development-min-32-chars-long'
export STORYWALL_RETRIEVAL_ENABLED=true
export STORYWALL_RETRIEVAL_ALLOWED_API_HOSTS=en.wikipedia.org
export STORYWALL_RETRIEVAL_USER_AGENT='StorywallM5T06E2E/1.0 (+https://your-domain.example)'

# 2) API
pnpm --filter @storywall/api start

# 3) Worker (same DATABASE_URL + REDIS_URL + retrieval vars)
pnpm --filter @storywall/worker start

# 4) E2E (from repo root)
API_URL=http://127.0.0.1:3001 pnpm --filter @storywall/api exec node ./scripts/e2e-m5-t06-research-chronology.mjs
```

Success ends with `OK: M5-T06 research → synthesis → chronology → M5-T07/M5-T08 draft enrichment + provenance e2e passed.`

## Health checks (Railway)

- **API:** `GET /health` → JSON with `ok`, `service`, `api_version`, `generated_at` (aligns with public envelope fields in `storywall_api_response_contracts_homepage_timeline.md`).
- **Readiness (DB):** `GET /health/ready` → `200` when PostgreSQL is reachable (`PrismaService` / M1-T01); `503` if not. Use after `pnpm db:deploy` on deploy.

Set the deployment **health check path** to `/health` and **port** from `PORT` (default `3001`).

**API start command (staging/production):** Use the package **`start`** script from `apps/api` (for example `pnpm --filter @storywall/api start` or Railway **Start Command** `pnpm start` with root directory `apps/api`). It runs **`prisma migrate deploy`** before `node dist/main.js`, so the database schema is not left behind application code. Avoid a bare `node dist/main.js` start unless you run an equivalent release-phase migration step.

**Railway dashboard (API service):** Confirm **Start Command** is not overriding the migration-aware path with bare `node dist/main.js`. Prefer the **Dockerfile** entrypoint (repo `apps/api/Dockerfile` already runs `prisma migrate deploy` before `node`) or **`pnpm start` / `pnpm --filter @storywall/api start`** from the monorepo root. **Root directory** should match how you build (repo root for `pnpm --filter`, or `apps/api` for `pnpm start` in that package).

**Staging / exemplar readiness check (no secrets):** After deploy, `GET /health/ready` on the API host should return **200** with `database` reachable. Then run the built-in smoke against that host (registers disposable test accounts, calls **POST `/api/v1/creator/stories`**, and exercises brief PATCH semantics):

```bash
API_URL="https://YOUR-API-HOST" node apps/api/scripts/smoke-creator-slice.mjs
```

Success ends with `OK: creator slice smoke passed.` A missing `published_body_snapshot` column (or other schema drift) typically surfaces as a **500** on that create path instead. The web client’s configured API base is embedded at build time in `VITE_API_URL`; use that host or your Railway service URL.

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
