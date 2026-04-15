-- M2-T01: research job records + idempotency for POST /research/run

CREATE TYPE "ResearchJobStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'cancelled');

CREATE TABLE "research_job" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "story_id" UUID NOT NULL,
    "status" "ResearchJobStatus" NOT NULL,
    "mode" VARCHAR(32) NOT NULL DEFAULT 'full',
    "request_payload" JSONB NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "research_job_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "research_job_story_status_idx" ON "research_job"("story_id", "status");

ALTER TABLE "research_job" ADD CONSTRAINT "research_job_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "creator_research_run_idempotency" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creator_id" UUID NOT NULL,
    "story_id" UUID NOT NULL,
    "request_key" VARCHAR(255) NOT NULL,
    "research_job_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_research_run_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creator_research_run_idem_uidx" ON "creator_research_run_idempotency"("creator_id", "story_id", "request_key");
CREATE UNIQUE INDEX "creator_research_run_idempotency_research_job_id_key" ON "creator_research_run_idempotency"("research_job_id");
CREATE INDEX "creator_research_run_idem_story_idx" ON "creator_research_run_idempotency"("story_id");

ALTER TABLE "creator_research_run_idempotency" ADD CONSTRAINT "creator_research_run_idem_creator_fk" FOREIGN KEY ("creator_id") REFERENCES "creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "creator_research_run_idempotency" ADD CONSTRAINT "creator_research_run_idem_story_fk" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creator_research_run_idempotency" ADD CONSTRAINT "creator_research_run_idem_job_fk" FOREIGN KEY ("research_job_id") REFERENCES "research_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
