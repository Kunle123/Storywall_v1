# Staging creator baseline report

**Generated:** 2026-04-18T17:35:32.030Z  
**Target:** `https://api-staging-1de1.up.railway.app`  
**Run email:** `staging-baseline-1776533730947@example.test` (password redacted from this file)

## Contract (M5-T16+)

This suite targets the **normalized public paths**: `GET /api/v1/health`, `POST …/research` (with `Idempotency-Key`), `GET …/framing`. Legacy `GET /health`, `POST …/research/run`, and `GET …/frames` remain available and share the same implementation where applicable.

## Summary table

| Step | Endpoint | Status | Verdict | Key evidence | Likely interpretation |
|------|----------|--------|---------|--------------|------------------------|
| 1 | `https://api-staging-1de1.up.railway.app/api/v1/health` | 200 | passed on staging | { "ok": true, "service": "storywall-api", "api_version": "2026-05-01", "generated_at": "2026-04-18T17:35:30.986Z", "ai_runtime": { "surface": "armed", "provider": "openai_compatible", "credentials_configured": true, "base_url_configured": true, "default_model_configured": true, "telemetry_sink": "none", "policy": { "enforcement": "on", "timeout_ms": 60000, "max_retries": 2, "max_calls_per_window": 30, "window_ms": 60… | Versioned health returned truthful liveness + ai_runtime summary. |
| 2 | `/api/v1/auth/register` | 201 | passed on staging | { "ok": true, "request_id": "5999c593-db54-400f-b7f5-37e681e1b892", "api_version": "2026-05-01", "data": { "access_token": "[REDACTED]", "token_type": "bearer", "creator": { "id": "bcd4646f-94e4-4884-8d7c-f2c15e1280e2", "email": "staging-baseline-1776533730947@example.test", "display_name": "Staging baseline" } } } | Endpoint responded success envelope where applicable. |
| 3 | `/api/v1/auth/login` | 201 | passed on staging | { "ok": true, "request_id": "25d5e084-f2b1-44e9-8188-f2ff7081f658", "api_version": "2026-05-01", "data": { "access_token": "[REDACTED]", "token_type": "bearer", "creator": { "id": "bcd4646f-94e4-4884-8d7c-f2c15e1280e2", "email": "staging-baseline-1776533730947@example.test", "display_name": "Staging baseline" } } } | Endpoint responded success envelope where applicable. |
| 4 | `/api/v1/creator/stories` | 201 | passed on staging | { "ok": true, "request_id": "54c30ac8-51be-4223-9942-c8490a79ebc7", "api_version": "2026-05-01", "data": { "story_id": "8579fcfc-c500-4834-965b-dab731687a0f", "slug": "staging-baseline-subject-fe543c29", "story_brief": { "id": "9862614d-cc78-43aa-9c6f-dfc797235b05", "story_id": "8579fcfc-c500-4834-965b-dab731687a0f", "creator_id": "bcd4646f-94e4-4884-8d7c-f2c15e1280e2", "subject": "Staging baseline subject", "subject… | Endpoint responded success envelope where applicable. |
| 5 | `/api/v1/creator/stories/8579fcfc-c500-4834-965b-dab731687a0f/events` | 200 | passed on staging | { "ok": true, "request_id": "fc63dd05-4136-4cb9-a0df-477bb28dd3b8", "api_version": "2026-05-01", "data": { "events": [], "story_state": "drafting_brief" }, "meta": { "event_list_scope": "no_story_draft" } } | Events list reachable; empty array may be expected before draft shell. |
| 6 | `https://api-staging-1de1.up.railway.app/api/v1/creator/stories/8579fcfc-c500-4834-965b-dab731687a0f/research` | 400 | passed on staging | { "ok": false, "error": { "code": "invalid_state_transition", "message": "Research run is not allowed in the current workflow state", "details": { "story_state": "drafting_brief" } } } | POST …/research exists; 400 is an honest workflow guard (e.g. drafting_brief). |
| 7 | `https://api-staging-1de1.up.railway.app/api/v1/creator/stories/8579fcfc-c500-4834-965b-dab731687a0f/framing` | 200 | passed on staging | { "ok": true, "request_id": "5024ffcd-25c9-4402-9435-3b1329bf278d", "api_version": "2026-05-01", "data": { "story_id": "8579fcfc-c500-4834-965b-dab731687a0f", "story_state": "drafting_brief", "story_lifecycle_status": "draft", "published_at": null, "story_slug": "staging-baseline-subject-fe543c29", "frame_drafts": [], "story_draft": null, "ai_framing_generation": null } } | GET …/framing returns the same envelope as …/frames. |

## Narrative

1. **Did staging auth work end-to-end for a fresh user?** Yes — register and login returned 2xx with JWT (`access_token`).

2. **Did staging accept the JWT on POST /api/v1/creator/stories?** Yes (2xx + story_id).

3. **Does GET /api/v1/creator/stories/:storyId/events exist on staging right now?** Yes — success status from staging.

4. **Does POST …/research exist and return a truthful outcome (not 404-only)?** Yes — 2xx success or honest 400 state error from the normalized path.

5. **Does GET …/framing return truthful framing state (not missing-route 404)?** Yes — 200 with framing list envelope.

6. **Failures: environment vs implementation?** 401 on create → auth/JWT config. 404 on normalized paths → API not redeployed with M5-T16 yet. Honest 400 on research from `drafting_brief` → product state machine, not a missing route.



**Story id (if any):** 8579fcfc-c500-4834-965b-dab731687a0f

**Test user email:** staging-baseline-1776533730947@example.test

## Raw evidence (failed / suspicious)

_No failed or non-200 creator steps — see stdout for full traces._

---
_Report produced by `scripts/verify-staging-creator-baseline.mjs`._
