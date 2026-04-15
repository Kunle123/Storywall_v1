-- M3-T02 — idempotent replay for POST …/validation/run (mutation §17.1)

CREATE TABLE "creator_validation_run_idempotency" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "creator_id" UUID NOT NULL,
  "story_id" UUID NOT NULL,
  "request_key" VARCHAR(255) NOT NULL,
  "validation_report_id" UUID NOT NULL,
  "accepted_response_story_state" "CreatorWorkflowState" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "creator_validation_run_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creator_validation_run_idempotency_validation_report_id_key"
  ON "creator_validation_run_idempotency" ("validation_report_id");

CREATE UNIQUE INDEX "creator_validation_run_idem_uidx"
  ON "creator_validation_run_idempotency" ("creator_id", "story_id", "request_key");

CREATE INDEX "creator_validation_run_idem_story_idx" ON "creator_validation_run_idempotency" ("story_id");

ALTER TABLE "creator_validation_run_idempotency"
  ADD CONSTRAINT "creator_validation_run_idempotency_creator_id_fkey"
  FOREIGN KEY ("creator_id") REFERENCES "creator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "creator_validation_run_idempotency"
  ADD CONSTRAINT "creator_validation_run_idempotency_story_id_fkey"
  FOREIGN KEY ("story_id") REFERENCES "stories" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "creator_validation_run_idempotency"
  ADD CONSTRAINT "creator_validation_run_idempotency_validation_report_id_fkey"
  FOREIGN KEY ("validation_report_id") REFERENCES "validation_report" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
