-- M1-T12: durable idempotent replay for POST /creator/stories/:id/frames/select

CREATE TABLE "creator_frame_select_idempotency" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creator_id" UUID NOT NULL,
    "story_id" UUID NOT NULL,
    "request_key" VARCHAR(255) NOT NULL,
    "selected_frame_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_frame_select_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creator_frame_sel_idem_uidx" ON "creator_frame_select_idempotency"("creator_id", "story_id", "request_key");
CREATE INDEX "creator_frame_sel_idem_story_idx" ON "creator_frame_select_idempotency"("story_id");

ALTER TABLE "creator_frame_select_idempotency" ADD CONSTRAINT "creator_frame_sel_idem_creator_fk" FOREIGN KEY ("creator_id") REFERENCES "creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "creator_frame_select_idempotency" ADD CONSTRAINT "creator_frame_sel_idem_story_fk" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
