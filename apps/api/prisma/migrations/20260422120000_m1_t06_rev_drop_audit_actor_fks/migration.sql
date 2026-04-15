-- M1-T06 revision — Audit/actor UUIDs are not all `creator` rows (system, future reviewer, etc.).
-- Drop FKs from generic actor columns; keep FKs only on true ownership (`stories.creator_id`, `story_brief.creator_id`).
-- Remove synthetic `creator` rows from the original M1-T06 backfill that are not referenced as owners.

-- DropForeignKey (IF EXISTS for databases that never had these constraints)
ALTER TABLE "story_draft" DROP CONSTRAINT IF EXISTS "story_draft_last_edited_by_fkey";

ALTER TABLE "revision_entry" DROP CONSTRAINT IF EXISTS "revision_entry_created_by_fkey";

ALTER TABLE "source_record" DROP CONSTRAINT IF EXISTS "source_record_added_by_fkey";

-- Delete legacy backfill creators that are not story/brief owners (audit-only UUIDs from pre-revision DBs)
DELETE FROM "creator" c
WHERE c.email LIKE 'legacy+%@migrated.storywall.local'
  AND NOT EXISTS (SELECT 1 FROM "stories" s WHERE s.creator_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM "story_brief" b WHERE b.creator_id = c.id);
