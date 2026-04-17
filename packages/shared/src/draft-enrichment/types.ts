/**
 * M5-T07 — creator-side draft enrichment from synthesis + chronology (not publishable narrative).
 * M5-T08 — provenance traceability: stable node ids, structured provenance, support_status on each node.
 * Browser-safe JSON contract; no Node-only imports.
 */

export const DRAFT_ENRICHMENT_SCHEMA_VERSION = "m5-t08-v1" as const;

/** Honest support posture for creator audit (deterministic rules in build.ts). */
export type ProvenanceSupportStatus =
  | "fully_source_backed"
  | "partially_source_backed"
  | "chronology_thin_sources"
  | "unresolved_weak";

/** Concrete upstream references for inspection / future UI. */
export type EnrichmentNodeProvenance = {
  synthesis_finding_ids: readonly string[];
  chronology_event_ids: readonly string[];
  research_candidate_source_ids: readonly string[];
};

export type DraftEnrichmentMajorArc = {
  id: string;
  label: string;
  summary: string;
  member_finding_ids: readonly string[];
  supporting_research_candidate_source_ids: readonly string[];
  origin: "synthesis_cluster" | "synthesis_sourced_bundle" | "chronology_only";
  provenance: EnrichmentNodeProvenance;
  support_status: ProvenanceSupportStatus;
  weak_support_explanation: string | null;
};

export type DraftEnrichmentSuggestedSection = {
  id: string;
  title: string;
  rationale: string;
  linked_synthesis_finding_ids: readonly string[];
  linked_chronology_position_indexes: readonly number[];
  provenance: EnrichmentNodeProvenance;
  support_status: ProvenanceSupportStatus;
  weak_support_explanation: string | null;
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
  provenance: EnrichmentNodeProvenance;
  support_status: ProvenanceSupportStatus;
  weak_support_explanation: string | null;
};

export type DraftEnrichmentCoverageGapNode = {
  id: string;
  text: string;
  provenance: EnrichmentNodeProvenance;
  support_status: ProvenanceSupportStatus;
  weak_support_explanation: string | null;
};

export type DraftEnrichmentAmbiguityNode = {
  id: string;
  text: string;
  provenance: EnrichmentNodeProvenance;
  support_status: ProvenanceSupportStatus;
  weak_support_explanation: string | null;
};

export type DraftEnrichmentSummarySpineNode = {
  id: "summary:spine";
  text: string;
  provenance: EnrichmentNodeProvenance;
  support_status: ProvenanceSupportStatus;
  weak_support_explanation: string | null;
};

export type DraftEnrichmentPackageV1 = {
  schema_version: typeof DRAFT_ENRICHMENT_SCHEMA_VERSION;
  story_id: string;
  research_job_id: string;
  generated_at: string;
  /** Upstream bounded retrieval posture when synthesis package is present */
  retrieval_context: "live" | "stub" | "unknown";
  retrieval_partial: boolean;
  /** Explicit honesty: this object is editorial scaffolding, not a finished article (M5-T07; unchanged intent). */
  not_publishable_narrative_note: string;
  /** M5-T08 — provenance traceability is machine-readable on each node; do not treat absence of links as corroboration. */
  provenance_trace_note: string;
  /** M5-T05 synthesis schema when package parsed; null if legacy research only */
  synthesis_schema_version: string | null;
  /** Chronology extraction version that produced `chronology_events` inputs */
  chronology_extraction_version: string;
  summary_spine: string;
  summary_spine_node: DraftEnrichmentSummarySpineNode;
  major_arcs: readonly DraftEnrichmentMajorArc[];
  suggested_sections: readonly DraftEnrichmentSuggestedSection[];
  key_events: readonly DraftEnrichmentKeyEvent[];
  coverage_gaps: readonly DraftEnrichmentCoverageGapNode[];
  ambiguity_notes: readonly DraftEnrichmentAmbiguityNode[];
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
