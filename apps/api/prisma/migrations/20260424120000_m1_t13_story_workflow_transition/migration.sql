-- M1-T13: append-only workflow transition log for setup-flow commands

CREATE TYPE "WorkflowTransitionActorType" AS ENUM ('creator', 'system');

CREATE TABLE "story_workflow_transition" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "story_id" UUID NOT NULL,
    "from_workflow_state" "CreatorWorkflowState",
    "to_workflow_state" "CreatorWorkflowState" NOT NULL,
    "actor_type" "WorkflowTransitionActorType" NOT NULL,
    "actor_id" UUID,
    "trigger" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_workflow_transition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "story_wf_transition_story_created_idx" ON "story_workflow_transition"("story_id", "created_at");

ALTER TABLE "story_workflow_transition" ADD CONSTRAINT "story_workflow_transition_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
