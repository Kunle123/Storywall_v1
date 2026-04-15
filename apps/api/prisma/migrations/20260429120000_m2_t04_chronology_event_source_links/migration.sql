-- M2-T04 — corroboration edges between chronology extracted events and research candidate sources.

CREATE TYPE "ChronologySourceRelationKind" AS ENUM (
    'documents',
    'corroborates',
    'contextualizes',
    'incidental',
    'disputes'
);

CREATE TABLE "chronology_event_source_link" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chronology_extracted_event_id" UUID NOT NULL,
    "research_candidate_source_id" UUID NOT NULL,
    "story_id" UUID NOT NULL,
    "research_job_id" UUID NOT NULL,
    "relation_kind" "ChronologySourceRelationKind" NOT NULL,
    "counts_toward_sufficiency" BOOLEAN NOT NULL,
    "ordering_index" INTEGER NOT NULL,
    "rationale_note" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chronology_event_source_link_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chronology_evt_src_uidx" ON "chronology_event_source_link"("chronology_extracted_event_id", "research_candidate_source_id");
CREATE INDEX "chronology_evt_src_story_job_idx" ON "chronology_event_source_link"("story_id", "research_job_id");

ALTER TABLE "chronology_event_source_link" ADD CONSTRAINT "chronology_event_source_link_chronology_extracted_event_id_fkey" FOREIGN KEY ("chronology_extracted_event_id") REFERENCES "chronology_extracted_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chronology_event_source_link" ADD CONSTRAINT "chronology_event_source_link_research_candidate_source_id_fkey" FOREIGN KEY ("research_candidate_source_id") REFERENCES "research_candidate_source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chronology_event_source_link" ADD CONSTRAINT "chronology_event_source_link_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chronology_event_source_link" ADD CONSTRAINT "chronology_event_source_link_research_job_id_fkey" FOREIGN KEY ("research_job_id") REFERENCES "research_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
