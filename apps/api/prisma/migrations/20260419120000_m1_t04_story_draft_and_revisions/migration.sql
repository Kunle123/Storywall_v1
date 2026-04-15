-- M1-T04 — Story draft + revision history (storywall_ticket_ready_implementation_backlog.md).
-- Editor: storywall_editor_cms_input_model.md §10.1 `story_draft`, §17 `revision_entry`.
-- Deferred: section_draft, event_draft, sources (M1-T05+).

-- CreateEnum
CREATE TYPE "DiscoveryMode" AS ENUM ('editorial', 'recent', 'trending', 'featured');

-- CreateEnum
CREATE TYPE "DraftGenerationMode" AS ENUM ('manual', 'ai_draft', 'ai_assisted', 'manual_after_ai');

-- CreateEnum
CREATE TYPE "EditorialReviewStatus" AS ENUM ('unreviewed', 'reviewed', 'approved', 'revised');

-- CreateEnum
CREATE TYPE "AutosaveStatus" AS ENUM ('saved', 'saving', 'conflict', 'error');

-- CreateEnum
CREATE TYPE "RevisionType" AS ENUM ('autosave', 'manual_edit', 'ai_regeneration', 'review_resolution', 'publish_promotion');

-- CreateEnum
CREATE TYPE "ChangedObjectType" AS ENUM ('story', 'section', 'event', 'source', 'image', 'validation', 'publish');

-- CreateTable
CREATE TABLE "story_draft" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "story_brief_id" UUID NOT NULL,
    "selected_frame_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "summary" TEXT NOT NULL,
    "lens" TEXT NOT NULL,
    "conclusion" TEXT,
    "subject_type" "SubjectType" NOT NULL,
    "category_primary" TEXT NOT NULL,
    "category_secondary" TEXT,
    "time_start" TIMESTAMPTZ(6),
    "time_end" TIMESTAMPTZ(6),
    "time_display" TEXT,
    "story_status" "StoryLifecycleStatus" NOT NULL,
    "visibility_target" "StoryVisibility" NOT NULL,
    "lead_priority" INTEGER,
    "discovery_mode" "DiscoveryMode",
    "imagery_mode" "BriefImageryMode" NOT NULL,
    "generation_mode" "DraftGenerationMode" NOT NULL,
    "generation_prompt_version" TEXT,
    "generation_model" TEXT,
    "generation_run_id" TEXT,
    "needs_human_review" BOOLEAN NOT NULL,
    "editorial_review_status" "EditorialReviewStatus" NOT NULL,
    "autosave_status" "AutosaveStatus" NOT NULL DEFAULT 'saved',
    "revision_count" INTEGER NOT NULL DEFAULT 0,
    "last_edited_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_edited_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "story_draft_id" UUID NOT NULL,
    "revision_type" "RevisionType" NOT NULL,
    "changed_object_type" "ChangedObjectType" NOT NULL,
    "changed_object_id" UUID NOT NULL,
    "change_summary" TEXT NOT NULL,
    "is_material_public_change" BOOLEAN NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "story_draft_story_brief_id_key" ON "story_draft"("story_brief_id");

-- CreateIndex
CREATE INDEX "story_draft_selected_frame_id_idx" ON "story_draft"("selected_frame_id");

-- CreateIndex
CREATE INDEX "revision_entry_draft_created_idx" ON "revision_entry"("story_draft_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "story_draft" ADD CONSTRAINT "story_draft_story_brief_id_fkey" FOREIGN KEY ("story_brief_id") REFERENCES "story_brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_draft" ADD CONSTRAINT "story_draft_selected_frame_id_fkey" FOREIGN KEY ("selected_frame_id") REFERENCES "story_frame_draft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_entry" ADD CONSTRAINT "revision_entry_story_draft_id_fkey" FOREIGN KEY ("story_draft_id") REFERENCES "story_draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
