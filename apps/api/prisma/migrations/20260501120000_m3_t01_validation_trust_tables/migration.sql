-- M3-T01 — validation runs/reports, issues, draft-level trust metadata (editor §15)

CREATE TYPE "ValidationRunType" AS ENUM ('structure', 'trust', 'style', 'publish_readiness', 'full');

CREATE TYPE "ValidationRunSource" AS ENUM ('system', 'creator_requested', 'reviewer_requested');

CREATE TYPE "ValidationOverallResult" AS ENUM ('pass', 'warn', 'block');

CREATE TYPE "ValidationIssueObjectType" AS ENUM ('story', 'section', 'event', 'source', 'image');

CREATE TYPE "ValidationIssueType" AS ENUM (
  'overclaim',
  'unsupported',
  'duplicate',
  'timeline_gap',
  'tone_drift',
  'missing_source',
  'disputed_view_missing',
  'imagery_risk',
  'missing_synthesis',
  'other'
);

CREATE TYPE "ValidationIssueSeverity" AS ENUM ('low', 'medium', 'high');

CREATE TYPE "ValidationPublishEffect" AS ENUM ('none', 'warn', 'block');

CREATE TYPE "ValidationResolutionStatus" AS ENUM ('open', 'accepted', 'dismissed', 'resolved');

CREATE TABLE "validation_report" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "story_draft_id" UUID NOT NULL,
  "run_type" "ValidationRunType" NOT NULL,
  "run_source" "ValidationRunSource" NOT NULL,
  "overall_result" "ValidationOverallResult" NOT NULL,
  "issue_count_total" INTEGER NOT NULL,
  "blocker_count" INTEGER NOT NULL,
  "warning_count" INTEGER NOT NULL,
  "summary_note" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID,

  CONSTRAINT "validation_report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "validation_issue" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "validation_report_id" UUID NOT NULL,
  "object_type" "ValidationIssueObjectType" NOT NULL,
  "object_id" UUID NOT NULL,
  "issue_type" "ValidationIssueType" NOT NULL,
  "severity" "ValidationIssueSeverity" NOT NULL,
  "publish_effect" "ValidationPublishEffect" NOT NULL,
  "explanation" TEXT NOT NULL,
  "suggested_fix" TEXT,
  "resolution_status" "ValidationResolutionStatus" NOT NULL,
  "resolved_by" UUID,
  "resolved_at" TIMESTAMPTZ(6),

  CONSTRAINT "validation_issue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "draft_trust_metadata" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "story_draft_id" UUID NOT NULL,
  "latest_validation_report_id" UUID,
  "last_overall_result" "ValidationOverallResult",
  "last_blocker_count" INTEGER NOT NULL DEFAULT 0,
  "last_warning_count" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "draft_trust_metadata_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "validation_report"
  ADD CONSTRAINT "validation_report_story_draft_id_fkey"
  FOREIGN KEY ("story_draft_id") REFERENCES "story_draft" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "validation_issue"
  ADD CONSTRAINT "validation_issue_validation_report_id_fkey"
  FOREIGN KEY ("validation_report_id") REFERENCES "validation_report" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "draft_trust_metadata"
  ADD CONSTRAINT "draft_trust_metadata_story_draft_id_fkey"
  FOREIGN KEY ("story_draft_id") REFERENCES "story_draft" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "draft_trust_metadata"
  ADD CONSTRAINT "draft_trust_metadata_latest_validation_report_id_fkey"
  FOREIGN KEY ("latest_validation_report_id") REFERENCES "validation_report" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "draft_trust_metadata_story_draft_id_key" ON "draft_trust_metadata" ("story_draft_id");

CREATE UNIQUE INDEX "draft_trust_metadata_latest_validation_report_id_key" ON "draft_trust_metadata" ("latest_validation_report_id");

CREATE INDEX "validation_report_draft_created_idx" ON "validation_report" ("story_draft_id", "created_at" DESC);

CREATE INDEX "validation_issue_report_idx" ON "validation_issue" ("validation_report_id");

CREATE INDEX "validation_issue_object_idx" ON "validation_issue" ("object_type", "object_id");
