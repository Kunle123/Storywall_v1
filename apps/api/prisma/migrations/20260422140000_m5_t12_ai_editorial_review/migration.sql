-- M5-T12 — AI-assisted editorial review audit envelope on story_brief.
ALTER TABLE "story_brief" ADD COLUMN "ai_editorial_review_package" JSONB;
