# ADR 0001: Storywall v1 — Repository Architecture and Runtime Stack

**Status:** Accepted  
**Date:** 2026-04-14  
**Deciders:** Engineering (Storywall v1 program)  
**Context documents:** See [References](#references).

## Context

Storywall v1 is defined in the specification pack under `/docs`. The product requires a full-stack system: persistent editorial records, authenticated creator mutations, long-running AI and validation work, reviewer governance, and public read models that match fixed API contracts (`storywall_api_response_contracts_homepage_timeline.md`, `storywall_creator_side_mutation_api_contracts.md`). The `storywall_database_migration_plan_actual_stack.md` describes moving from a frontend-oriented scaffold to a database-backed Node/TypeScript platform with PostgreSQL, migrations, and background work.

This ADR locks **implementation architecture for this repository** so M1+ work proceeds without re-litigating baseline tooling.

## Decision

### Repository structure

| Path | Responsibility |
|------|----------------|
| `apps/web` | Mobile-first React client (Vite, TypeScript) |
| `apps/api` | HTTP API, auth integration point (M1+), Prisma/PostgreSQL, domain services |
| `apps/worker` | Redis-backed job execution (BullMQ) for research, draft assembly, validation, derivatives |
| `packages/shared` | Shared types, enums, `API_CONTRACT_VERSION` — aligned to contract docs |
| `packages/config` | Shared TypeScript baseline |
| `docs/` | Product and contract source of truth, including this ADR |

Monorepo is managed with **pnpm workspaces** (`package.json`, `pnpm-workspace.yaml`).

### Stack choices and rationale

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Web | **React + Vite + TypeScript** | Matches migration plan’s frontend direction; fast dev cycle; aligns with mobile-first delivery. |
| API | **NestJS + TypeScript** | Structured modules for routes, guards, and services; fits Railway-style single-process HTTP services. |
| Database | **PostgreSQL** | Relational model for ordered timelines, foreign keys, and auditable trust/evidence (`storywall_database_migration_plan_actual_stack.md`). |
| Persistence tooling | **Prisma** with **checked-in migrations** | Versioned DDL in-repo; repeatable deploys; matches DB-1 style expectations in the migration plan. |
| Jobs | **BullMQ + Redis** | Explicit queue for long-running generation/validation; aligns with backlog job-model tickets (e.g. M0-T07, M2+). |
| Object storage | **S3-compatible** API | Portable blobs for imagery and exports; local **MinIO** in Docker Compose for development. |
| Auth (M1+) | **Standards-based session/JWT** | Per `storywall_creator_side_mutation_api_contracts.md` (authenticated `/api/v1/creator` namespace); not part of M0 scope. |

### Portability principles

- **12-factor style config:** environment variables for `DATABASE_URL`, `REDIS_URL`, S3 credentials, secrets (`storywall_transition_to_implementation.md`, migration plan Phase 0).
- **Container-friendly:** each app ships a `Dockerfile`; builds assume **repository root** as context where noted in `README.md`.
- **No vendor lock-in at the DDL contract:** PostgreSQL + Prisma migrations remain the portable source of truth; read models stay composed in application code per migration plan and API contracts.
- **Contract versioning:** `API_CONTRACT_VERSION` in `packages/shared` tracks `storywall_api_response_contracts_homepage_timeline.md` (`api_version` field).

### Railway deployment posture

- **API service:** Node process; listen on **`PORT`**; **health check `GET /health`** returns JSON including `ok`, `service`, `api_version`, `generated_at` (consistent with success-envelope fields in `storywall_api_response_contracts_homepage_timeline.md` §3).
- **Worker service:** separate process consuming Redis (`REDIS_URL`); no HTTP requirement for liveness beyond platform defaults.
- **Web:** static build served via container image (e.g. nginx) or Railway static configuration; details per environment.
- **Add-ons:** Railway-managed **PostgreSQL** and **Redis** map directly to the above variables.

### Product sequencing: creator-to-publish before reader polish

**Decision:** Implementation priority follows **`storywall_ticket_ready_implementation_backlog.md`** and **`storywall_cursor_master_prompt_and_workflow.md`**: establish backend foundation, data model, **creator workflow**, validation/moderation, then **public read models** — do **not** prioritize homepage polish ahead of the creator-to-publish vertical slice.

**Rationale:** The PRD and creator workflow (`storywall_v1_prd.md`, `storywall_creator_workflow_specification.md`) center the product on AI-first draft generation, structured editing, trust, and publication. Reader surfaces depend on stable authored and published artifacts (`storywall_transition_to_implementation.md` Phase F).

### Document sequencing conflict and resolution

**Conflict:** `storywall_sprint_by_sprint_build_matrix.md` orders **Sprint 1 — Story object and reader foundation** before **Sprint 2 — Creator brief intake and framing**. The **ticket-ready backlog** and **`storywall_cursor_master_prompt_and_workflow.md`** explicitly warn against prioritizing reader/homepage polish before the creator-to-publish engine.

**Resolution for this repo:** Treat **`storywall_ticket_ready_implementation_backlog.md`** milestone ordering and the **master prompt** dependency order as **authoritative for engineering sequencing**. Treat the sprint matrix’s early reader sprint as **planning guidance** that conflicts with backlog priority; if the two diverge, follow the backlog unless product leadership issues a written change request.

This ADR does not change the specification documents; it records how the **implementation program** resolves an inconsistency between two internal planning artifacts.

## Consequences

### Positive

- One clear stack and repo layout for all contributors.
- Deployments can target Railway (or any container host) with minimal bespoke glue.
- Job-heavy workflows have a defined home (`apps/worker`) instead of overloading the API process.

### Negative / trade-offs

- Two runtime processes (API + worker) plus Redis increase local and production surface area versus a single monolith.
- NestJS and Prisma add framework opinions; migrating off them later would be non-trivial.

## References (exact filenames in `/docs`)

- `storywall_v1_prd.md`
- `storywall_transition_to_implementation.md`
- `storywall_ticket_ready_implementation_backlog.md`
- `storywall_cursor_master_prompt_and_workflow.md`
- `storywall_sprint_by_sprint_build_matrix.md`
- `storywall_creator_workflow_specification.md`
- `storywall_publishing_and_trust_standard.md`
- `storywall_database_migration_plan_actual_stack.md`
- `storywall_api_response_contracts_homepage_timeline.md`
- `storywall_creator_side_mutation_api_contracts.md`
- `storywall_editor_cms_input_model.md`
- `storywall_reviewer_permissions_moderation_state_contract.md`
