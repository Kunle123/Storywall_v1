-- M2-T02: research package + candidate sources (pre-event attachment)

CREATE TABLE "research_artifact" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "research_job_id" UUID NOT NULL,
    "story_id" UUID NOT NULL,
    "evidence_package_summary" TEXT NOT NULL,
    "candidate_event_hints" JSONB NOT NULL DEFAULT '[]',
    "risk_flags" JSONB NOT NULL DEFAULT '[]',
    "confidence_posture" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_artifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "research_artifact_research_job_id_key" ON "research_artifact"("research_job_id");
CREATE INDEX "research_artifact_story_idx" ON "research_artifact"("story_id");

ALTER TABLE "research_artifact" ADD CONSTRAINT "research_artifact_research_job_id_fkey" FOREIGN KEY ("research_job_id") REFERENCES "research_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "research_artifact" ADD CONSTRAINT "research_artifact_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "research_candidate_source" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "research_job_id" UUID NOT NULL,
    "story_id" UUID NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_title" TEXT NOT NULL,
    "publisher_name" TEXT NOT NULL,
    "source_type" "SourceRecordType" NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "excerpt" TEXT,
    "relevance_note" TEXT NOT NULL,
    "reliability_tier" "ReliabilityTier" NOT NULL,
    "position_index" INTEGER NOT NULL,
    "extraction_method" "SourceExtractionMethod" NOT NULL DEFAULT 'ai_extracted',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_candidate_source_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "research_cand_src_job_pos_idx" ON "research_candidate_source"("research_job_id", "position_index");

ALTER TABLE "research_candidate_source" ADD CONSTRAINT "research_cand_src_job_fk" FOREIGN KEY ("research_job_id") REFERENCES "research_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "research_candidate_source" ADD CONSTRAINT "research_cand_src_story_fk" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
