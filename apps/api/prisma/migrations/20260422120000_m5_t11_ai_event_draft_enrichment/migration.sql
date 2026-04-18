-- M5-T11 — live AI event/draft enrichment audit envelope on story_brief.
ALTER TABLE "story_brief" ADD COLUMN "ai_event_draft_enrichment_package" JSONB;
