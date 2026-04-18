/**
 * M5-T11 — persisted + API contract for live AI event/draft enrichment (creator guidance; not publishable).
 */

export const LIVE_EVENT_DRAFT_ENRICHMENT_SCHEMA_VERSION = "m5-t11-v1" as const;

export type LiveEnrichmentGenerationMode = "live_ai_backed" | "deterministic_scaffolding_fallback";

export type LiveEnrichmentStatus = "succeeded" | "fallback_deterministic";

export type LiveEnrichmentGroundingRefKind =
  | "synthesis_finding"
  | "chronology_event"
  | "research_candidate_source"
  | "framing_option"
  | "honesty_signal";

export type LiveEnrichmentGroundingRef = {
  kind: LiveEnrichmentGroundingRefKind;
  id?: string;
  label?: string;
};

export type LiveEnrichmentEnrichedEvent = {
  id: string;
  chronology_event_id: string;
  narrative_expansion: string;
  emphasis_note: string | null;
  caution_note: string | null;
  grounding_refs: readonly LiveEnrichmentGroundingRef[];
};

export type LiveEnrichmentSuggestedSection = {
  id: string;
  title: string;
  purpose: string;
  supporting_chronology_event_ids: readonly string[];
  supporting_synthesis_finding_ids: readonly string[];
  caution_note: string | null;
  grounding_refs: readonly LiveEnrichmentGroundingRef[];
};

export type LiveEnrichmentFramingReference = {
  framing_generation_prompt_key: string | null;
  framing_option_ids: readonly string[];
};

export type LiveEnrichmentFailure = {
  code: string;
  message: string;
};

export type LiveEventDraftEnrichmentPackageV1 = {
  schema_version: typeof LIVE_EVENT_DRAFT_ENRICHMENT_SCHEMA_VERSION;
  generation_mode: LiveEnrichmentGenerationMode;
  status: LiveEnrichmentStatus;
  prompt_template_key: string;
  prompt_version: string;
  provider: string;
  model: string | null;
  story_id: string;
  research_job_id: string;
  framing_reference: LiveEnrichmentFramingReference | null;
  honesty_context: unknown | null;
  enriched_events: readonly LiveEnrichmentEnrichedEvent[];
  suggested_sections: readonly LiveEnrichmentSuggestedSection[];
  not_publishable_enrichment_note: string;
  failure: LiveEnrichmentFailure | null;
  generated_at: string;
};
