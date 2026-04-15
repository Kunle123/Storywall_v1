-- M2-T05 — full draft assembly jobs + idempotency (mutation §11.2).

CREATE TYPE "DraftAssemblyJobStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'cancelled');

CREATE TABLE "draft_assembly_job" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "story_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "status" "DraftAssemblyJobStatus" NOT NULL,
    "mode" VARCHAR(64) NOT NULL DEFAULT 'full_regeneration',
    "request_payload" JSONB NOT NULL,
    "error_message" TEXT,
    "pre_assembly_workflow_state" "CreatorWorkflowState" NOT NULL,
    "source_research_job_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "draft_assembly_job_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "draft_assembly_job_story_status_idx" ON "draft_assembly_job"("story_id", "status");

ALTER TABLE "draft_assembly_job" ADD CONSTRAINT "draft_assembly_job_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "draft_assembly_job" ADD CONSTRAINT "draft_assembly_job_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "draft_assembly_job" ADD CONSTRAINT "draft_assembly_job_source_research_job_id_fkey" FOREIGN KEY ("source_research_job_id") REFERENCES "research_job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "creator_draft_assemble_idempotency" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creator_id" UUID NOT NULL,
    "story_id" UUID NOT NULL,
    "request_key" VARCHAR(255) NOT NULL,
    "draft_assembly_job_id" UUID NOT NULL,
    "accepted_response_story_state" "CreatorWorkflowState" NOT NULL,
    "accepted_response_job_status" "DraftAssemblyJobStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_draft_assemble_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creator_draft_asm_idem_uidx" ON "creator_draft_assemble_idempotency"("creator_id", "story_id", "request_key");
CREATE UNIQUE INDEX "creator_draft_assemble_idempotency_draft_assembly_job_id_key" ON "creator_draft_assemble_idempotency"("draft_assembly_job_id");
CREATE INDEX "creator_draft_asm_idem_story_idx" ON "creator_draft_assemble_idempotency"("story_id");

ALTER TABLE "creator_draft_assemble_idempotency" ADD CONSTRAINT "creator_draft_assemble_idempotency_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "creator_draft_assemble_idempotency" ADD CONSTRAINT "creator_draft_assemble_idempotency_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creator_draft_assemble_idempotency" ADD CONSTRAINT "creator_draft_assemble_idempotency_draft_assembly_job_id_fkey" FOREIGN KEY ("draft_assembly_job_id") REFERENCES "draft_assembly_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
