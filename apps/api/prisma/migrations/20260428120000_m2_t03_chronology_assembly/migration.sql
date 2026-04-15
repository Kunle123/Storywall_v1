-- M2-T03 — chronology assembly from research package (storywall_ticket_ready_implementation_backlog.md).

CREATE TABLE "chronology_assembly" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "research_job_id" UUID NOT NULL,
    "story_id" UUID NOT NULL,
    "extraction_version" VARCHAR(32) NOT NULL DEFAULT 'm2-t03-v1',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chronology_assembly_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chronology_assembly_research_job_id_key" ON "chronology_assembly"("research_job_id");
CREATE INDEX "chronology_assembly_story_idx" ON "chronology_assembly"("story_id");

ALTER TABLE "chronology_assembly" ADD CONSTRAINT "chronology_assembly_research_job_id_fkey" FOREIGN KEY ("research_job_id") REFERENCES "research_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chronology_assembly" ADD CONSTRAINT "chronology_assembly_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "chronology_extracted_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chronology_assembly_id" UUID NOT NULL,
    "position_index" INTEGER NOT NULL,
    "headline" TEXT NOT NULL,
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
    "interval_note" TEXT,
    "location_name" TEXT,
    "media_kind" "EventMediaKind" NOT NULL,
    "source_density" "EventSourceDensity" NOT NULL,
    "confidence_state" "EventConfidenceState" NOT NULL,
    "claim_risk_level" "ClaimRiskLevel" NOT NULL,
    "supporting_candidate_source_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "ambiguity_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chronology_extracted_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chronology_evt_assembly_pos_idx" ON "chronology_extracted_event"("chronology_assembly_id", "position_index");

ALTER TABLE "chronology_extracted_event" ADD CONSTRAINT "chronology_extracted_event_chronology_assembly_id_fkey" FOREIGN KEY ("chronology_assembly_id") REFERENCES "chronology_assembly"("id") ON DELETE CASCADE ON UPDATE CASCADE;
