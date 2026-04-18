# Staging creator baseline report

**Generated:** 2026-04-18T17:20:21.634Z  
**Target:** `https://api-staging-1de1.up.railway.app`  
**Run email:** `staging-baseline-1776532820578@example.test` (password redacted from this file)

## Checklist vs repository routes

| Checklist | Repository (this codebase) |
|-----------|----------------------------|
| `GET /api/v1/health` | `GET /health` (no `/api/v1` prefix on HealthController) |
| `POST …/research` | `POST …/research/run` + `Idempotency-Key` header + body per `RunResearchPassDto` |
| `GET …/framing` | `GET …/frames` (framing list + `ai_framing_generation`) |

## Summary table

| Step | Endpoint | Status | Verdict | Key evidence | Likely interpretation |
|------|----------|--------|---------|--------------|------------------------|
| 1 | `https://api-staging-1de1.up.railway.app/api/v1/health ; https://api-staging-1de1.up.railway.app/health` | 200 | passed on staging | { "requested_GET_api_v1_health": { "status": 404, "body": { "message": "Cannot GET /api/v1/health", "error": "Not Found", "statusCode": 404 } }, "repository_GET_health": { "status": 200, "body": { "ok": true, "service": "storywall-api", "api_version": "2026-05-01", "generated_at": "2026-04-18T17:20:20.719Z", "ai_runtime": { "surface": "armed", "provider": "openai_compatible", "credentials_configured": true, "base_url… | Endpoint responded success envelope where applicable. |
| 2 | `/api/v1/auth/register` | 201 | passed on staging | { "ok": true, "request_id": "ebb2efee-f8c4-4dbe-ae88-918e5da910ec", "api_version": "2026-05-01", "data": { "access_token": "[REDACTED]", "token_type": "bearer", "creator": { "id": "9546e787-a372-4863-a420-dcf49c814bc1", "email": "staging-baseline-1776532820578@example.test", "display_name": "Staging baseline" } } } | Endpoint responded success envelope where applicable. |
| 3 | `/api/v1/auth/login` | 201 | passed on staging | { "ok": true, "request_id": "966f61a2-3bec-481e-9df5-db26e4b1ace8", "api_version": "2026-05-01", "data": { "access_token": "[REDACTED]", "token_type": "bearer", "creator": { "id": "9546e787-a372-4863-a420-dcf49c814bc1", "email": "staging-baseline-1776532820578@example.test", "display_name": "Staging baseline" } } } | Endpoint responded success envelope where applicable. |
| 4 | `/api/v1/creator/stories` | 201 | passed on staging | { "ok": true, "request_id": "67b2727e-6446-4df1-938b-a9ba96964494", "api_version": "2026-05-01", "data": { "story_id": "96f5e762-f515-44dc-9ed5-c0204d29a74e", "slug": "staging-baseline-subject-6e0e529d", "story_brief": { "id": "e6743460-fb7c-4f70-8452-accbe9d3e2da", "story_id": "96f5e762-f515-44dc-9ed5-c0204d29a74e", "creator_id": "9546e787-a372-4863-a420-dcf49c814bc1", "subject": "Staging baseline subject", "subject… | Endpoint responded success envelope where applicable. |
| 5 | `/api/v1/creator/stories/96f5e762-f515-44dc-9ed5-c0204d29a74e/events` | 200 | passed on staging | { "ok": true, "request_id": "8c8c601f-de1c-4cd5-bc60-836ca3db0e8d", "api_version": "2026-05-01", "data": { "events": [], "story_state": "drafting_brief" }, "meta": { "event_list_scope": "no_story_draft" } } | Events list reachable; empty array may be expected before draft shell. |
| 6 | `https://api-staging-1de1.up.railway.app/api/v1/creator/stories/96f5e762-f515-44dc-9ed5-c0204d29a74e/research ; https://api-staging-1de1.up.railway.app/api/v1/creator/stories/96f5e762-f515-44dc-9ed5-c0204d29a74e/research/run` | 400 | attempted on staging but failed | { "requested_path_POST_research": { "status": 404, "body": { "message": "Cannot POST /api/v1/creator/stories/96f5e762-f515-44dc-9ed5-c0204d29a74e/research", "error": "Not Found", "statusCode": 404 } }, "repository_path_POST_research_run": { "status": 400, "body": { "ok": false, "error": { "code": "invalid_state_transition", "message": "Research run is not allowed in the current workflow state", "details": { "story_st… | POST …/research is not a route; …/research/run exists but returned invalid_state_transition while story is still drafting_brief (run framing flow first). |
| 7 | `https://api-staging-1de1.up.railway.app/api/v1/creator/stories/96f5e762-f515-44dc-9ed5-c0204d29a74e/framing ; https://api-staging-1de1.up.railway.app/api/v1/creator/stories/96f5e762-f515-44dc-9ed5-c0204d29a74e/frames` | 200 | passed on staging | { "requested_path_GET_framing": { "status": 404, "body": { "message": "Cannot GET /api/v1/creator/stories/96f5e762-f515-44dc-9ed5-c0204d29a74e/framing", "error": "Not Found", "statusCode": 404 } }, "repository_path_GET_frames": { "status": 200, "body": { "ok": true, "request_id": "27345997-1bd9-4770-9a42-f4d468e4037a", "api_version": "2026-05-01", "data": { "story_id": "96f5e762-f515-44dc-9ed5-c0204d29a74e", "story_s… | Compare requested GET …/framing vs implemented GET …/frames. |

## Narrative

1. **Did staging auth work end-to-end for a fresh user?** Yes — register and login returned 2xx with JWT (`access_token`).

2. **Did staging accept the JWT on POST /api/v1/creator/stories?** Yes (2xx + story_id).

3. **Does GET /api/v1/creator/stories/:storyId/events exist on staging right now?** Yes — success status from staging.

4. **Did research trigger successfully on staging?** No — repository path responded 400 `invalid_state_transition` in `drafting_brief` (expected: advance workflow per product rules before research). Checklist POST …/research still 404 (not implemented).

5. **Did framing status respond successfully on staging?** Yes on GET …/frames (includes ai_framing_generation when present).

6. **Failures: environment vs implementation?** 401 on create → auth/JWT config. 404 on /api/v1/health → path mismatch vs docs. 404 on GET …/framing → not implemented (use /frames). 404 on POST …/research → use /research/run with Idempotency-Key.



**Story id (if any):** 96f5e762-f515-44dc-9ed5-c0204d29a74e

**Test user email:** staging-baseline-1776532820578@example.test

## Raw evidence (failed / suspicious)

### Step 6 — Trigger research (requested + repo paths)

```json
{
  "requested_path_POST_research": {
    "status": 404,
    "body": {
      "message": "Cannot POST /api/v1/creator/stories/96f5e762-f515-44dc-9ed5-c0204d29a74e/research",
      "error": "Not Found",
      "statusCode": 404
    }
  },
  "repository_path_POST_research_run": {
    "status": 400,
    "body": {
      "ok": false,
      "error": {
        "code": "invalid_state_transition",
        "message": "Research run is not allowed in the current workflow state",
        "details": {
          "story_state": "drafting_brief"
        }
      }
    }
  }
}
```

---
_Report produced by `scripts/verify-staging-creator-baseline.mjs`._
