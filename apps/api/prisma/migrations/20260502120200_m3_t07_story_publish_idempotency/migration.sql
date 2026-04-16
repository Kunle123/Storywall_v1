-- M3-T07 — idempotent creator POST …/publish

CREATE TABLE "creator_story_publish_idempotency" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creator_id" UUID NOT NULL,
    "story_id" UUID NOT NULL,
    "request_key" VARCHAR(255) NOT NULL,
    "published_at_response" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_story_publish_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creator_story_publish_idem_uidx"
ON "creator_story_publish_idempotency" ("creator_id", "story_id", "request_key");

CREATE INDEX "creator_story_publish_idem_story_idx"
ON "creator_story_publish_idempotency" ("story_id");

ALTER TABLE "creator_story_publish_idempotency"
ADD CONSTRAINT "creator_story_publish_idempotency_creator_id_fkey"
FOREIGN KEY ("creator_id") REFERENCES "creator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "creator_story_publish_idempotency"
ADD CONSTRAINT "creator_story_publish_idempotency_story_id_fkey"
FOREIGN KEY ("story_id") REFERENCES "stories" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
