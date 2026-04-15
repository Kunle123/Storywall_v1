-- M1-T02 — Core story records (storywall_ticket_ready_implementation_backlog.md).
-- Aligns with storywall_database_migration_plan_actual_stack.md Phase 1 §7.1 table `stories` only.
-- Deferred: story_sections, events, story_topic_tags (M1-T05); brief/framing/draft (M1-T03–M1-T04).
-- Requires prior migration: pgcrypto (gen_random_uuid).

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('person', 'organization', 'event', 'topic', 'place', 'movement', 'conflict', 'other');

-- CreateEnum
CREATE TYPE "StoryLifecycleStatus" AS ENUM ('draft', 'review', 'published', 'archived');

-- CreateEnum
CREATE TYPE "StoryVisibility" AS ENUM ('public', 'unlisted', 'private');

-- CreateEnum
CREATE TYPE "CreatorWorkflowState" AS ENUM ('drafting_brief', 'awaiting_framing_choice', 'researching', 'assembling_draft', 'ready_for_edit', 'needs_validation', 'blocked', 'ready_to_publish', 'published');

-- CreateTable
CREATE TABLE "stories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "creator_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "lens" TEXT,
    "conclusion" TEXT,
    "subject_type" "SubjectType" NOT NULL,
    "category_primary" TEXT NOT NULL,
    "category_secondary" TEXT,
    "time_start" TIMESTAMPTZ(6),
    "time_end" TIMESTAMPTZ(6),
    "time_display" TEXT,
    "workflow_state" "CreatorWorkflowState" NOT NULL DEFAULT 'drafting_brief',
    "story_status" "StoryLifecycleStatus" NOT NULL DEFAULT 'draft',
    "visibility" "StoryVisibility" NOT NULL DEFAULT 'private',
    "lead_priority" INTEGER,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "share_url" TEXT,
    "share_title" TEXT,
    "share_description" TEXT,
    "cover_image" JSONB,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stories_slug_key" ON "stories"("slug");

-- CreateIndex
CREATE INDEX "stories_status_visibility_published_at_idx" ON "stories"("story_status", "visibility", "published_at" DESC);

-- CreateIndex
CREATE INDEX "stories_lead_priority_published_at_idx" ON "stories"("lead_priority", "published_at" DESC);

-- CreateIndex
CREATE INDEX "stories_category_primary_published_at_idx" ON "stories"("category_primary", "published_at" DESC);
