# Prisma migrations (Storywall API)

Source: `storywall_database_migration_plan_actual_stack.md` (committed migrations, PostgreSQL, Phase rollout).

## Commands

| Command | When |
|---------|------|
| `pnpm prisma migrate dev` | Local development — creates migrations from schema changes and applies them |
| `pnpm prisma migrate deploy` | Staging/production (e.g. Railway release step) — applies pending migrations only |
| `pnpm prisma generate` | After pulling migrations or changing `schema.prisma` |

Run from `apps/api` or via root scripts in `package.json`.

## Ticket boundaries

- **M1-T01:** Migration **framework** + extension baseline (`pgcrypto`). No editorial tables.
- **M1-T02:** Core **`stories`** table + enums (`SubjectType`, `StoryLifecycleStatus`, `StoryVisibility`, `CreatorWorkflowState`).
- **M1-T03:** **`story_brief`** (1:1 with `stories`), **`story_frame_draft`** (many per brief); partial unique index: at most one `is_selected` row per brief.
- **M1-T04:** **`story_draft`** (1:1 `story_brief`), **`revision_entry`** (many per draft); `selected_frame_id` → `story_frame_draft` (RESTRICT on delete).
- **M1-T05:** **`section_draft`**, **`image_proposal`**, **`event_draft`** (→ optional `section_draft`, optional `image_proposal` for primary media), **`source_record`** (→ `event_draft`); draft-layer only (no `story_topic_tags` here).
- **M1-T06:** **`creator`** + FKs on **ownership only**: `stories.creator_id`, `story_brief.creator_id`. Audit fields (`story_draft.last_edited_by`, `revision_entry.created_by`, `source_record.added_by`) stay plain UUIDs (creator / system / future roles). Follow-up migration `20260422120000_*` drops mistaken actor FKs and prunes orphan synthetic `creator` rows from the first M1-T06 backfill.

## Railway

Use `prisma migrate deploy` before starting the API process so schema matches code. Keep `GET /health` for liveness; use `GET /health/ready` to verify database connectivity after deploy.
