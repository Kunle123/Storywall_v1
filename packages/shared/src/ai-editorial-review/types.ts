/**
 * M5-T12 — AI-assisted editorial review (creator guidance; not authoritative validation).
 */

export const AI_EDITORIAL_REVIEW_SCHEMA_VERSION = "m5-t12-v1" as const;

export type EditorialReviewMode = "live_ai_backed" | "deterministic_honesty_fallback";

export type EditorialReviewStatus = "succeeded" | "fallback_deterministic";

export type EditorialReviewGroundingRefKind =
  | "synthesis_finding"
  | "chronology_event"
  | "research_candidate_source"
  | "framing_option"
  | "honesty_signal"
  | "live_enrichment_event"
  | "live_enrichment_section";

export type EditorialReviewGroundingRef = {
  kind: EditorialReviewGroundingRefKind;
  id?: string;
  label?: string;
};

/** Machine-facing category; unknown LLM labels map to `other` at parse time. */
export type EditorialReviewFindingCategory =
  | "thin_support"
  | "overclaim_risk"
  | "duplication_or_repetition"
  | "missing_context"
  | "chronology_emphasis"
  | "follow_up_research"
  | "other";

export type EditorialReviewFindingSeverity = "info" | "low" | "medium" | "high";

export type EditorialReviewFinding = {
  id: string;
  category: EditorialReviewFindingCategory;
  severity: EditorialReviewFindingSeverity;
  explanation: string;
  suggested_action: string | null;
  grounding_refs: readonly EditorialReviewGroundingRef[];
};

export type EditorialReviewFramingReference = {
  framing_generation_prompt_key: string | null;
  framing_option_ids: readonly string[];
};

export type EditorialReviewLiveEnrichmentReference = {
  enrichment_prompt_template_key: string | null;
  enrichment_schema_version: string | null;
  /** Sample of stable ids from M5-T11 output included in this review context. */
  sampled_enriched_event_ids: readonly string[];
  sampled_suggested_section_ids: readonly string[];
};

export type EditorialReviewFailure = {
  code: string;
  message: string;
};

export type AiEditorialReviewPackageV1 = {
  schema_version: typeof AI_EDITORIAL_REVIEW_SCHEMA_VERSION;
  review_mode: EditorialReviewMode;
  status: EditorialReviewStatus;
  prompt_template_key: string;
  prompt_version: string;
  provider: string;
  model: string | null;
  story_id: string;
  research_job_id: string;
  framing_reference: EditorialReviewFramingReference | null;
  live_enrichment_reference: EditorialReviewLiveEnrichmentReference | null;
  honesty_context: unknown | null;
  review_findings: readonly EditorialReviewFinding[];
  overall_editorial_posture: string;
  /** Fixed line: model review is advisory, not a substitute for sourcing or rule-based validation. */
  not_authoritative_review_note: string;
  failure: EditorialReviewFailure | null;
  generated_at: string;
};
