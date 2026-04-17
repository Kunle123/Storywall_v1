/**
 * M5-T07 — creator-side draft enrichment from synthesis + chronology (not publishable narrative).
 * Browser-safe JSON contract; no Node-only imports.
 */

export const DRAFT_ENRICHMENT_SCHEMA_VERSION = "m5-t07-v1" as const;

export type DraftEnrichmentMajorArc = {
  id: string;
  label: string;
  summary: string;
  member_finding_ids: readonly string[];
  supporting_research_candidate_source_ids: readonly string[];
  /** Where this arc was derived from for inspection */
  origin: "synthesis_cluster" | "synthesis_sourced_bundle" | "chronology_only";
};

export type DraftEnrichmentSuggestedSection = {
  title: string;
  rationale: string;
  linked_synthesis_finding_ids: readonly string[];
  linked_chronology_position_indexes: readonly number[];
};

export type DraftEnrichmentKeyEvent = {
  chronology_event_id: string;
  position_index: number;
  headline: string;
  summary_clip: string;
  event_type: string;
  context_label: string | null;
  supporting_research_candidate_source_ids: readonly string[];
  linked_synthesis_finding_ids: readonly string[];
  claim_risk_level: string;
  confidence_state: string;
  ambiguity_carryforward: string | null;
};

export type DraftEnrichmentPackageV1 = {
  schema_version: typeof DRAFT_ENRICHMENT_SCHEMA_VERSION;
  story_id: string;
  research_job_id: string;
  generated_at: string;
  /** Upstream bounded retrieval posture when synthesis package is present */
  retrieval_context: "live" | "stub" | "unknown";
  retrieval_partial: boolean;
  /** Explicit honesty: this object is editorial scaffolding, not a finished article */
  not_publishable_narrative_note: string;
  /** M5-T05 synthesis schema when package parsed; null if legacy research only */
  synthesis_schema_version: string | null;
  /** Chronology extraction version that produced `chronology_events` inputs */
  chronology_extraction_version: string;
  summary_spine: string;
  major_arcs: readonly DraftEnrichmentMajorArc[];
  suggested_sections: readonly DraftEnrichmentSuggestedSection[];
  key_events: readonly DraftEnrichmentKeyEvent[];
  coverage_gaps: readonly string[];
  ambiguity_notes: readonly string[];
};

export type ChronologyEventEnrichmentInput = {
  id: string;
  positionIndex: number;
  headline: string;
  summary: string;
  contextLabel: string | null;
  eventType: string;
  supportingCandidateSourceIds: readonly string[];
  ambiguityNote: string | null;
  creatorNote: string | null;
  claimRiskLevel: string;
  confidenceState: string;
};
