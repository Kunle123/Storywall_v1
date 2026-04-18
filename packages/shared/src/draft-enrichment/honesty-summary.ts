/**
 * M5-T09 — compact creator-facing honesty signals for the research package + draft enrichment path.
 * Deterministic only; no LLM. Derived from persisted synthesis + enrichment + provenance index.
 */

import { parseResearchSynthesisPackageV1 } from "../research-synthesis/parse";
import {
  computeRetrievalDepthAssessment,
  type RetrievalDepthEvidence,
  type RetrievalDepthTier,
} from "../research-synthesis/retrieval-depth";
import {
  computeSynthesisOrchestrationAssessment,
  type SynthesisOrchestrationAssessment,
} from "../research-synthesis/synthesis-orchestration";
import { buildDraftEnrichmentProvenanceIndex } from "./provenance-index";
import type { DraftEnrichmentProvenanceIndexNode } from "./provenance-index";

export const RESEARCH_PACKAGE_HONESTY_SUMMARY_VERSION = "m5-t09-v1" as const;

export type ResearchPackageNarrativeGenerationMode = "deterministic_scaffolding" | "unknown";

export type ResearchPackageProvenanceTraceabilityLevel =
  | "full_m5_t08"
  | "legacy_package_no_node_provenance_index"
  | "unavailable_no_enrichment";

export type ResearchPackageHonestySupportRollup = {
  fully_source_backed: number;
  partially_source_backed: number;
  chronology_thin_sources: number;
  unresolved_weak: number;
  total_nodes: number;
};

/** M5-T23 — compact retrieval depth (counts + mode only; no speculative scoring). */
export type ResearchPackageRetrievalDepth = {
  tier: RetrievalDepthTier;
  evidence: RetrievalDepthEvidence;
  headline: string;
  next_action: string;
};

/** M5-T24 — synthesis structure + downstream materialization (no speculative AI scores). */
export type ResearchPackageSynthesisOrchestration = Omit<SynthesisOrchestrationAssessment, "ui_hint_line">;

export type ResearchPackageHonestySummary = {
  schema_version: typeof RESEARCH_PACKAGE_HONESTY_SUMMARY_VERSION;
  /** Current research pipeline output is deterministic scaffolding, not live model-authored story prose. */
  narrative_generation_mode: ResearchPackageNarrativeGenerationMode;
  provenance_traceability: ResearchPackageProvenanceTraceabilityLevel;
  /** True when any enrichment node is not fully source-backed, or synthesis retrieval was partial, or legacy/unaudited package. */
  has_mixed_or_weak_support: boolean;
  /** Research artifacts and draft enrichment are creator guidance, not publishable narrative. */
  publishable_narrative_posture: "creator_guidance_only";
  /** From M5-T05 synthesis when parseable; null if no synthesis package present. */
  synthesis_retrieval_partial: boolean | null;
  support_status_rollup: ResearchPackageHonestySupportRollup;
  /** M5-T23 — truthful retrieval breadth vs stub/live mode (deterministic from persisted rows + synthesis). */
  retrieval_depth: ResearchPackageRetrievalDepth;
  /** M5-T24 — structured synthesis package utility + pipeline wiring hints. */
  synthesis_orchestration: ResearchPackageSynthesisOrchestration;
  /** Short lines safe to show inline in creator UI. */
  ui_hints: readonly string[];
};

function emptyRollup(): ResearchPackageHonestySupportRollup {
  return {
    fully_source_backed: 0,
    partially_source_backed: 0,
    chronology_thin_sources: 0,
    unresolved_weak: 0,
    total_nodes: 0,
  };
}

function rollupFromProvenanceNodes(nodes: readonly DraftEnrichmentProvenanceIndexNode[]): ResearchPackageHonestySupportRollup {
  const out = emptyRollup();
  for (const n of nodes) {
    out.total_nodes += 1;
    switch (n.support_status) {
      case "fully_source_backed":
        out.fully_source_backed += 1;
        break;
      case "partially_source_backed":
        out.partially_source_backed += 1;
        break;
      case "chronology_thin_sources":
        out.chronology_thin_sources += 1;
        break;
      case "unresolved_weak":
        out.unresolved_weak += 1;
        break;
      default:
        out.unresolved_weak += 1;
        break;
    }
  }
  return out;
}

function bumpSupportStatus(rollup: ResearchPackageHonestySupportRollup, supportStatus: unknown): void {
  if (typeof supportStatus !== "string") return;
  rollup.total_nodes += 1;
  switch (supportStatus) {
    case "fully_source_backed":
      rollup.fully_source_backed += 1;
      break;
    case "partially_source_backed":
      rollup.partially_source_backed += 1;
      break;
    case "chronology_thin_sources":
      rollup.chronology_thin_sources += 1;
      break;
    case "unresolved_weak":
      rollup.unresolved_weak += 1;
      break;
    default:
      rollup.unresolved_weak += 1;
      break;
  }
}

/** Fallback when provenance index is unavailable but M5-T08-shaped rows may still carry support_status. */
function rollupFromRawEnrichmentObject(raw: Record<string, unknown>): ResearchPackageHonestySupportRollup {
  const out = emptyRollup();
  const spine = raw.summary_spine_node;
  if (spine && typeof spine === "object" && !Array.isArray(spine)) {
    bumpSupportStatus(out, (spine as Record<string, unknown>).support_status);
  }
  for (const key of ["major_arcs", "suggested_sections", "key_events", "coverage_gaps", "ambiguity_notes"] as const) {
    const arr = raw[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        bumpSupportStatus(out, (item as Record<string, unknown>).support_status);
      }
    }
  }
  return out;
}

function isLikelyLegacyM5T07Package(raw: Record<string, unknown>): boolean {
  const v = raw.schema_version;
  if (v === "m5-t07-v1") return true;
  if (typeof v === "string" && v.startsWith("m5-t07")) return true;
  // Heuristic: pre–M5-T08 enrichment had string[] coverage gaps / ambiguity notes.
  const cg = raw.coverage_gaps;
  if (Array.isArray(cg) && cg.length > 0 && typeof cg[0] === "string") return true;
  const an = raw.ambiguity_notes;
  if (Array.isArray(an) && an.length > 0 && typeof an[0] === "string") return true;
  return false;
}

function buildUiHints(params: {
  provenance_traceability: ResearchPackageProvenanceTraceabilityLevel;
  rollup: ResearchPackageHonestySupportRollup;
  synthesis_retrieval_partial: boolean | null;
  has_mixed_or_weak_support: boolean;
}): readonly string[] {
  const lines: string[] = [];
  lines.push("This research output is deterministic scaffolding (bounded retrieval, synthesis, chronology)—not live AI-drafted story prose.");
  if (params.provenance_traceability === "full_m5_t08") {
    lines.push("Per-node provenance traceability (M5-T08) is available in this package response.");
  } else if (params.provenance_traceability === "legacy_package_no_node_provenance_index") {
    lines.push("Detailed per-node provenance index is unavailable for this package version—treat upstream links as unaudited in the UI.");
  } else {
    lines.push("No draft enrichment package is present—there is nothing to trace at the enrichment layer yet.");
  }
  if (params.synthesis_retrieval_partial === true) {
    lines.push("Bounded retrieval reported a partial fetch—expect thinner synthesis inputs.");
  }
  if (params.rollup.total_nodes > 0) {
    lines.push(
      `Support rollup: ${params.rollup.fully_source_backed} fully backed, ${params.rollup.partially_source_backed} partial, ${params.rollup.chronology_thin_sources} thin chronology, ${params.rollup.unresolved_weak} weak/unresolved (${params.rollup.total_nodes} nodes).`,
    );
  }
  if (params.has_mixed_or_weak_support) {
    lines.push("Mixed, thin, or weak support is present somewhere—verify claims with primary sources before publication.");
  } else if (params.rollup.total_nodes > 0) {
    lines.push("All surfaced enrichment nodes are fully source-backed by deterministic rules—still not a publishable article.");
  }
  lines.push("Treat the draft enrichment block as creator guidance only; it is not a publish-ready narrative.");
  return lines;
}

export type BuildResearchPackageHonestySummaryInput = {
  draftEnrichmentPackage: unknown;
  researchSynthesisPackage?: unknown;
  /** When provided, distinct hosts are computed from URLs; improves M5-T23 live tiering. */
  candidateSources?: ReadonlyArray<{ source_url?: string | null }>;
  /** When URLs are unavailable but persisted row count is known (e.g. framing rail). */
  candidateSourceCountOverride?: number;
  /** M5-T24 — optional chronology + enrichment facts for synthesis orchestration (GET package path). */
  synthesisOrchestrationSupplement?: {
    chronology_event_count?: number | null;
    draft_enrichment_package_present?: boolean | null;
  };
};

/**
 * Builds a compact honesty summary for `GET …/research/jobs/:jobId/package`.
 * Always returns a object (never null) so clients can render without branching on missing envelope keys.
 */
export function buildResearchPackageHonestySummary(input: BuildResearchPackageHonestySummaryInput): ResearchPackageHonestySummary {
  const syn = parseResearchSynthesisPackageV1(input.researchSynthesisPackage ?? null);
  const synthesis_retrieval_partial: boolean | null = syn ? syn.retrieval_partial : null;
  const depthAssessment = computeRetrievalDepthAssessment({
    researchSynthesisPackage: input.researchSynthesisPackage ?? null,
    candidateSources: input.candidateSources,
    candidateSourceCountOverride: input.candidateSourceCountOverride,
  });
  const retrieval_depth: ResearchPackageRetrievalDepth = {
    tier: depthAssessment.tier,
    evidence: depthAssessment.evidence,
    headline: depthAssessment.headline,
    next_action: depthAssessment.next_action,
  };

  const synthAsm = computeSynthesisOrchestrationAssessment({
    researchSynthesisPackage: input.researchSynthesisPackage ?? null,
    chronology_event_count: input.synthesisOrchestrationSupplement?.chronology_event_count,
    draft_enrichment_package_present: input.synthesisOrchestrationSupplement?.draft_enrichment_package_present,
  });
  const synthesis_orchestration: ResearchPackageSynthesisOrchestration = {
    tier: synthAsm.tier,
    evidence: synthAsm.evidence,
    consumer_alignment: synthAsm.consumer_alignment,
    pipeline_materialization_coherent: synthAsm.pipeline_materialization_coherent,
    headline: synthAsm.headline,
    next_action: synthAsm.next_action,
  };

  const raw = input.draftEnrichmentPackage;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    const rollup = emptyRollup();
    const provenance_traceability: ResearchPackageProvenanceTraceabilityLevel = "unavailable_no_enrichment";
    const has_mixed_or_weak_support = synthesis_retrieval_partial === true;
    const ui_hints = [
      ...buildUiHints({
        provenance_traceability,
        rollup,
        synthesis_retrieval_partial,
        has_mixed_or_weak_support,
      }),
      depthAssessment.ui_hint_line,
      synthAsm.ui_hint_line,
    ];
    return {
      schema_version: RESEARCH_PACKAGE_HONESTY_SUMMARY_VERSION,
      narrative_generation_mode: "deterministic_scaffolding",
      provenance_traceability,
      has_mixed_or_weak_support,
      publishable_narrative_posture: "creator_guidance_only",
      synthesis_retrieval_partial,
      support_status_rollup: rollup,
      retrieval_depth,
      synthesis_orchestration,
      ui_hints,
    };
  }

  const obj = raw as Record<string, unknown>;
  const provIdx = buildDraftEnrichmentProvenanceIndex(raw);

  let provenance_traceability: ResearchPackageProvenanceTraceabilityLevel;
  let rollup: ResearchPackageHonestySupportRollup;

  let unknownEnrichmentShape = false;

  if (provIdx) {
    provenance_traceability = "full_m5_t08";
    rollup = rollupFromProvenanceNodes(provIdx.nodes);
  } else if (isLikelyLegacyM5T07Package(obj)) {
    provenance_traceability = "legacy_package_no_node_provenance_index";
    rollup = emptyRollup();
  } else if (obj.schema_version === "m5-t08-v1") {
    provenance_traceability = "legacy_package_no_node_provenance_index";
    rollup = rollupFromRawEnrichmentObject(obj);
  } else {
    provenance_traceability = "unavailable_no_enrichment";
    rollup = emptyRollup();
    unknownEnrichmentShape = true;
  }

  const thinPartialWeak =
    rollup.partially_source_backed + rollup.chronology_thin_sources + rollup.unresolved_weak > 0;
  const notAllFullyBacked =
    rollup.total_nodes > 0 && rollup.fully_source_backed < rollup.total_nodes;

  let has_mixed_or_weak_support: boolean;
  if (unknownEnrichmentShape) {
    has_mixed_or_weak_support = true;
  } else if (provenance_traceability === "full_m5_t08") {
    has_mixed_or_weak_support =
      thinPartialWeak || notAllFullyBacked || synthesis_retrieval_partial === true;
  } else {
    has_mixed_or_weak_support = true;
  }

  const ui_hints = [
    ...buildUiHints({
      provenance_traceability,
      rollup,
      synthesis_retrieval_partial,
      has_mixed_or_weak_support,
    }),
    depthAssessment.ui_hint_line,
    synthAsm.ui_hint_line,
  ];

  return {
    schema_version: RESEARCH_PACKAGE_HONESTY_SUMMARY_VERSION,
    narrative_generation_mode: "deterministic_scaffolding",
    provenance_traceability,
    has_mixed_or_weak_support,
    publishable_narrative_posture: "creator_guidance_only",
    synthesis_retrieval_partial,
    support_status_rollup: rollup,
    retrieval_depth,
    synthesis_orchestration,
    ui_hints,
  };
}
