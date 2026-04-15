-- M1-T06 — Creator identity + FK to ownership and actor columns (mutation API §4).
-- Backfill: any UUIDs already present in stories/brief/draft/revision/source without a `creator` row get a synthetic email.

-- CreateTable
CREATE TABLE "creator" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "display_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creator_email_key" ON "creator"("email");

-- Backfill creator rows for existing FK targets (no-op on empty DB)
INSERT INTO "creator" ("id", "email", "password_hash", "display_name", "created_at", "updated_at")
SELECT DISTINCT u."id",
  'legacy+' || REPLACE(u."id"::text, '-', '') || '@migrated.storywall.local',
  NULL,
  'Migrated',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT "creator_id" AS "id" FROM "stories"
  UNION
  SELECT "creator_id" AS "id" FROM "story_brief"
  UNION
  SELECT "last_edited_by" AS "id" FROM "story_draft"
  UNION
  SELECT "created_by" AS "id" FROM "revision_entry"
  UNION
  SELECT "added_by" AS "id" FROM "source_record"
) AS u
WHERE NOT EXISTS (SELECT 1 FROM "creator" c WHERE c."id" = u."id");

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_brief" ADD CONSTRAINT "story_brief_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_draft" ADD CONSTRAINT "story_draft_last_edited_by_fkey" FOREIGN KEY ("last_edited_by") REFERENCES "creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_entry" ADD CONSTRAINT "revision_entry_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_record" ADD CONSTRAINT "source_record_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
