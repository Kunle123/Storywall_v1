/**
 * M5-T05 — structured research synthesis over persisted `research_candidate_source` rows.
 * Browser-safe JSON contract for API + worker; no Node-only imports.
 */

export const RESEARCH_SYNTHESIS_SCHEMA_VERSION = "m5-t05-v1" as const;

/** Directly tied to excerpt/title text from a persisted candidate row. */
export type ResearchSynthesisFindingKind = "sourced_claim" | "synthesis_summary" | "gap_note";

export type ResearchSynthesisConfidence = "low" | "medium" | "high";

export type ResearchSynthesisFinding = {
  /** Stable id within this package (deterministic for a given job + inputs). */
  id: string;
  kind: ResearchSynthesisFindingKind;
  text: string;
  /** Provenance: UUIDs of `research_candidate_source` rows this finding rests on. */
  supporting_research_candidate_source_ids: readonly string[];
  confidence: ResearchSynthesisConfidence;
};

export type ResearchSynthesisCluster = {
  id: string;
  label: string;
  summary: string;
  member_finding_ids: readonly string[];
  supporting_research_candidate_source_ids: readonly string[];
};

export type ResearchSynthesisPackageV1 = {
  schema_version: typeof RESEARCH_SYNTHESIS_SCHEMA_VERSION;
  retrieval_mode: "stub" | "live";
  retrieval_partial: boolean;
  retrieval_partial_notes?: string;
  generated_at: string;
  coverage_notes: readonly string[];
  open_questions: readonly string[];
  findings: readonly ResearchSynthesisFinding[];
  clusters: readonly ResearchSynthesisCluster[];
};

export type ResearchSynthesisSourceInput = {
  id: string;
  positionIndex: number;
  sourceUrl: string;
  sourceTitle: string;
  excerpt: string | null;
  relevanceNote: string;
  reliabilityTier: string;
};
