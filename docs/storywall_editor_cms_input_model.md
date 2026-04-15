# Storywall Editor and CMS Input Model

**Author:** Manus AI  
**Date:** 2026-04-14

## 1. Purpose

This document defines the **editor and CMS input model** for Storywall v1. Its purpose is to specify exactly what the creator-facing authoring system must collect, store, edit, validate, and hand off to publication. It translates the approved Storywall workflow into a practical mutation model for a real editorial tool.

The central design requirement is that Storywall should not behave like a blank rich-text editor. It should behave like a **structured editorial workspace** in which creators direct story creation, the system drafts and validates structured content, and publication is gated by explicit trust rules. The input model therefore needs to support both **human-authored** and **AI-assisted** creation while forcing both modes to converge into the same reviewable structure.

| Input-model principle | Implementation consequence |
|---|---|
| **Creator-led** | The editor must collect direction, framing, and final approvals from the creator rather than hiding them inside prompts |
| **AI-first but reviewable** | AI outputs should enter the CMS as editable structured objects, not as opaque text blobs |
| **Timeline-first** | Events, sections, chronology, and evidence attachment are first-class editing surfaces |
| **Trust-visible** | Source quality, confidence state, disputes, and validation warnings must be editable and inspectable |
| **Selective imagery** | Imagery must be proposed and approved on eligible surfaces only, not auto-filled everywhere |
| **Publish-gated** | The editor must expose blockers, warnings, and publish readiness as explicit states |

## 2. Scope

This document covers the creator-facing and reviewer-facing input structures required for Storywall v1 authoring. It does not define the public reader response shape in full detail, and it does not attempt to specify visual component design. It focuses on **input structure, field ownership, workflow transitions, persistence boundaries, and validation-bearing records**.

| Covered area | Included |
|---|---|
| **Brief intake** | Yes |
| **Framing selection and editing** | Yes |
| **Draft story metadata** | Yes |
| **Section and event editing** | Yes |
| **Source attachment and evidence review** | Yes |
| **Imagery proposals and approvals** | Yes |
| **Validation outputs and review controls** | Yes |
| **Autosave and revision behavior** | Yes |
| **Public read payloads** | Indirectly, where input fields feed them |
| **Frontend layout design** | No |

## 3. Product Role of the Editor

The Storywall editor is not just a publishing form. It is the **operational center** where creator intent, AI drafting, evidence grounding, and trust review meet. That means the CMS must expose the difference between four types of content: creator instructions, AI-generated draft artifacts, editorially approved story content, and public published output.

| Content layer | Meaning | Typical owner |
|---|---|---|
| **Intent layer** | Brief, framing, scope, narrative intent, imagery mode | Creator |
| **Draft layer** | Generated title options, events, source matches, validation artifacts | AI system + Creator |
| **Editorial layer** | Reviewed story fields, approved events, approved references, final imagery choices | Creator |
| **Published layer** | Public story and public timeline records | System after publish approval |

The CMS should make those layers legible. If creators cannot tell whether something is a prompt input, an AI proposal, a required editorial field, or a publishable final value, the workflow will become brittle and confusing.

## 4. Recommended Top-Level Entity Model

The editor should operate on a small number of explicit top-level records. This avoids overloading the public story tables with every temporary artifact while preserving full traceability.

| Top-level record | Role in the editor |
|---|---|
| `story_brief` | Stores initial creator intent and normalization inputs |
| `story_frame_draft` | Stores framing candidates and approved framing state |
| `story_draft` | Holds the editable draft package that can later promote into public story tables |
| `section_draft` | Holds editorial section candidates and approved sections |
| `event_draft` | Holds timeline events before or alongside publish promotion |
| `source_record` | Holds evidence objects attached to event drafts |
| `image_proposal` | Holds proposed or selected visuals with eligibility and approval state |
| `validation_report` | Holds structured trust and quality findings |
| `publish_decision` | Holds final readiness, warnings, blocks, and publish audit trail |
| `revision_entry` | Holds autosave, version, and human-edit history metadata |

## 5. Workflow-to-Form Mapping

The CMS should mirror the approved Storywall workflow rather than collapsing everything into one long form. Each workflow stage should have its own input model, completion logic, and mutation boundary.

| Workflow stage | CMS module | Primary record |
|---|---|---|
| **0 — Entry and brief intake** | Story setup form | `story_brief` |
| **1 — Brief normalization** | Normalized brief review panel | `story_brief` |
| **2 — Framing proposals** | Framing chooser and editor | `story_frame_draft` |
| **3 — Research and source assembly** | Evidence review workspace | `event_draft` + `source_record` |
| **4 — Full draft assembly** | Draft story editor | `story_draft`, `section_draft`, `event_draft` |
| **5 — Imagery proposal** | Image eligibility and approval panel | `image_proposal` |
| **6 — Human editing** | Main editorial workspace | `story_draft`, `section_draft`, `event_draft`, `source_record` |
| **7 — Validation and trust review** | Validation center | `validation_report` |
| **8 — Publication** | Publish review and action panel | `publish_decision` |

## 6. Global State Model for the Editor

The CMS should expose the story’s operational state clearly so creators understand what is editable, what is pending, and what prevents publication.

| State | Meaning | Primary editable areas |
|---|---|---|
| **drafting_brief** | Creator is still defining subject and scope | Brief inputs |
| **awaiting_framing_choice** | Framing options exist but creator has not chosen one | Framing candidates and scope edits |
| **researching** | System is assembling evidence and candidate events | Read-only progress, source inputs, cancellation controls |
| **assembling_draft** | System is building the structured story draft | Read-only progress, optional source additions |
| **ready_for_edit** | Draft package is editable | Full editor workspace |
| **needs_validation** | Creator has marked draft as ready for checks | Validation center |
| **blocked** | High-severity validation issues prevent publish | Blocked objects and fixes |
| **ready_to_publish** | Validation passes the minimum standard | Publish controls |
| **published** | Story is live | Post-publish editing and update workflow |

## 7. `story_brief` Input Model

The brief record is the first durable object in the CMS. It must capture creator intent clearly enough that the system can normalize and generate from it without guessing too much.

### 7.1 `story_brief` fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Internal record identifier |
| `creator_id` | UUID | Yes | Story owner |
| `subject` | String | Yes | Main topic entered by the creator |
| `subject_type_input` | Enum or `null` | No | Optional creator override before normalization |
| `story_type` | Enum | Yes | Biography, issue history, influence, controversy, movement history, relationship impact, custom |
| `research_brief` | Text | Yes | Plain-language creator description |
| `desired_angle` | Text | Yes | Creator’s starting framing or hypothesis |
| `time_scope_mode` | Enum | Yes | `entire_history`, `bounded_range`, `open_recent`, `custom` |
| `time_scope_start` | Date or `null` | No | Optional lower time bound |
| `time_scope_end` | Date or `null` | No | Optional upper time bound |
| `audience` | Enum or String | No | General, fan, student, specialist, custom |
| `narrative_intent` | Enum | Yes | Documentary, explanatory, analytical, commemorative, comparative |
| `imagery_mode` | Enum | Yes | `selective_editorial`, `minimal`, `sourced_only`, `no_imagery` |
| `source_inputs` | JSON Array | No | URLs, uploads, notes, or imported materials |
| `writing_style_preference` | Enum | No | Neutral, analytical, concise, documentary |
| `creation_mode` | Enum | Yes | `ai_first`, `hybrid`, `manual_heavy` |
| `status` | Enum | Yes | `draft`, `submitted`, `normalized` |
| `created_at` | DateTime | Yes | Creation timestamp |
| `updated_at` | DateTime | Yes | Last modification timestamp |

### 7.2 Brief-entry behavior rules

| Rule | Standard |
|---|---|
| **Subject is mandatory** | No downstream generation without a clear subject |
| **Angle is mandatory** | Creator must provide a reason for the story, not just a topic label |
| **Weak inputs can be assisted** | The editor may offer canned starters instead of hard rejection |
| **Source inputs are optional** | Storywall must support both source-led and prompt-led starts |
| **Imagery mode is chosen early** | Image generation and proposal behavior should inherit this choice |

## 8. `story_brief` Normalization Overlay

The CMS should not replace the creator’s brief with normalized outputs invisibly. Instead, it should show the normalized interpretation in a review overlay or side panel.

| Normalization field | Purpose |
|---|---|
| `normalized_subject` | Canonical internal subject label |
| `subject_type_normalized` | System-inferred subject class |
| `suggested_time_scope` | Recommended temporal boundary |
| `story_angle_candidates` | Candidate framings based on the brief |
| `prompt_risks` | Ambiguity, recency risk, likely dispute, low-source risk, scope imbalance |
| `recommended_creation_mode` | System recommendation for AI/manual balance |
| `normalization_status` | `pending`, `complete`, `needs_creator_attention` |

The editor should allow the creator to **accept**, **edit**, or **override** normalized results. Normalization should be a visible decision-support step, not a silent rewrite.

## 9. `story_frame_draft` Input Model

This record captures the decision point where Storywall becomes a specific story rather than a topic prompt.

### 9.1 `story_frame_draft` fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Internal identifier |
| `story_brief_id` | UUID | Yes | Parent brief |
| `title_candidate` | String | Yes | Proposed story title |
| `subtitle_candidate` | String or `null` | No | Optional discovery subtitle |
| `summary_candidate` | Text | Yes | Factual story summary candidate |
| `lens_candidate` | Text | Yes | One-sentence interpretive frame |
| `scope_rationale` | Text | Yes | Why this framing and scope are coherent |
| `coverage_implications` | JSON Array | Yes | What the frame prioritizes |
| `balance_note` | Text or `null` | No | Whether alternate views may be required |
| `section_candidates` | JSON Array | No | Candidate section labels |
| `confidence_summary_initial` | Enum | Yes | Initial trust posture |
| `candidate_rank` | Integer | Yes | Ordering among framing choices |
| `is_selected` | Boolean | Yes | Whether this framing is the chosen base |
| `selection_source` | Enum | Yes | `ai_proposed`, `creator_edited`, `creator_written` |
| `status` | Enum | Yes | `proposed`, `selected`, `discarded`, `superseded` |

### 9.2 Framing-screen behavior

| Creator action | Result |
|---|---|
| **Accept frame** | Selected framing is promoted into the story draft shell |
| **Edit frame** | Edited values become selected record state |
| **Combine frames** | New composite record is created and marked selected |
| **Request more options** | Additional candidates are generated without deleting prior ones |
| **Change brief inputs** | Existing frame candidates are marked stale or superseded |

## 10. `story_draft` Input Model

The story draft is the primary editorial workspace record. It should hold the working story-level fields that ultimately map to the public `stories` entity, while also carrying internal review metadata.

### 10.1 `story_draft` fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Draft identifier |
| `story_brief_id` | UUID | Yes | Parent brief |
| `selected_frame_id` | UUID | Yes | Chosen framing basis |
| `title` | String | Yes | Working story title |
| `subtitle` | String or `null` | No | Working subtitle |
| `summary` | Text | Yes | Factual story summary |
| `lens` | Text | Yes | Creator framing line |
| `conclusion` | Text or `null` | No | Final synthesis block |
| `subject_type` | Enum | Yes | Canonical subject type |
| `category_primary` | String | Yes | Primary editorial category |
| `category_secondary` | String or `null` | No | Optional secondary category |
| `time_start` | DateTime or `null` | No | Story lower bound |
| `time_end` | DateTime or `null` | No | Story upper bound |
| `time_display` | String or `null` | No | Public date-range label |
| `story_status` | Enum | Yes | `draft`, `review`, `published`, `archived` |
| `visibility_target` | Enum | Yes | `public`, `unlisted`, `private` |
| `lead_priority` | Integer or `null` | No | Editorial ordering hint |
| `discovery_mode` | Enum or `null` | No | `editorial`, `recent`, `trending`, `featured` |
| `imagery_mode` | Enum | Yes | Inherited and editable imagery policy |
| `generation_mode` | Enum | Yes | `manual`, `ai_draft`, `ai_assisted`, `manual_after_ai` |
| `generation_prompt_version` | String or `null` | No | Audit field for AI-generated drafts |
| `generation_model` | String or `null` | No | Model audit field |
| `generation_run_id` | String or `null` | No | Links related AI artifacts |
| `needs_human_review` | Boolean | Yes | Explicit human review gate |
| `editorial_review_status` | Enum | Yes | `unreviewed`, `reviewed`, `approved`, `revised` |
| `autosave_status` | Enum | Yes | `saved`, `saving`, `conflict`, `error` |
| `revision_count` | Integer | Yes | Number of recorded revisions |
| `last_edited_by` | UUID | Yes | Most recent editor |
| `last_edited_at` | DateTime | Yes | Last draft modification |

### 10.2 Story-draft editing rules

| Rule | Standard |
|---|---|
| **Summary stays factual** | Interpretive language should live in `lens` or creator notes, not the story summary |
| **Lens remains explicit** | The CMS should never bury the framing sentence |
| **Conclusion is optional until final review** | But must exist before publish if the story needs synthesis |
| **AI audit fields are internal** | These fields support review and traceability, not public display |
| **Autosave is required** | The editor should treat story-level inputs as autosaved structured fields |

## 11. `section_draft` Input Model

Sections are optional but strategically useful for long or interpretive timelines. The CMS should support them without requiring them for simple stories.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Section draft identifier |
| `story_draft_id` | UUID | Yes | Parent draft |
| `label` | String | Yes | Section title such as Origins or Fallout |
| `summary` | Text or `null` | No | Section framing text |
| `position_index` | Integer | Yes | Display order |
| `time_start` | DateTime or `null` | No | Optional start bound |
| `time_end` | DateTime or `null` | No | Optional end bound |
| `status` | Enum | Yes | `draft`, `approved`, `removed` |
| `source` | Enum | Yes | `ai_generated`, `creator_added`, `creator_edited` |

The editor should allow section drag-and-drop reordering, event assignment into sections, and optional section summaries. If sections are absent, the timeline should still remain publishable as a flat ordered event sequence.

## 12. `event_draft` Input Model

Event drafts are the heart of the Storywall editor. They must expose event meaning, chronology, trust posture, and editorial hierarchy without requiring creators to fight raw JSON.

### 12.1 `event_draft` fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Event draft identifier |
| `story_draft_id` | UUID | Yes | Parent story draft |
| `section_draft_id` | UUID or `null` | No | Optional parent section |
| `slug` | String or `null` | No | Optional anchor slug |
| `headline` | String | Yes | Event-led title |
| `dek` | String or `null` | No | Optional supporting subtitle |
| `summary` | Text | Yes | Factual event summary |
| `creator_note` | Text or `null` | No | Separate interpretive note |
| `event_type` | Enum | Yes | `standard`, `turning_point`, `context_note`, `synthesis`, `chatter`, `corroboration_cluster` |
| `context_label` | String or `null` | No | Origin, Shift, Escalation, Response, Fallout, etc. |
| `significance_level` | Enum | Yes | `minor`, `standard`, `major`, `critical` |
| `event_date_start` | DateTime or `null` | No | Primary lower date bound |
| `event_date_end` | DateTime or `null` | No | Optional upper date bound |
| `event_date_precision` | Enum | Yes | `year`, `month`, `day`, `time`, `approximate`, `unknown` |
| `display_date` | String or `null` | No | Human-readable override |
| `year_anchor` | Integer or `null` | No | Timeline rail support |
| `position_index` | Integer | Yes | Canonical event order |
| `interval_note` | String or `null` | No | Optional spacing cue |
| `location_name` | String or `null` | No | Human-readable location |
| `media_kind` | Enum | Yes | `image`, `video`, `document`, `map`, `none` |
| `media_primary_candidate_id` | UUID or `null` | No | Approved image proposal or asset |
| `source_count` | Integer | Yes | Derived count of visible attached sources |
| `source_density` | Enum | Yes | `none`, `low`, `medium`, `high` |
| `confidence_state` | Enum | Yes | `verified`, `mostly_verified`, `emerging`, `disputed`, `retracted` |
| `claim_risk_level` | Enum | Yes | `low`, `medium`, `high` |
| `moderation_status` | Enum | Yes | `pending`, `approved`, `flagged`, `rejected` |
| `is_shareable` | Boolean | Yes | Whether event can become a share card |
| `is_pinned` | Boolean | Yes | Whether event should remain highlighted |
| `is_featured_in_summary` | Boolean | Yes | Whether event contributes to recap blocks |
| `generation_mode` | Enum | Yes | `manual`, `ai_draft`, `ai_assisted`, `manual_after_ai` |
| `generation_run_id` | String or `null` | No | AI generation linkage |
| `editorial_review_status` | Enum | Yes | `unreviewed`, `reviewed`, `approved`, `revised` |
| `status` | Enum | Yes | `draft`, `ready`, `removed`, `published` |

### 12.2 Event-editor behavior rules

| Rule | Standard |
|---|---|
| **Headlines must be event-led** | The editor should discourage article-headline phrasing |
| **Summary and creator note remain separate** | No mixed fact/opinion blocks |
| **Turning-point use should stay selective** | The UI should not let every event feel major by default |
| **Chatter remains de-emphasized** | Chatter events should inherit stricter styling and imagery restrictions |
| **Position order is editable** | Chronology is primary, but editorial ordering overrides must be possible |
| **Confidence is explicit** | Every event must carry a confidence state before publish review |

## 13. `source_record` Input Model

Evidence should be editable as a first-class child record of the event editor.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Source identifier |
| `event_draft_id` | UUID | Yes | Parent event |
| `source_url` | String | Yes | Canonical source URL |
| `source_title` | String | Yes | Human-readable title |
| `publisher_name` | String | Yes | Source origin |
| `source_type` | Enum | Yes | `article`, `report`, `document`, `video`, `audio`, `archive`, `social_post`, `dataset`, `other` |
| `published_at` | DateTime or `null` | No | Original source time |
| `excerpt` | Text or `null` | No | Useful excerpt |
| `relevance_note` | Text | Yes | Why this source supports the event |
| `reliability_tier` | Enum | Yes | `high`, `medium`, `low`, `unrated` |
| `verification_status` | Enum | Yes | `verified`, `partially_verified`, `unreviewed`, `contested`, `rejected` |
| `is_primary` | Boolean | Yes | Whether source is primary evidence |
| `is_public` | Boolean | Yes | Whether source is visible to readers |
| `duplicate_signal` | Boolean | Yes | Whether source appears duplicative |
| `source_extraction_method` | Enum | Yes | `manual`, `ai_extracted`, `imported` |
| `added_by` | UUID | Yes | Creator or system actor |
| `status` | Enum | Yes | `draft`, `approved`, `rejected` |

### 13.1 Source-editing rules

| Rule | Standard |
|---|---|
| **Relevance note is mandatory** | Prevent decorative sourcing |
| **Visibility is explicit** | Editors must choose whether a source is public-facing |
| **Verification is separate from reliability** | The UI should expose both controls distinctly |
| **Duplicate suggestions are advisory** | Editors may retain multiple corroborating sources when justified |
| **Rejected sources remain auditable** | Rejection should not silently delete evidence history |

## 14. `image_proposal` Input Model

Because Storywall uses imagery selectively, image inputs should live in their own proposal object rather than inside generic media fields alone.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Proposal identifier |
| `story_draft_id` | UUID | Yes | Parent story draft |
| `target_type` | Enum | Yes | `story_cover`, `story_share`, `event`, `section` |
| `target_id` | UUID or `null` | No | Event or section if applicable |
| `eligibility_reason` | String | Yes | Why the surface is allowed to receive imagery |
| `proposal_source` | Enum | Yes | `ai_generated`, `licensed`, `archival`, `manual_upload` |
| `prompt_context` | Text or `null` | No | Stored generation context for AI-created proposals |
| `style_mode` | Enum | Yes | `editorial`, `archival`, `illustrative`, `minimal` |
| `asset_url` | String or `null` | No | Candidate asset URL |
| `asset_alt` | String or `null` | No | Accessibility text |
| `asset_credit` | String or `null` | No | Attribution |
| `approval_status` | Enum | Yes | `proposed`, `approved`, `rejected`, `superseded` |
| `is_public_selected` | Boolean | Yes | Whether this asset becomes the chosen public image |
| `notes` | Text or `null` | No | Creator or reviewer notes |

### 14.1 Image-policy rules inside the CMS

| Rule | Standard |
|---|---|
| **Not every event is image-eligible** | The editor should enforce Storywall’s selective imagery policy |
| **Chatter and weak-confidence events default to text-only** | Low-confidence content should not gain false authority through imagery |
| **Human approval is required** | No proposed image should publish without creator confirmation |
| **Asset provenance is stored** | Readers may not see all provenance details, but the CMS must retain them |

## 15. `validation_report` Input Model

Validation must be stored as structured output, not a freeform note. This lets the CMS filter issues, block publish, and target the exact story objects that need revision.

### 15.1 Validation report fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Validation run identifier |
| `story_draft_id` | UUID | Yes | Parent story draft |
| `run_type` | Enum | Yes | `structure`, `trust`, `style`, `publish_readiness`, `full` |
| `run_source` | Enum | Yes | `system`, `creator_requested`, `reviewer_requested` |
| `overall_result` | Enum | Yes | `pass`, `warn`, `block` |
| `issue_count_total` | Integer | Yes | Total issue count |
| `blocker_count` | Integer | Yes | Number of blocking issues |
| `warning_count` | Integer | Yes | Number of warnings |
| `summary_note` | Text | Yes | Human-readable summary |
| `created_at` | DateTime | Yes | Run timestamp |
| `created_by` | UUID or `null` | No | Actor or system process |

### 15.2 Validation issue child fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Issue identifier |
| `validation_report_id` | UUID | Yes | Parent validation run |
| `object_type` | Enum | Yes | `story`, `section`, `event`, `source`, `image` |
| `object_id` | UUID | Yes | Target object |
| `issue_type` | Enum | Yes | `overclaim`, `unsupported`, `duplicate`, `timeline_gap`, `tone_drift`, `missing_source`, `disputed_view_missing`, `imagery_risk`, `missing_synthesis`, `other` |
| `severity` | Enum | Yes | `low`, `medium`, `high` |
| `publish_effect` | Enum | Yes | `none`, `warn`, `block` |
| `explanation` | Text | Yes | Plain-language explanation |
| `suggested_fix` | Text or `null` | No | Recommended correction |
| `resolution_status` | Enum | Yes | `open`, `accepted`, `dismissed`, `resolved` |
| `resolved_by` | UUID or `null` | No | Actor who closed the issue |
| `resolved_at` | DateTime or `null` | No | Resolution timestamp |

## 16. `publish_decision` Input Model

Publish actions should be explicit, auditable, and separate from general draft editing.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Publish decision identifier |
| `story_draft_id` | UUID | Yes | Parent draft |
| `requested_visibility` | Enum | Yes | `public`, `unlisted`, `private` |
| `current_readiness_state` | Enum | Yes | `blocked`, `warn`, `ready` |
| `blocker_snapshot_count` | Integer | Yes | Blocking issue count at action time |
| `warning_snapshot_count` | Integer | Yes | Warning count at action time |
| `creator_acknowledged_warnings` | Boolean | Yes | Required when warning-only publish is allowed |
| `publish_note` | Text or `null` | No | Optional creator note |
| `decision_status` | Enum | Yes | `pending`, `approved`, `rejected`, `published`, `failed` |
| `decided_by` | UUID | Yes | Creator or reviewer actor |
| `decided_at` | DateTime | Yes | Decision time |
| `published_story_id` | UUID or `null` | No | Resulting public story record |

The publish panel should summarize blockers, warnings, confidence posture, source visibility, and revision status before the creator confirms publication.

## 17. `revision_entry` Input Model

Subtle edit signaling and auditability require a lightweight but real revision model.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID | Yes | Revision entry identifier |
| `story_draft_id` | UUID | Yes | Parent draft |
| `revision_type` | Enum | Yes | `autosave`, `manual_edit`, `ai_regeneration`, `review_resolution`, `publish_promotion` |
| `changed_object_type` | Enum | Yes | `story`, `section`, `event`, `source`, `image`, `validation`, `publish` |
| `changed_object_id` | UUID | Yes | Changed object |
| `change_summary` | Text | Yes | Human-readable summary of the change |
| `is_material_public_change` | Boolean | Yes | Whether the change should influence subtle reader-facing edit signaling |
| `created_by` | UUID | Yes | Actor or system process |
| `created_at` | DateTime | Yes | Revision timestamp |

The CMS does not need a noisy “track changes” experience for v1, but it does need enough revision structure to support internal auditing and a restrained post-publish edit signal.

## 18. Editor Form Architecture

The CMS should avoid a single giant form. A staged, modular form architecture will better match the Storywall workflow and reduce cognitive overload.

| Workspace module | Main records touched |
|---|---|
| **Story setup** | `story_brief` |
| **Framing** | `story_frame_draft` |
| **Story header editor** | `story_draft` |
| **Timeline editor** | `section_draft`, `event_draft` |
| **Reference manager** | `source_record` |
| **Image planner** | `image_proposal` |
| **Validation center** | `validation_report` |
| **Publish panel** | `publish_decision` |

Each module should autosave independently where possible and expose local field validation, while the story-level state machine governs overall progression.

## 19. Autosave, Drafting, and Mutation Boundaries

The CMS must be explicit about what saves immediately, what requires confirmation, and what triggers a publish-affecting state transition.

| Mutation type | Save behavior | Notes |
|---|---|---|
| **Field edits in brief, frame, story, section, event, and source forms** | Autosave | Use optimistic local state with server acknowledgment |
| **Event reorder** | Autosave with ordering confirmation | Should update `position_index` atomically |
| **AI regenerate action** | Explicit confirmation required | Should create a revision entry and preserve prior version access |
| **Validation run** | Explicit action | Should create immutable validation report record |
| **Approve image proposal** | Explicit action | Should mark prior selected proposal as superseded if replaced |
| **Publish action** | Explicit action with blocker gate | Must never be implicit or autosaved |

### 19.1 Conflict handling

| Conflict state | Expected editor behavior |
|---|---|
| **Network delay** | Show `saving` state without blocking typing |
| **Save failure** | Show `error` state and retry affordance |
| **Concurrent edit conflict** | Show `conflict` state and require human choice |
| **Regeneration would overwrite edits** | Warn and require explicit confirmation |

## 20. Permissions and Role Boundaries

Storywall v1 may start with a narrow role model, but the CMS should still define editing authority clearly.

| Role | Allowed actions |
|---|---|
| **Creator** | Create briefs, select framing, edit drafts, approve images, resolve warnings, publish |
| **Reviewer** | Inspect validation, flag risks, resolve or escalate certain issues, block publish if policy requires |
| **System** | Normalize briefs, generate candidates, run validation, attach draft artifacts, record audit metadata |

The system may propose content, but only a creator or authorized reviewer should be able to approve public-facing editorial meaning.

## 21. Mapping from Editor Inputs to Public Reads

The CMS should produce the exact field families needed by the public homepage and timeline contracts.

| Public read object | Supplied by editor inputs |
|---|---|
| **StoryCardPublic** | `story_draft.title`, `subtitle`, `summary`, `lens`, cover image selection, creator identity, derived counts, publish state |
| **StorySummaryPublic** | Story-level metadata plus `conclusion` and trust summary |
| **TimelineSectionPublic** | Approved `section_draft` records |
| **EventCardPublic** | Approved `event_draft` records plus selected media and derived trust fields |
| **ReferenceItemPublic** | Approved public `source_record` entries |
| **TrustBadge** | Derived from validation and confidence fields, not free text alone |

This mapping is important because the editor should not encourage fields that have no downstream product role, and the public product should not depend on data the CMS never explicitly collects.

## 22. Minimum Required Review Surfaces Before Publish

The CMS should force the creator through a short set of mandatory review surfaces before publish. These are the places where Storywall’s editorial discipline becomes operational rather than aspirational.

| Review surface | Why it must exist |
|---|---|
| **Story frame review** | Confirms the story is about the intended thing |
| **Timeline and event review** | Confirms chronology, hierarchy, and event-led clarity |
| **Reference review** | Confirms evidence relevance and visibility |
| **Confidence and dispute review** | Confirms uncertainty is legible where necessary |
| **Image review** | Confirms imagery does not overstate confidence |
| **Publish summary** | Confirms creator accountability before public release |

## 23. Acceptance Criteria

The editor and CMS input model should be considered implementation-ready only if all of the following are satisfied.

| ID | Acceptance criterion |
|---|---|
| **CMS-1** | The CMS can capture a structured brief without reducing the creator to a single prompt box |
| **CMS-2** | AI-generated and manually created stories converge into the same editable draft structures |
| **CMS-3** | Story, section, event, source, and image records can be edited independently with autosave support |
| **CMS-4** | Validation issues are stored as structured records and can block publish |
| **CMS-5** | Fact fields and interpretation fields remain separate throughout the authoring flow |
| **CMS-6** | Image approval is selective and tied to explicit eligibility rules |
| **CMS-7** | The publish action is auditable and cannot bypass blocker conditions |
| **CMS-8** | The editor’s saved fields map cleanly onto the database migration plan and the public API contracts |

## 24. Final Recommendation

The Storywall editor should be built as a **structured editorial operating system**, not as a general-purpose CMS with Storywall labels on top. The workflow is strongest when creators can see the exact relationship between intent, AI proposals, evidence, trust posture, and final publish readiness.

With the PRD, creator workflow, publishing standard, build matrix, API contracts, database migration plan, and this editor/CMS input model now defined, the next most useful documents would be a **mutation/API contract for creator-side endpoints** and a **field-level moderation and reviewer permissions specification**. Those two documents would complete the bridge from product definition into implementation-ready backend and frontend work.
