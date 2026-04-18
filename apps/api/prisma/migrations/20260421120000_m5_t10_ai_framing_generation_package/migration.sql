-- M5-T10 — auditable live (or fallback) AI framing generation envelope on story_brief.
ALTER TABLE "story_brief" ADD COLUMN "ai_framing_generation_package" JSONB;
