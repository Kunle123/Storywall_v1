# Storywall Creator-Side Mutation and API Contracts

**Author:** Manus AI  
**Date:** 2026-04-14

## 1. Purpose

This document defines the **creator-side mutation and API contracts** for Storywall v1. Its role is to translate the approved creator workflow, editor/CMS input model, database migration plan, and public read-model dependencies into implementation-ready write operations.

The goal is not simply to list endpoints. It is to define a coherent **write contract system** for Storywall’s creator-facing product. That system must support structured brief intake, framing choice, AI-assisted draft generation, event and source editing, selective imagery approval, validation runs, and explicit publication actions without collapsing everything into one generic “save draft” endpoint.

| Contract principle | Implementation consequence |
|---|---|
| **Structured writing, not freeform blobs** | Mutations target named records such as briefs, frames, story drafts, events, sources, and image proposals |
| **Autosave for editing, explicit actions for transitions** | Field edits should save optimistically, while generation, validation, and publish actions require explicit commands |
| **State machine discipline** | Write endpoints must respect workflow states such as `drafting_brief`, `ready_for_edit`, `blocked`, and `ready_to_publish` |
| **AI outputs are proposals, not silent overrides** | Regeneration and generation endpoints must create or update reviewable draft objects rather than overwrite approved content invisibly |
| **Trust-bearing edits are first-class** | Source relevance, confidence states, dispute flags, and validation results need explicit write paths |
| **Public reads depend on editorial writes** | Mutation outputs must preserve the fields later required by homepage and timeline contracts |

## 2. Scope

This document covers the creator-authenticated API surface used by the Storywall authoring product. It is focused on **write operations**, though some lightweight creator-side read endpoints are included where they are necessary to support mutation flows such as conflict recovery, autosave refresh, or validation review.

| Included area | Covered here |
|---|---|
| **Brief creation and update** | Yes |
| **Normalization and framing commands** | Yes |
| **AI research and draft-assembly commands** | Yes |
| **Story, section, event, source, and image mutations** | Yes |
| **Validation and publish commands** | Yes |
| **Idempotency and conflict handling** | Yes |
| **Creator-side supporting reads** | Yes, minimally |
| **Public reader GET contracts** | No, covered separately |
| **Reviewer moderation-only contracts** | No, should be a separate document |

## 3. API Surface Philosophy

The safest Storywall write model is a combination of **resource mutations** and **workflow commands**. Resource mutations handle creator edits to persistent objects. Workflow commands trigger stateful operations such as normalization, frame generation, research, draft assembly, validation, and publish.

That separation matters because Storywall mixes ordinary field editing with expensive or consequential operations. A title edit should behave very differently from a publish action or a research rerun. If the API does not distinguish them, the application will become hard to reason about and difficult to audit.

| API surface type | Use when | Typical verbs |
|---|---|---|
| **Resource mutation** | Updating stored creator-controlled records | `POST`, `PATCH`, `DELETE` |
| **Workflow command** | Triggering stage changes or AI/system work | Usually `POST` to action endpoints |
| **Supporting read** | Hydrating editor state after writes or conflicts | `GET` |

## 4. Common Base Path and Authentication

All creator-side endpoints should live under a dedicated authenticated namespace.

| Item | Contract |
|---|---|
| **Base path** | `/api/v1/creator` |
| **Authentication** | Required for all creator routes |
| **Actor identity** | Resolved server-side from session or token |
| **Authorization rule** | Creator may only mutate records they own, unless future reviewer roles are granted explicit access |
| **Transport** | HTTPS only |

## 5. Common Request and Response Envelopes

Creator-side contracts should keep the same general discipline as public read contracts while adding mutation-specific metadata.

### 5.1 Success envelope

| Field | Type | Required | Description |
|---|---|---|---|
| `ok` | Boolean | Yes | Always `true` on success |
| `request_id` | String | Yes | Trace identifier |
| `api_version` | String | Yes | Contract version string |
| `data` | Object | Yes | Endpoint-specific result object |
| `meta` | Object | No | Autosave, revision, pagination, or async metadata |

### 5.2 Error envelope

| Field | Type | Required | Description |
|---|---|---|---|
| `ok` | Boolean | Yes | Always `false` on failure |
| `request_id` | String | Yes | Trace identifier |
| `error.code` | String | Yes | Stable machine-readable code |
| `error.message` | String | Yes | Human-readable message |
| `error.details` | Object | No | Structured validation, conflict, or state information |

### 5.3 Mutation metadata

| Field | Type | Required | Description |
|---|---|---|---|
| `meta.revision_id` | UUID | No | Created revision entry if applicable |
| `meta.saved_at` | DateTime | No | Server-confirmed save time |
| `meta.idempotency_key` | String | No | Echoed idempotency key for explicit commands |
| `meta.story_state` | Enum | No | Resulting global workflow state |
| `meta.conflict_detected` | Boolean | No | Whether the save encountered a version conflict |
| `meta.async_job` | Object | No | Job token for long-running generation or validation actions |

## 6. Common Concurrency and Idempotency Rules

Storywall’s editor model requires both optimistic autosave and safe replay of expensive commands. The contracts should therefore distinguish between **versioned updates** and **idempotent actions**.

| Mechanism | Required for | Contract |
|---|---|---|
| **`If-Match` or version token** | `PATCH` autosave mutations | Client sends the latest known object revision or version |
| **Idempotency key** | Explicit `POST` actions such as generation, validation, and publish | Client sends `Idempotency-Key` header or body field |
| **Server revision increment** | All successful write operations | Server returns updated revision version |
| **Conflict error** | Version mismatch on autosave | Server returns `409 conflict` with latest server object snapshot or diff summary |

### 6.1 Recommended headers

| Header | Use |
|---|---|
| `Authorization` | Authenticated creator session or bearer token |
| `Idempotency-Key` | Required for generation, validation, and publish commands |
| `If-Match` | Required for patch-style autosave mutations |
| `Content-Type: application/json` | Standard JSON contract |

### 6.2 Standard creator-side error codes

| Code | Meaning |
|---|---|
| `unauthorized` | No valid creator session |
| `forbidden` | Actor cannot mutate the target record |
| `story_not_found` | Story or parent draft not found |
| `invalid_state_transition` | Requested action is not allowed from current state |
| `validation_failed` | Request payload did not satisfy schema rules |
| `conflict` | Version mismatch or concurrent edit conflict |
| `idempotency_replayed` | Same idempotency key returned prior result |
| `generation_in_progress` | Similar AI action already running |
| `publish_blocked` | Publish action rejected because blockers remain |
| `rate_limited` | Too many write attempts or heavy actions |
| `internal_error` | Unexpected server failure |

## 7. Global Workflow State Contract

The creator-facing write layer should always be able to return the story’s global workflow state after a consequential action.

| State | Meaning | Allowed next actions |
|---|---|---|
| `drafting_brief` | Creator is entering setup information | Update brief, submit brief |
| `awaiting_framing_choice` | Framing options exist | Select frame, regenerate frames, edit brief |
| `researching` | Research job is active | Poll job, cancel job, add source inputs |
| `assembling_draft` | Draft assembly job is active | Poll job, cancel job |
| `ready_for_edit` | Draft is editable | Patch story, sections, events, sources, images |
| `needs_validation` | Creator has requested checks | Run validation |
| `blocked` | Validation blockers remain | Fix objects, rerun validation |
| `ready_to_publish` | Draft passes required checks | Publish or save further edits |
| `published` | Story is live | Update draft for post-publish revision workflow |

## 8. Supporting Creator Read Endpoints

Although this document is primarily about mutations, the editor still needs a small set of authenticated reads to recover from autosave failures, refresh screen state, and inspect validation results.

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/creator/stories/:storyId/workspace` | Hydrates the full editor workspace state |
| `GET /api/v1/creator/stories/:storyId/validation-reports/:reportId` | Retrieves one validation result set |
| `GET /api/v1/creator/jobs/:jobId` | Polls long-running generation or validation jobs |
| `GET /api/v1/creator/stories/:storyId/revisions` | Retrieves revision history for conflict recovery or audit |

These reads should return creator-scoped objects rather than public read models.

## 9. Brief Intake Mutations

The first write surface should create and update the `story_brief` record.

### 9.1 Create story brief

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories` |
| **Purpose** | Creates a new creator story workspace with an initial brief |
| **Idempotency** | Optional but recommended when created from client retries |
| **Resulting state** | `drafting_brief` or `awaiting_framing_choice` if auto-submit is requested |

#### Request body

```json
{
  "subject": "Whitney Houston",
  "story_type": "biography",
  "research_brief": "Create a grounded story about Whitney Houston's life and career, with special attention to how fame, relationships, and industry pressure shaped her trajectory.",
  "desired_angle": "How the forces around Whitney Houston affected both her art and her life.",
  "time_scope_mode": "entire_history",
  "audience": "general",
  "narrative_intent": "explanatory",
  "imagery_mode": "selective_editorial",
  "source_inputs": [],
  "writing_style_preference": "documentary",
  "creation_mode": "ai_first"
}
```

#### Response body shape

| Field | Description |
|---|---|
| `data.story_id` | New story workspace identifier |
| `data.story_brief` | Persisted brief object |
| `data.story_state` | Current workflow state |

### 9.2 Patch story brief

| Item | Contract |
|---|---|
| **Method and path** | `PATCH /api/v1/creator/stories/:storyId/brief` |
| **Purpose** | Autosaves creator edits to the brief |
| **Concurrency** | Requires `If-Match` or version token |
| **Resulting state** | Usually remains `drafting_brief` |

#### Request body

```json
{
  "research_brief": "Create a grounded story about Whitney Houston's life, career, and relationships, showing how different pressures changed her path.",
  "desired_angle": "The forces that shaped Whitney Houston's life and livelihood.",
  "time_scope_mode": "entire_history"
}
```

### 9.3 Submit brief for normalization

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/brief/submit` |
| **Purpose** | Locks a coherent brief snapshot and requests normalization |
| **Idempotency** | Required |
| **Resulting state** | `awaiting_framing_choice` after normalization completes |

#### Response body shape

| Field | Description |
|---|---|
| `data.job_id` | Async normalization job identifier |
| `data.story_state` | Usually `drafting_brief` until job completes or `awaiting_framing_choice` if synchronous |

## 10. Normalization and Framing Commands

Framing selection is central to Storywall’s editorial model, so it should have explicit command endpoints rather than being hidden inside one draft mutation.

### 10.1 Generate framing options

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/frames/generate` |
| **Purpose** | Generates 2 to 4 framing candidates from the latest brief snapshot |
| **Idempotency** | Required |
| **Allowed states** | `drafting_brief`, `awaiting_framing_choice` |

#### Optional request body

```json
{
  "replace_existing_unselected_frames": false,
  "notes": "Give one option centered on relationships and one focused on career turning points."
}
```

### 10.2 Select a framing option

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/frames/select` |
| **Purpose** | Marks one framing record as selected and promotes it to the draft basis |
| **Idempotency** | Required |
| **Allowed states** | `awaiting_framing_choice` |
| **Resulting state** | `researching` or `ready_for_edit` if a draft already exists and the system uses lightweight reselection logic |

#### Request body

```json
{
  "frame_id": "9bb0d8a4-d34a-48fa-8512-8bc4f1d47715",
  "selection_mode": "accept"
}
```

### 10.3 Save a creator-edited framing

| Item | Contract |
|---|---|
| **Method and path** | `PATCH /api/v1/creator/stories/:storyId/frames/:frameId` |
| **Purpose** | Autosaves edits to a framing candidate |
| **Concurrency** | Requires version token |

### 10.4 Create a composite framing

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/frames/compose` |
| **Purpose** | Creates a new frame from multiple existing candidates or creator-written values |
| **Idempotency** | Required |

## 11. Research and Draft-Assembly Commands

Research and draft assembly are heavier actions that should be modeled as asynchronous jobs. They should not masquerade as plain save operations.

### 11.1 Start research pass

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/research/run` |
| **Purpose** | Builds evidence package, candidate events, source matches, and risk flags |
| **Idempotency** | Required |
| **Allowed states** | `awaiting_framing_choice`, `ready_for_edit` when requesting rerun |
| **Resulting state** | `researching` |

#### Request body

```json
{
  "mode": "full",
  "respect_existing_manual_events": true,
  "respect_existing_sources": true,
  "notes": "Prioritize major life, career, and relationship turning points."
}
```

### 11.2 Start full draft assembly

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/draft/assemble` |
| **Purpose** | Generates or regenerates the structured story draft from approved frame and research package |
| **Idempotency** | Required |
| **Allowed states** | `awaiting_framing_choice`, `ready_for_edit`, `blocked` |
| **Resulting state** | `assembling_draft` then `ready_for_edit` |

#### Request body

```json
{
  "mode": "full_regeneration",
  "preserve_creator_notes": true,
  "preserve_manual_event_positions": false,
  "preserve_approved_images": true
}
```

### 11.3 Cancel an active job

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/jobs/:jobId/cancel` |
| **Purpose** | Requests cancellation of a long-running AI or validation job |
| **Idempotency** | Required |

## 12. Story-Level Draft Mutations

Once the story is in `ready_for_edit`, story-level fields should autosave through a versioned `PATCH` contract.

### 12.1 Patch story draft

| Item | Contract |
|---|---|
| **Method and path** | `PATCH /api/v1/creator/stories/:storyId/draft` |
| **Purpose** | Saves story-level editorial changes |
| **Concurrency** | Requires version token |
| **Allowed states** | `ready_for_edit`, `blocked`, `ready_to_publish`, `published` for post-publish draft updates |

#### Mutable fields

| Field family | Examples |
|---|---|
| **Story presentation** | `title`, `subtitle`, `summary`, `lens`, `conclusion` |
| **Story taxonomy** | `category_primary`, `category_secondary`, `lead_priority`, `discovery_mode` |
| **Time and visibility intent** | `time_start`, `time_end`, `time_display`, `visibility_target` |
| **Workflow audit fields** | `needs_human_review`, `editorial_review_status` |

## 13. Section Mutations

Sections are optional, but when they exist they should behave as normal editable resources.

### 13.1 Create section

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/sections` |
| **Purpose** | Creates a new section draft |
| **Allowed states** | `ready_for_edit`, `blocked`, `ready_to_publish` |

### 13.2 Patch section

| Item | Contract |
|---|---|
| **Method and path** | `PATCH /api/v1/creator/stories/:storyId/sections/:sectionId` |
| **Purpose** | Autosaves section edits |
| **Concurrency** | Requires version token |

### 13.3 Reorder sections

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/sections/reorder` |
| **Purpose** | Updates `position_index` atomically across sections |
| **Idempotency** | Required |

### 13.4 Remove section

| Item | Contract |
|---|---|
| **Method and path** | `DELETE /api/v1/creator/stories/:storyId/sections/:sectionId` |
| **Purpose** | Soft-removes a section or marks it `removed` |
| **Contract note** | Server should reject if it would orphan required content without explicit reassignment strategy |

## 14. Event Mutations

Event mutations are the most important creator-side writes because Storywall’s public experience depends on them directly.

### 14.1 Create event

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/events` |
| **Purpose** | Adds a manual or system-seeded event draft |
| **Allowed states** | `ready_for_edit`, `blocked`, `ready_to_publish` |

#### Request body

```json
{
  "section_id": null,
  "headline": "Whitney Houston signs with Arista Records",
  "summary": "Whitney Houston entered a recording contract with Arista, creating the platform for her rise to global pop stardom.",
  "creator_note": null,
  "event_type": "turning_point",
  "context_label": "Breakthrough",
  "significance_level": "major",
  "event_date_start": "1983-01-01T00:00:00Z",
  "event_date_precision": "year",
  "position_index": 4,
  "confidence_state": "mostly_verified",
  "claim_risk_level": "low",
  "is_shareable": true,
  "is_pinned": true,
  "is_featured_in_summary": true
}
```

### 14.2 Patch event

| Item | Contract |
|---|---|
| **Method and path** | `PATCH /api/v1/creator/stories/:storyId/events/:eventId` |
| **Purpose** | Autosaves event-level edits |
| **Concurrency** | Requires version token |

#### Mutable fields

| Field family | Examples |
|---|---|
| **Narrative fields** | `headline`, `dek`, `summary`, `creator_note` |
| **Classification fields** | `event_type`, `context_label`, `significance_level`, `confidence_state`, `claim_risk_level` |
| **Temporal fields** | `event_date_start`, `event_date_end`, `event_date_precision`, `display_date`, `year_anchor`, `interval_note` |
| **Presentation fields** | `location_name`, `is_shareable`, `is_pinned`, `is_featured_in_summary` |
| **Placement fields** | `section_id`, `position_index` |

### 14.3 Reorder events

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/events/reorder` |
| **Purpose** | Applies atomic ordering changes across multiple events |
| **Idempotency** | Required |

#### Request body

```json
{
  "items": [
    {"event_id": "3f1c6579-e85f-40c0-bab2-d343fcb4cf37", "position_index": 1},
    {"event_id": "4ed1125c-0ed8-4a24-b59e-9368e54e06de", "position_index": 2}
  ]
}
```

### 14.4 Remove event

| Item | Contract |
|---|---|
| **Method and path** | `DELETE /api/v1/creator/stories/:storyId/events/:eventId` |
| **Purpose** | Soft-removes an event draft |
| **Contract note** | Published events should usually transition into a revision workflow rather than hard deletion |

## 15. Source Mutations

Sources are not merely attachments. They are trust-bearing editorial objects. Their write contracts should therefore include evidence relevance and visibility explicitly.

### 15.1 Add source to event

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/events/:eventId/sources` |
| **Purpose** | Creates a new source record attached to an event |
| **Allowed states** | `ready_for_edit`, `blocked`, `ready_to_publish` |

#### Request body

```json
{
  "source_url": "https://example.com/archive/1983-whitney-signing",
  "source_title": "Whitney Houston Signs With Arista Records",
  "publisher_name": "Example Archive",
  "source_type": "archive",
  "published_at": "1983-01-10T00:00:00Z",
  "excerpt": null,
  "relevance_note": "Documents the signing event directly.",
  "reliability_tier": "high",
  "verification_status": "verified",
  "is_primary": true,
  "is_public": true,
  "source_extraction_method": "manual"
}
```

### 15.2 Patch source

| Item | Contract |
|---|---|
| **Method and path** | `PATCH /api/v1/creator/stories/:storyId/events/:eventId/sources/:sourceId` |
| **Purpose** | Autosaves source edits such as relevance, visibility, or verification |
| **Concurrency** | Requires version token |

### 15.3 Bulk attach or merge sources

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/sources/bulk-upsert` |
| **Purpose** | Efficiently writes source sets returned by research or imported bundles |
| **Idempotency** | Required |
| **Contract note** | The server should deduplicate by canonical URL and event match rules where possible |

### 15.4 Reject or hide source

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/events/:eventId/sources/:sourceId/reject` |
| **Purpose** | Marks a source `rejected` or non-public without losing audit history |
| **Idempotency** | Required |

## 16. Image Proposal Mutations

Image writes should preserve Storywall’s selective imagery policy and make approval explicit.

### 16.1 Create image proposal

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/images/proposals` |
| **Purpose** | Creates a manual or system proposal for a story, section, or event surface |
| **Allowed states** | `ready_for_edit`, `blocked`, `ready_to_publish` |

### 16.2 Request AI image proposals

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/images/generate` |
| **Purpose** | Triggers image proposal generation for eligible surfaces |
| **Idempotency** | Required |
| **Contract note** | The server should reject surfaces that violate imagery eligibility rules |

### 16.3 Approve image proposal

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/images/proposals/:proposalId/approve` |
| **Purpose** | Marks one proposal as the selected public image for a target surface |
| **Idempotency** | Required |
| **Side effect** | Prior selected proposal for the same target becomes `superseded` |

### 16.4 Reject image proposal

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/images/proposals/:proposalId/reject` |
| **Purpose** | Rejects a proposed asset and stores rationale if needed |
| **Idempotency** | Required |

## 17. Validation Commands

Validation should run as an explicit command that creates a durable report instead of mutating draft state implicitly.

### 17.1 Run validation

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/validation/run` |
| **Purpose** | Executes structure, trust, and publish-readiness checks |
| **Idempotency** | Required |
| **Allowed states** | `ready_for_edit`, `needs_validation`, `blocked`, `ready_to_publish` |
| **Resulting state** | `blocked` or `ready_to_publish` |

#### Request body

```json
{
  "run_type": "full",
  "include_style_checks": true,
  "include_imagery_checks": true,
  "include_dispute_checks": true
}
```

#### Response body shape

| Field | Description |
|---|---|
| `data.validation_report_id` | Created report identifier |
| `data.overall_result` | `pass`, `warn`, or `block` |
| `data.blocker_count` | Number of blocker issues |
| `data.warning_count` | Number of warnings |
| `data.story_state` | Resulting workflow state |

### 17.2 Resolve validation issue

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/validation/issues/:issueId/resolve` |
| **Purpose** | Records creator or reviewer resolution for one issue |
| **Idempotency** | Required |
| **Contract note** | Resolution should not silently change story state without a follow-up validation pass unless the issue type is purely administrative |

## 18. Publish Commands

Publish is the highest-consequence creator-side action, so it should have a dedicated preparation step and a dedicated final action.

### 18.1 Prepare publish summary

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/publish/prepare` |
| **Purpose** | Produces the final readiness snapshot before a publish decision |
| **Idempotency** | Required |
| **Allowed states** | `blocked`, `ready_to_publish` |

#### Response body shape

| Field | Description |
|---|---|
| `data.readiness_state` | `blocked`, `warn`, or `ready` |
| `data.blockers` | Structured blocker list |
| `data.warnings` | Structured warning list |
| `data.public_projection` | Compact preview of title, summary, trust, and counts |

### 18.2 Publish story

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/publish` |
| **Purpose** | Promotes the approved draft into public published records |
| **Idempotency** | Required |
| **Allowed states** | `ready_to_publish` or `warn`-eligible state if warnings have been acknowledged |
| **Rejected when** | Validation blockers remain or required publish acknowledgments are missing |

#### Request body

```json
{
  "requested_visibility": "public",
  "creator_acknowledged_warnings": true,
  "publish_note": "Reviewed for factual grounding and timeline completeness."
}
```

#### Response body shape

| Field | Description |
|---|---|
| `data.published_story_id` | Public story identifier |
| `data.slug` | Public slug |
| `data.visibility` | Final public visibility |
| `data.published_at` | Publication timestamp |
| `data.story_state` | `published` |

### 18.3 Unpublish or revert visibility

| Item | Contract |
|---|---|
| **Method and path** | `POST /api/v1/creator/stories/:storyId/unpublish` |
| **Purpose** | Changes a published story to non-public visibility or archived state |
| **Idempotency** | Required |
| **Contract note** | This should remain separate from ordinary draft edits because it changes public availability |

## 19. Recommended Object Fragments Returned by Write Endpoints

Write endpoints should return enough structured state to keep the editor responsive without always forcing a full workspace reload.

| Mutation family | Recommended response object |
|---|---|
| **Brief mutations** | Updated `story_brief` plus workflow state |
| **Frame mutations** | Updated frame list summary plus selected frame |
| **Story patch** | Updated `story_draft` fragment and revision metadata |
| **Section patch** | Updated section object |
| **Event patch** | Updated event object and any derived ordering summary |
| **Source patch** | Updated source object plus event-level source counters |
| **Image approval** | Updated proposal object plus target-level selected-image summary |
| **Validation run** | Validation summary and report identifier |
| **Publish** | Published projection and public identifiers |

## 20. Autosave Contract Pattern

Because Storywall’s editor is structured and modular, autosave should be predictable across resource types.

| Rule | Standard |
|---|---|
| **Resource `PATCH` endpoints autosave** | Briefs, frames, story drafts, sections, events, and sources should use patch semantics |
| **Each autosave returns canonical server state** | Client should reconcile with server-confirmed values after each save |
| **Autosave failures do not silently drop edits** | Client should retain local pending changes until confirmed or rejected |
| **Conflict responses include recovery hints** | Server should return latest version, changed fields, or a workspace refresh token |

### 20.1 Example conflict response

```json
{
  "ok": false,
  "request_id": "req_01HZX8N7E0P4Y2",
  "error": {
    "code": "conflict",
    "message": "The event was updated from another session.",
    "details": {
      "resource_type": "event_draft",
      "resource_id": "4ed1125c-0ed8-4a24-b59e-9368e54e06de",
      "server_version": 12,
      "client_version": 10,
      "reload_endpoint": "/api/v1/creator/stories/story_123/workspace"
    }
  }
}
```

## 21. State-Transition Rules

Storywall should make illegal transitions impossible at the API layer, not just inconvenient in the UI.

| From state | Action | Allowed? | Result |
|---|---|---|---|
| `drafting_brief` | `POST /brief/submit` | Yes | Normalization begins |
| `drafting_brief` | `POST /publish` | No | `invalid_state_transition` |
| `awaiting_framing_choice` | `POST /frames/select` | Yes | Research or draft pathway begins |
| `awaiting_framing_choice` | `POST /draft/assemble` | Conditionally | Allowed only if a selected frame exists |
| `researching` | `PATCH /events/:id` | Usually no | Event editing should wait until research or draft exists |
| `ready_for_edit` | `POST /validation/run` | Yes | Validation report created |
| `blocked` | `POST /publish` | No | `publish_blocked` |
| `ready_to_publish` | `POST /publish` | Yes | Story becomes public |
| `published` | `PATCH /draft` | Yes | Starts post-publish revision path, not silent direct public overwrite |

## 22. Mapping to the Editor/CMS Model

The creator-side API should map directly onto the editor objects already defined in the CMS input model.

| CMS object | Primary write endpoints |
|---|---|
| `story_brief` | `POST /stories`, `PATCH /stories/:storyId/brief`, `POST /brief/submit` |
| `story_frame_draft` | `POST /frames/generate`, `PATCH /frames/:frameId`, `POST /frames/select`, `POST /frames/compose` |
| `story_draft` | `POST /draft/assemble`, `PATCH /stories/:storyId/draft` |
| `section_draft` | `POST /sections`, `PATCH /sections/:sectionId`, `POST /sections/reorder`, `DELETE /sections/:sectionId` |
| `event_draft` | `POST /events`, `PATCH /events/:eventId`, `POST /events/reorder`, `DELETE /events/:eventId` |
| `source_record` | `POST /events/:eventId/sources`, `PATCH /sources/:sourceId`, `POST /sources/bulk-upsert`, `POST /sources/:sourceId/reject` |
| `image_proposal` | `POST /images/proposals`, `POST /images/generate`, `POST /images/proposals/:proposalId/approve`, `POST /images/proposals/:proposalId/reject` |
| `validation_report` | `POST /validation/run`, `POST /validation/issues/:issueId/resolve` |
| `publish_decision` | `POST /publish/prepare`, `POST /publish`, `POST /unpublish` |

## 23. Mapping to Public Read Dependencies

Creator-side writes should preserve the fields required later by public homepage and timeline contracts.

| Public dependency | Creator-side write origin |
|---|---|
| **Public title, summary, lens, conclusion** | Story draft patch and frame selection |
| **Public section ordering** | Section create, patch, and reorder mutations |
| **Event cards and chronology** | Event create, patch, and reorder mutations |
| **Trust badges and confidence summaries** | Event confidence fields, source visibility, and validation runs |
| **Reference previews and source counts** | Source add, patch, reject, and bulk upsert operations |
| **Selective imagery surfaces** | Image proposal and approval endpoints |
| **Published visibility and slug** | Publish command |

## 24. Acceptance Criteria

The creator-side mutation layer should be considered implementation-ready only if the following conditions are satisfied.

| ID | Acceptance criterion |
|---|---|
| **MUT-1** | The API distinguishes autosave resource mutations from explicit workflow commands |
| **MUT-2** | Every editor object in the CMS model has a clear write path |
| **MUT-3** | Expensive or consequential actions use idempotent command endpoints |
| **MUT-4** | Versioned autosave conflicts can be detected and recovered safely |
| **MUT-5** | Invalid workflow transitions are blocked at the API layer |
| **MUT-6** | Source relevance, confidence, visibility, and validation states are first-class mutation targets |
| **MUT-7** | Publish cannot succeed when blockers remain |
| **MUT-8** | Write outputs preserve the fields required by downstream public read models |

## 25. Final Recommendation

The Storywall creator-side API should be implemented as a **workflow-aware write system**, not as a thin CRUD layer. The product’s quality depends on maintaining a clear distinction between ordinary edits, AI-assisted stage transitions, trust validation, and publication.

With this document in place, the next most useful technical specification is the **reviewer permissions and moderation-state contract**, because creator-side writes are now defined, but the escalation, approval, and intervention rules for reviewers still need a precise authority model.
