-- M3-T09 — frozen public-read snapshot at publish time

ALTER TABLE "stories" ADD COLUMN "published_body_snapshot" JSONB;
