-- M1-T03 — Brief intake + framing options/selection (storywall_ticket_ready_implementation_backlog.md).
-- Editor/CMS: storywall_editor_cms_input_model.md §7–9. Migration plan Phase 4 structured brief + framing (storywall_database_migration_plan_actual_stack.md §10.1).

-- CreateEnum
CREATE TYPE "BriefStoryType" AS ENUM ('biography', 'issue_history', 'influence', 'controversy', 'movement_history', 'relationship_impact', 'custom');

-- CreateEnum
CREATE TYPE "TimeScopeMode" AS ENUM ('entire_history', 'bounded_range', 'open_recent', 'custom');

-- CreateEnum
CREATE TYPE "BriefAudience" AS ENUM ('general', 'fan', 'student', 'specialist', 'custom');

-- CreateEnum
CREATE TYPE "NarrativeIntent" AS ENUM ('documentary', 'explanatory', 'analytical', 'commemorative', 'comparative');

-- CreateEnum
CREATE TYPE "BriefImageryMode" AS ENUM ('selective_editorial', 'minimal', 'sourced_only', 'no_imagery');

-- CreateEnum
CREATE TYPE "WritingStylePreference" AS ENUM ('neutral', 'analytical', 'concise', 'documentary');

-- CreateEnum
CREATE TYPE "CreationMode" AS ENUM ('ai_first', 'hybrid', 'manual_heavy');

-- CreateEnum
CREATE TYPE "BriefRecordStatus" AS ENUM ('draft', 'submitted', 'normalized');

-- CreateEnum
CREATE TYPE "NormalizationStatus" AS ENUM ('pending', 'complete', 'needs_creator_attention');

-- CreateEnum
CREATE TYPE "FrameDraftStatus" AS ENUM ('proposed', 'selected', 'discarded', 'superseded');

-- CreateEnum
CREATE TYPE "FrameSelectionSource" AS ENUM ('ai_proposed', 'creator_edited', 'creator_written');

-- CreateEnum
CREATE TYPE "ConfidenceSummary" AS ENUM ('verified', 'mostly_verified', 'mixed', 'emerging', 'disputed');

-- CreateTable
CREATE TABLE "story_brief" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "story_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "subject_type_input" "SubjectType",
    "story_type" "BriefStoryType" NOT NULL,
    "research_brief" TEXT NOT NULL,
    "desired_angle" TEXT NOT NULL,
    "time_scope_mode" "TimeScopeMode" NOT NULL,
    "time_scope_start" DATE,
    "time_scope_end" DATE,
    "audience" "BriefAudience",
    "narrative_intent" "NarrativeIntent" NOT NULL,
    "imagery_mode" "BriefImageryMode" NOT NULL,
    "source_inputs" JSONB,
    "writing_style_preference" "WritingStylePreference",
    "creation_mode" "CreationMode" NOT NULL,
    "status" "BriefRecordStatus" NOT NULL DEFAULT 'draft',
    "normalized_subject" TEXT,
    "subject_type_normalized" "SubjectType",
    "suggested_time_scope" TEXT,
    "story_angle_candidates" JSONB,
    "prompt_risks" JSONB,
    "recommended_creation_mode" "CreationMode",
    "normalization_status" "NormalizationStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_brief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_frame_draft" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "story_brief_id" UUID NOT NULL,
    "title_candidate" TEXT NOT NULL,
    "subtitle_candidate" TEXT,
    "summary_candidate" TEXT NOT NULL,
    "lens_candidate" TEXT NOT NULL,
    "scope_rationale" TEXT NOT NULL,
    "coverage_implications" JSONB NOT NULL DEFAULT '[]',
    "balance_note" TEXT,
    "section_candidates" JSONB,
    "confidence_summary_initial" "ConfidenceSummary" NOT NULL,
    "candidate_rank" INTEGER NOT NULL,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "selection_source" "FrameSelectionSource" NOT NULL,
    "status" "FrameDraftStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_frame_draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "story_brief_story_id_key" ON "story_brief"("story_id");

-- CreateIndex
CREATE INDEX "story_brief_creator_id_idx" ON "story_brief"("creator_id");

-- CreateIndex
CREATE INDEX "story_frame_draft_brief_id_idx" ON "story_frame_draft"("story_brief_id");

-- CreateIndex
CREATE INDEX "story_frame_draft_brief_rank_idx" ON "story_frame_draft"("story_brief_id", "candidate_rank");

-- At most one selected framing row per brief (editor §9.2 — accept frame).
CREATE UNIQUE INDEX "story_frame_draft_one_selected_per_brief_idx" ON "story_frame_draft"("story_brief_id") WHERE "is_selected" = true;

-- AddForeignKey
ALTER TABLE "story_brief" ADD CONSTRAINT "story_brief_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_frame_draft" ADD CONSTRAINT "story_frame_draft_story_brief_id_fkey" FOREIGN KEY ("story_brief_id") REFERENCES "story_brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
