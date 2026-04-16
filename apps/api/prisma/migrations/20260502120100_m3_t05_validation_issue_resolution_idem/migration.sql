-- M3-T05 — idempotent creator PATCH for validation issue resolution_status

CREATE TABLE "creator_validation_issue_resolution_idempotency" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creator_id" UUID NOT NULL,
    "story_id" UUID NOT NULL,
    "validation_issue_id" UUID NOT NULL,
    "request_key" VARCHAR(255) NOT NULL,
    "accepted_resolution_status" "ValidationResolutionStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_validation_issue_resolution_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creator_val_issue_res_idem_uidx"
ON "creator_validation_issue_resolution_idempotency" ("creator_id", "story_id", "validation_issue_id", "request_key");

CREATE INDEX "creator_val_issue_res_idem_story_idx"
ON "creator_validation_issue_resolution_idempotency" ("story_id");

ALTER TABLE "creator_validation_issue_resolution_idempotency"
ADD CONSTRAINT "creator_validation_issue_resolution_idempotency_creator_id_fkey"
FOREIGN KEY ("creator_id") REFERENCES "creator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "creator_validation_issue_resolution_idempotency"
ADD CONSTRAINT "creator_validation_issue_resolution_idempotency_story_id_fkey"
FOREIGN KEY ("story_id") REFERENCES "stories" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
