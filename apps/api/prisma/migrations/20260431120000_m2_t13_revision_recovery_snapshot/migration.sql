-- M2-T13 — optional JSON snapshot for recovery from revision history
ALTER TABLE "revision_entry" ADD COLUMN "recovery_snapshot" JSONB;
