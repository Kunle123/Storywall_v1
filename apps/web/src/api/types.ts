/**
 * Creator API envelopes — aligned with apps/api responses and mutation contract §5–9.
 */

import type {
  BriefAudience,
  BriefImageryMode,
  BriefStoryType,
  CreationMode,
  CreatorWorkflowState,
  NarrativeIntent,
  TimeScopeMode,
  WritingStylePreference,
} from "@storywall/shared";

export interface ApiErrorBody {
  ok?: false;
  error?: {
    code?: string;
    message?: string;
    details?: {
      story_brief?: StoryBriefResponse;
      [key: string]: unknown;
    };
  };
  message?: string | string[];
  statusCode?: number;
}

export interface StoryBriefResponse {
  id: string;
  story_id: string;
  creator_id: string;
  subject: string;
  subject_type_input: string | null;
  story_type: BriefStoryType;
  research_brief: string;
  desired_angle: string;
  suggested_time_scope?: string | null;
  time_scope_mode: TimeScopeMode;
  time_scope_start: string | null;
  time_scope_end: string | null;
  audience: BriefAudience | string | null;
  narrative_intent: NarrativeIntent;
  imagery_mode: BriefImageryMode;
  source_inputs: unknown;
  writing_style_preference: WritingStylePreference | string | null;
  creation_mode: CreationMode;
  status?: string;
  updated_at: string;
  created_at: string;
}

export interface CreateStorySuccess {
  ok: true;
  data: {
    story_id: string;
    slug: string;
    story_brief: StoryBriefResponse;
    story_state: CreatorWorkflowState;
  };
}

export interface PatchBriefSuccess {
  ok: true;
  data: {
    story_brief: StoryBriefResponse;
    story_state: CreatorWorkflowState;
  };
  meta?: {
    saved_at?: string;
  };
}

/** GET /creator/stories/:id/framing — M1-T12 (M5-T16 public path; alias of frames list) */
export interface FrameDraftResponse {
  id: string;
  story_brief_id: string;
  title_candidate: string;
  subtitle_candidate: string | null;
  summary_candidate: string;
  lens_candidate: string;
  scope_rationale: string;
  coverage_implications: unknown;
  balance_note: string | null;
  candidate_rank: number;
  is_selected: boolean;
  selection_source: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ListFramesSuccess {
  ok: true;
  data: {
    story_id: string;
    story_state: CreatorWorkflowState;
    /** `stories.story_status` — live lifecycle anchor (M4-T09). */
    story_lifecycle_status?: string;
    published_at?: string | null;
    /** Public reader slug (same as published URL). */
    story_slug?: string;
    /** M5-T26 — `stories.visibility` after last publish (anonymous read gate); draft `visibility_target` can differ until update-live. */
    live_story_visibility?: string;
    frame_drafts: FrameDraftResponse[];
    /** Present when a `story_draft` row exists (after frame select / assembly). */
    story_draft: StoryDraftResponse | null;
    /** M5-T10 audit envelope: live vs deterministic framing (when present). */
    ai_framing_generation?: unknown | null;
  };
}

/** POST …/frames/generate — mutation contract §10.1 (M5-T17 research-entry prerequisite). */
export interface GenerateFramesSuccess {
  ok: true;
  data: {
    story_id: string;
    story_state: CreatorWorkflowState;
    frame_drafts: FrameDraftResponse[];
    ai_framing_generation?: unknown | null;
  };
  meta?: {
    reused_existing?: boolean;
    idempotency_key?: string;
  };
}

export interface StoryDraftResponse {
  id: string;
  story_brief_id: string;
  selected_frame_id: string;
  title: string;
  subtitle: string | null;
  summary: string;
  lens: string;
  conclusion?: string | null;
  subject_type?: string;
  category_primary?: string;
  category_secondary?: string | null;
  time_start?: string | null;
  time_end?: string | null;
  time_display?: string | null;
  lead_priority?: number | null;
  discovery_mode?: string | null;
  story_status: string;
  visibility_target: string;
  imagery_mode: string;
  generation_mode: string;
  needs_human_review?: boolean;
  editorial_review_status: string;
  created_at: string;
  last_edited_at: string;
}

export interface PatchDraftSuccess {
  ok: true;
  data: {
    story_draft: StoryDraftResponse;
    story_state: CreatorWorkflowState;
  };
  meta?: { saved_at?: string };
}

/** Section draft — mutation §13, editor §11. */
export interface SectionDraftResponse {
  id: string;
  story_draft_id: string;
  label: string;
  summary: string | null;
  position_index: number;
  status: string;
  section_origin: string;
  created_at: string;
  updated_at: string;
}

export interface ListSectionsSuccess {
  ok: true;
  data: {
    sections: SectionDraftResponse[];
    story_state: CreatorWorkflowState;
  };
}

export interface CreateSectionSuccess {
  ok: true;
  data: {
    section_draft: SectionDraftResponse;
    story_state: CreatorWorkflowState;
  };
}

export interface PatchSectionSuccess {
  ok: true;
  data: {
    section_draft: SectionDraftResponse;
    story_state: CreatorWorkflowState;
  };
  meta?: { saved_at?: string };
}

export interface CreateSectionBody {
  label: string;
  summary?: string;
}

export type PatchSectionBody = Partial<{
  label: string;
  summary: string | null;
}>;

/** Event draft — mutation §14, editor §12. */
export interface EventDraftResponse {
  id: string;
  story_draft_id: string;
  section_id: string | null;
  headline: string;
  dek: string | null;
  summary: string;
  creator_note: string | null;
  event_type: string;
  position_index: number;
  confidence_state: string;
  claim_risk_level: string;
  status: string;
  created_at: string;
  updated_at: string;
  /** Present on some API list/patch payloads — used for reader-aligned timeline preview. */
  display_date?: string | null;
  location_name?: string | null;
  context_label?: string | null;
}

export interface ListEventsSuccess {
  ok: true;
  data: {
    events: EventDraftResponse[];
    story_state: CreatorWorkflowState;
  };
  /** M5-T15 — present when the story exists but no draft row yet (empty `events` is truthful, not an error). */
  meta?: {
    event_list_scope?: "no_story_draft";
  };
}

export interface CreateEventSuccess {
  ok: true;
  data: {
    event_draft: EventDraftResponse;
    story_state: CreatorWorkflowState;
  };
}

export interface PatchEventSuccess {
  ok: true;
  data: {
    event_draft: EventDraftResponse;
    story_state: CreatorWorkflowState;
  };
  meta?: { saved_at?: string };
}

export interface CreateEventBody {
  section_id?: string | null;
  headline: string;
  summary: string;
}

export type PatchEventBody = Partial<{
  headline: string;
  summary: string;
  dek: string | null;
  creator_note: string | null;
  /** Reader-visible timeline date line; empty string clears to null on the server. */
  display_date: string;
}>;

/** Source record — mutation §15, editor §13. */
export interface SourceRecordResponse {
  id: string;
  event_id: string;
  source_url: string;
  source_title: string;
  publisher_name: string;
  source_type: string;
  published_at: string | null;
  excerpt: string | null;
  relevance_note: string;
  reliability_tier: string;
  verification_status: string;
  is_primary: boolean;
  is_public: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ListSourcesSuccess {
  ok: true;
  data: {
    sources: SourceRecordResponse[];
    story_state: CreatorWorkflowState;
  };
}

export interface CreateSourceSuccess {
  ok: true;
  data: {
    source_record: SourceRecordResponse;
    story_state: CreatorWorkflowState;
  };
}

export interface PatchSourceSuccess {
  ok: true;
  data: {
    source_record: SourceRecordResponse;
    story_state: CreatorWorkflowState;
  };
  meta?: { saved_at?: string };
}

export interface CreateSourceBody {
  source_url: string;
  source_title: string;
  publisher_name: string;
  relevance_note: string;
  published_at?: string | null;
  excerpt?: string | null;
  source_type?: string;
  reliability_tier?: string;
  verification_status?: string;
  is_primary?: boolean;
  is_public?: boolean;
  source_extraction_method?: string;
}

export type PatchSourceBody = Partial<{
  source_url: string;
  source_title: string;
  publisher_name: string;
  relevance_note: string;
  published_at: string | null;
  excerpt: string | null;
  reliability_tier: string;
  verification_status: string;
  is_primary: boolean;
  is_public: boolean;
  status: "draft" | "approved" | "rejected";
}>;

export interface SelectFrameSuccess {
  ok: true;
  data: {
    story_id: string;
    story_state: CreatorWorkflowState;
    selected_frame_id: string;
    /** M5-T19+ — same shape as create/PATCH brief; returned after API deploy so the brief workspace can load without local cache. */
    story_brief?: StoryBriefResponse;
    story_draft: StoryDraftResponse;
    frame_draft: FrameDraftResponse;
  };
  meta?: {
    idempotency_key?: string;
    idempotency_replayed?: boolean;
  };
}

/** GET /creator/jobs/:jobId — unified poll for research_run and draft_assemble (mutation §6). */
export interface CreatorJobPollData {
  job_id: string;
  kind: "research_run" | "draft_assemble";
  status: string;
  story_id: string;
  /** Present when API is M5-T18+ — live story workflow (e.g. `researching` while job active). */
  story_state?: CreatorWorkflowState;
  mode: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
}

export interface PollJobSuccess {
  ok: true;
  data: CreatorJobPollData;
}

/** POST …/research (mutation §11.1; M5-T16 public path, same as …/research/run). */
export interface RunResearchPassBody {
  mode: "full";
  respect_existing_manual_events: boolean;
  respect_existing_sources: boolean;
  notes?: string;
}

export interface RunResearchPassSuccess {
  ok: true;
  data: {
    story_id: string;
    story_state: CreatorWorkflowState;
    job_id: string;
    job_status: string;
  };
  meta?: {
    idempotency_key?: string;
    async_job?: { job_id: string; kind: "research_run" };
    idempotency_replayed?: boolean;
  };
}

/** M5-T09 — GET …/research/jobs/:jobId/package `honesty_summary` (snake_case, API-aligned). */
export interface ResearchPackageHonestySupportRollup {
  fully_source_backed: number;
  partially_source_backed: number;
  chronology_thin_sources: number;
  unresolved_weak: number;
  total_nodes: number;
}

/** M5-T23 — retrieval depth evidence (counts + mode; no speculative scores). */
export interface ResearchRetrievalDepthEvidence {
  retrieval_mode: "stub" | "live" | null;
  synthesis_retrieval_partial: boolean | null;
  candidate_source_count: number;
  distinct_source_hosts: number | null;
  synthesis_finding_count: number;
  sourced_claim_finding_count: number;
  synthesis_cluster_count: number;
}

export interface ResearchPackageRetrievalDepth {
  tier: "thin" | "partial" | "solid";
  evidence: ResearchRetrievalDepthEvidence;
  headline: string;
  next_action: string;
}

/** M5-T24 — structured synthesis utility + downstream wiring (API-aligned). */
export interface ResearchPackageSynthesisOrchestration {
  tier: "thin" | "partial" | "solid";
  evidence: {
    finding_total: number;
    sourced_claim_count: number;
    gap_note_count: number;
    synthesis_summary_count: number;
    cluster_count: number;
    cluster_member_link_count: number;
  };
  consumer_alignment: {
    framing_live_prompt_includes_structured_brief: true;
    chronology_events_materialized: number | null;
    draft_enrichment_package_materialized: boolean | null;
  };
  pipeline_materialization_coherent: boolean | null;
  headline: string;
  next_action: string;
}

export interface ResearchPackageHonestySummary {
  schema_version: string;
  narrative_generation_mode: string;
  provenance_traceability: string;
  has_mixed_or_weak_support: boolean;
  publishable_narrative_posture: string;
  synthesis_retrieval_partial: boolean | null;
  support_status_rollup: ResearchPackageHonestySupportRollup;
  /** M5-T23 — truthful retrieval breadth for chronology/draft downstream work (present after API deploy). */
  retrieval_depth?: ResearchPackageRetrievalDepth;
  /** M5-T24 — synthesis structure vs retrieval depth; pipeline coherence when chronology/enrichment counts known. */
  synthesis_orchestration?: ResearchPackageSynthesisOrchestration;
  ui_hints: readonly string[];
}

/** M5-T26 — tiers from real payload shape (separate from M5-T23–T25). */
export type EnrichmentMaterializationTier = "production_usable" | "usable_with_caveats" | "scaffold_thin";

/** M5-T26 — GET …/package `enrichment_materialization_quality` (snake_case layers; API-aligned). */
export interface EnrichmentMaterializationQualityApi {
  schema_version: string;
  combined_overall: EnrichmentMaterializationTier;
  ui_hint_line: string;
  chronology_layer: {
    event_total: number;
    non_preamble_count: number;
    substantive_event_count: number;
    substantive_event_ratio: number;
    average_summary_chars_substantive: number;
    sourced_claim_row_count: number;
    overall: EnrichmentMaterializationTier;
    headline: string;
    next_action: string;
  };
  draft_enrichment_layer: {
    has_m5_t08_package: boolean;
    summary_spine_chars: number;
    rich_key_event_count: number;
    rich_suggested_section_count: number;
    major_arc_count: number;
    overall: EnrichmentMaterializationTier;
    headline: string;
    next_action: string;
  };
  manuscript_shell: {
    event_draft_count: number;
    substantive_event_draft_count: number;
    narrative_section_count: number;
    sections_with_substantive_summary: number;
    overall: EnrichmentMaterializationTier;
    headline: string;
    next_action: string;
  } | null;
}

/** M5-T26 — lite chronology rows on GET package (for audit; same rows as M2-T03 chronology). */
export interface ChronologyEventLiteApiRow {
  id: string;
  headline: string;
  summary: string;
  context_label: string | null;
  event_type: string;
  position_index: number;
}

/** M5-T27 — content-origin posture (API-aligned). */
export type ProvenanceTruthfulnessOriginPostureApi =
  | "evidence_first"
  | "mixed_evidence_and_model"
  | "scaffold_and_model_led"
  | "thin_or_unclassified";

/** M5-T27 — GET …/package `provenance_truthfulness` (sibling to M5-T23–T26). */
export interface ProvenanceTruthfulnessApi {
  schema_version: string;
  combined_origin_posture: ProvenanceTruthfulnessOriginPostureApi;
  headline: string;
  next_action: string;
  ui_hint_line: string;
  research_origin: {
    candidate_source_rows: number;
    synthesis_parseable: boolean;
    synthesis_retrieval_mode: "stub" | "live" | null;
    synthesis_finding_counts: {
      sourced_claim: number;
      synthesis_summary: number;
      gap_note: number;
      total: number;
    };
    chronology_rows_with_candidate_sourced_claim_trace: number;
    chronology_rows_other_profile: number;
  };
  draft_enrichment_origin: {
    trace_index_present: boolean;
    support_status_counts: {
      fully_source_backed: number;
      partially_source_backed: number;
      chronology_thin_sources: number;
      unresolved_weak: number;
      total_nodes: number;
    };
    fully_source_backed_share: number | null;
    headline: string;
    next_action: string;
  };
  manuscript_origin: {
    event_generation_modes: Record<string, number>;
    section_origins: Record<string, number>;
    creator_touch_signals: {
      manual_after_ai_events: number;
      manual_events: number;
      creator_edited_sections: number;
    };
    headline: string;
    next_action: string;
  } | null;
}

/** GET …/research/jobs/:jobId/package (M2-T02 + M5-T08/09 extensions). */
export interface GetResearchPackageSuccess {
  ok: true;
  data: {
    job_status: string;
    artifact: unknown;
    draft_enrichment_provenance: unknown;
    honesty_summary: ResearchPackageHonestySummary;
    candidate_sources: unknown[];
    /** M5-T26 — optional until API deploy; separate honesty rail from M5-T23–T25. */
    chronology_events_lite?: ChronologyEventLiteApiRow[];
    enrichment_materialization_quality?: EnrichmentMaterializationQualityApi;
    /** M5-T27 — optional until API deploy; content-origin truthfulness. */
    provenance_truthfulness?: ProvenanceTruthfulnessApi;
    /** M5-T11 — when persisted for this job id. */
    live_event_draft_enrichment?: unknown | null;
    /** M5-T12 — when persisted for this job id. */
    ai_editorial_review?: unknown | null;
  };
}

/** POST …/research/jobs/:jobId/editorial-review/generate (M5-T12). */
export interface GenerateEditorialReviewSuccess {
  ok: true;
  data: {
    ai_editorial_review: unknown;
  };
}

/** POST …/draft/assemble (mutation §11.2). M2-T12 scoped regeneration. */
export interface AssembleDraftBody {
  mode: string;
  preserve_creator_notes: boolean;
  preserve_manual_event_positions: boolean;
  preserve_approved_images: boolean;
  scoped_event_id?: string;
  scoped_section_id?: string;
}

export interface AssembleDraftSuccess {
  ok: true;
  data: {
    story_id: string;
    story_state: CreatorWorkflowState;
    job_id: string;
    job_status: string;
  };
  meta?: {
    idempotency_key?: string;
    async_job?: { job_id: string; kind: "draft_assemble" };
    idempotency_replayed?: boolean;
  };
}

/** POST /api/v1/creator/stories body (snake_case, mutation §9.1). */
export interface CreateStoryBody {
  subject: string;
  subject_type_input?: string;
  story_type: BriefStoryType;
  research_brief: string;
  desired_angle: string;
  suggested_time_scope?: string;
  time_scope_mode: TimeScopeMode;
  time_scope_start?: string;
  time_scope_end?: string;
  audience?: string;
  narrative_intent: NarrativeIntent;
  imagery_mode: BriefImageryMode;
  source_inputs?: unknown[];
  writing_style_preference?: string;
  creation_mode: CreationMode;
}

/** PATCH …/draft partial (mutation §12.1). */
export type PatchStoryDraftBody = Partial<{
  title: string;
  subtitle: string | null;
  summary: string;
  lens: string;
  conclusion: string | null;
  category_primary: string;
  category_secondary: string | null;
  lead_priority: number | null;
  discovery_mode: string | null;
  imagery_mode: BriefImageryMode;
  time_start: string | null;
  time_end: string | null;
  time_display: string | null;
  visibility_target: string;
  needs_human_review: boolean;
  editorial_review_status: string;
}>;

/** PATCH …/brief partial (M1-T08). */
export type PatchStoryBriefBody = Partial<{
  subject: string | null;
  subject_type_input: string | null;
  story_type: BriefStoryType | null;
  research_brief: string | null;
  desired_angle: string | null;
  suggested_time_scope: string | null;
  time_scope_mode: TimeScopeMode | null;
  time_scope_start: string | null;
  time_scope_end: string | null;
  audience: string | null;
  narrative_intent: NarrativeIntent | null;
  imagery_mode: BriefImageryMode | null;
  source_inputs: unknown[] | null;
  writing_style_preference: string | null;
  creation_mode: CreationMode | null;
}>;

/** M2-T13 — revision history (editor §17). */
export interface RevisionEntryResponse {
  id: string;
  revision_type: string;
  changed_object_type: string;
  changed_object_id: string;
  change_summary: string;
  is_material_public_change: boolean;
  created_by: string;
  created_at: string;
  recovery_snapshot: unknown;
}

export interface ListRevisionsSuccess {
  ok: true;
  data: {
    revisions: RevisionEntryResponse[];
    story_state: CreatorWorkflowState;
  };
}

export interface RestoreRevisionSuccess {
  ok: true;
  data: {
    restored_from_revision_id: string;
    revision: RevisionEntryResponse;
    story_state: CreatorWorkflowState;
  };
}

/** GET …/validation/latest — M3-T04 */
export interface ValidationIssueRow {
  id: string;
  object_type: string;
  object_id: string;
  issue_type: string;
  severity: string;
  publish_effect: string;
  explanation: string;
  suggested_fix: string | null;
  resolution_status: string;
  event_label: string | null;
}

export interface ValidationReportSummary {
  id: string;
  run_type: string;
  run_source: string;
  overall_result: string;
  issue_count_total: number;
  blocker_count: number;
  warning_count: number;
  summary_note: string;
  created_at: string;
  created_by: string | null;
}

export interface GetLatestValidationSuccess {
  ok: true;
  data: {
    story_state: CreatorWorkflowState;
    has_validation_run: boolean;
    validation_report: ValidationReportSummary | null;
    issues: ValidationIssueRow[];
  };
}

/** POST …/publish — M3-T07 */
export interface PublishStorySuccess {
  ok: true;
  data: {
    published_at: string;
    story_state: CreatorWorkflowState;
    story_status: string;
  };
  meta?: {
    idempotency_key?: string;
    idempotency_replayed?: boolean;
  };
}

/** PATCH …/validation/issues/:issueId — M3-T05 */
export interface PatchValidationIssueResolutionSuccess {
  ok: true;
  data: {
    issue: ValidationIssueRow;
  };
  meta?: {
    idempotency_key?: string;
    idempotency_replayed?: boolean;
  };
}

/** POST …/validation/run — M3-T02 */
export interface RunValidationSuccess {
  ok: true;
  data: {
    validation_report_id: string;
    overall_result: string;
    blocker_count: number;
    warning_count: number;
    story_state: CreatorWorkflowState;
  };
  meta?: {
    idempotency_key?: string;
    idempotency_replayed?: boolean;
  };
}
