-- M1-T05 — Section, event, source, image-proposal draft tables (storywall_ticket_ready_implementation_backlog.md).
-- Editor: storywall_editor_cms_input_model.md §11 `section_draft`, §12 `event_draft`, §13 `source_record`, §14 `image_proposal`.
-- Draft-layer names (`*_draft`, `source_record`) vs migration plan public `events` / `event_sources` — public mirror tables deferred.

-- CreateEnum
CREATE TYPE "SectionDraftStatus" AS ENUM ('draft', 'approved', 'removed');

-- CreateEnum
CREATE TYPE "SectionOrigin" AS ENUM ('ai_generated', 'creator_added', 'creator_edited');

-- CreateEnum
CREATE TYPE "EventDraftKind" AS ENUM ('standard', 'turning_point', 'context_note', 'synthesis', 'chatter', 'corroboration_cluster');

-- CreateEnum
CREATE TYPE "SignificanceLevel" AS ENUM ('minor', 'standard', 'major', 'critical');

-- CreateEnum
CREATE TYPE "EventDatePrecision" AS ENUM ('year', 'month', 'day', 'time', 'approximate', 'unknown');

-- CreateEnum
CREATE TYPE "EventMediaKind" AS ENUM ('image', 'video', 'document', 'map', 'none');

-- CreateEnum
CREATE TYPE "EventSourceDensity" AS ENUM ('none', 'low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "EventConfidenceState" AS ENUM ('verified', 'mostly_verified', 'emerging', 'disputed', 'retracted');

-- CreateEnum
CREATE TYPE "ClaimRiskLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "EventModerationStatus" AS ENUM ('pending', 'approved', 'flagged', 'rejected');

-- CreateEnum
CREATE TYPE "EventDraftRowStatus" AS ENUM ('draft', 'ready', 'removed', 'published');

-- CreateEnum
CREATE TYPE "SourceRecordType" AS ENUM ('article', 'report', 'document', 'video', 'audio', 'archive', 'social_post', 'dataset', 'other');

-- CreateEnum
CREATE TYPE "ReliabilityTier" AS ENUM ('high', 'medium', 'low', 'unrated');

-- CreateEnum
CREATE TYPE "SourceVerificationStatus" AS ENUM ('verified', 'partially_verified', 'unreviewed', 'contested', 'rejected');

-- CreateEnum
CREATE TYPE "SourceExtractionMethod" AS ENUM ('manual', 'ai_extracted', 'imported');

-- CreateEnum
CREATE TYPE "SourceRecordStatus" AS ENUM ('draft', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ImageProposalTargetType" AS ENUM ('story_cover', 'story_share', 'event', 'section');

-- CreateEnum
CREATE TYPE "ImageProposalAssetSource" AS ENUM ('ai_generated', 'licensed', 'archival', 'manual_upload');

-- CreateEnum
CREATE TYPE "ImageStyleMode" AS ENUM ('editorial', 'archival', 'illustrative', 'minimal');

-- CreateEnum
CREATE TYPE "ImageApprovalStatus" AS ENUM ('proposed', 'approved', 'rejected', 'superseded');

-- CreateTable
CREATE TABLE "section_draft" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "story_draft_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "summary" TEXT,
    "position_index" INTEGER NOT NULL,
    "time_start" TIMESTAMPTZ(6),
    "time_end" TIMESTAMPTZ(6),
    "status" "SectionDraftStatus" NOT NULL DEFAULT 'draft',
    "section_origin" "SectionOrigin" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "section_draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_proposal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "story_draft_id" UUID NOT NULL,
    "target_type" "ImageProposalTargetType" NOT NULL,
    "target_id" UUID,
    "eligibility_reason" TEXT NOT NULL,
    "proposal_source" "ImageProposalAssetSource" NOT NULL,
    "prompt_context" TEXT,
    "style_mode" "ImageStyleMode" NOT NULL,
    "asset_url" TEXT,
    "asset_alt" TEXT,
    "asset_credit" TEXT,
    "approval_status" "ImageApprovalStatus" NOT NULL DEFAULT 'proposed',
    "is_public_selected" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_draft" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "story_draft_id" UUID NOT NULL,
    "section_draft_id" UUID,
    "slug" TEXT,
    "headline" TEXT NOT NULL,
    "dek" TEXT,
    "summary" TEXT NOT NULL,
    "creator_note" TEXT,
    "event_type" "EventDraftKind" NOT NULL,
    "context_label" TEXT,
    "significance_level" "SignificanceLevel" NOT NULL,
    "event_date_start" TIMESTAMPTZ(6),
    "event_date_end" TIMESTAMPTZ(6),
    "event_date_precision" "EventDatePrecision" NOT NULL,
    "display_date" TEXT,
    "year_anchor" INTEGER,
    "position_index" INTEGER NOT NULL,
    "interval_note" TEXT,
    "location_name" TEXT,
    "media_kind" "EventMediaKind" NOT NULL,
    "media_primary_candidate_id" UUID,
    "source_count" INTEGER NOT NULL DEFAULT 0,
    "source_density" "EventSourceDensity" NOT NULL,
    "confidence_state" "EventConfidenceState" NOT NULL,
    "claim_risk_level" "ClaimRiskLevel" NOT NULL,
    "moderation_status" "EventModerationStatus" NOT NULL,
    "is_shareable" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_featured_in_summary" BOOLEAN NOT NULL DEFAULT false,
    "generation_mode" "DraftGenerationMode" NOT NULL,
    "generation_run_id" TEXT,
    "editorial_review_status" "EditorialReviewStatus" NOT NULL,
    "status" "EventDraftRowStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_record" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_draft_id" UUID NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_title" TEXT NOT NULL,
    "publisher_name" TEXT NOT NULL,
    "source_type" "SourceRecordType" NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "excerpt" TEXT,
    "relevance_note" TEXT NOT NULL,
    "reliability_tier" "ReliabilityTier" NOT NULL,
    "verification_status" "SourceVerificationStatus" NOT NULL,
    "is_primary" BOOLEAN NOT NULL,
    "is_public" BOOLEAN NOT NULL,
    "duplicate_signal" BOOLEAN NOT NULL DEFAULT false,
    "source_extraction_method" "SourceExtractionMethod" NOT NULL,
    "added_by" UUID NOT NULL,
    "status" "SourceRecordStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "section_draft_story_draft_id_idx" ON "section_draft"("story_draft_id");

-- CreateIndex
CREATE INDEX "section_draft_story_position_idx" ON "section_draft"("story_draft_id", "position_index");

-- CreateIndex
CREATE INDEX "image_proposal_story_draft_id_idx" ON "image_proposal"("story_draft_id");

-- CreateIndex
CREATE INDEX "image_proposal_target_idx" ON "image_proposal"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "event_draft_story_draft_id_idx" ON "event_draft"("story_draft_id");

-- CreateIndex
CREATE INDEX "event_draft_section_draft_id_idx" ON "event_draft"("section_draft_id");

-- CreateIndex
CREATE INDEX "event_draft_story_position_idx" ON "event_draft"("story_draft_id", "position_index");

-- CreateIndex
CREATE INDEX "source_record_event_draft_id_idx" ON "source_record"("event_draft_id");

-- AddForeignKey
ALTER TABLE "section_draft" ADD CONSTRAINT "section_draft_story_draft_id_fkey" FOREIGN KEY ("story_draft_id") REFERENCES "story_draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_proposal" ADD CONSTRAINT "image_proposal_story_draft_id_fkey" FOREIGN KEY ("story_draft_id") REFERENCES "story_draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_draft" ADD CONSTRAINT "event_draft_story_draft_id_fkey" FOREIGN KEY ("story_draft_id") REFERENCES "story_draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_draft" ADD CONSTRAINT "event_draft_section_draft_id_fkey" FOREIGN KEY ("section_draft_id") REFERENCES "section_draft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_draft" ADD CONSTRAINT "event_draft_media_primary_candidate_id_fkey" FOREIGN KEY ("media_primary_candidate_id") REFERENCES "image_proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_record" ADD CONSTRAINT "source_record_event_draft_id_fkey" FOREIGN KEY ("event_draft_id") REFERENCES "event_draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
