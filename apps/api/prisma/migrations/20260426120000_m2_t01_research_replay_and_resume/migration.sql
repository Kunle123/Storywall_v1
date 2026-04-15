-- M2-T01 revision: frozen idempotent POST response + restore workflow after research per start state

ALTER TABLE "research_job" ADD COLUMN "pre_research_workflow_state" "CreatorWorkflowState";
UPDATE "research_job" SET "pre_research_workflow_state" = 'ready_for_edit' WHERE "pre_research_workflow_state" IS NULL;
ALTER TABLE "research_job" ALTER COLUMN "pre_research_workflow_state" SET NOT NULL;

ALTER TABLE "creator_research_run_idempotency" ADD COLUMN "accepted_response_story_state" "CreatorWorkflowState";
ALTER TABLE "creator_research_run_idempotency" ADD COLUMN "accepted_response_job_status" "ResearchJobStatus";
UPDATE "creator_research_run_idempotency" SET "accepted_response_story_state" = 'researching', "accepted_response_job_status" = 'pending' WHERE "accepted_response_story_state" IS NULL;
ALTER TABLE "creator_research_run_idempotency" ALTER COLUMN "accepted_response_story_state" SET NOT NULL;
ALTER TABLE "creator_research_run_idempotency" ALTER COLUMN "accepted_response_job_status" SET NOT NULL;
