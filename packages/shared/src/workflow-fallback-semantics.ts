/**
 * M5-T28 — deterministic workflow fallback semantics for GET research package (and aligned creator UI).
 * Composes M5-T23–T27 rails into explicit degraded-state signals + next actions — no LLM, no speculative scores.
 */

import type { EnrichmentMaterializationQualityV1, EnrichmentMaterializationTier } from "./enrichment-materialization-quality";
import type { ProvenanceTruthfulnessAssessmentV1, ProvenanceTruthfulnessOriginPosture } from "./provenance-truthfulness";

export const WORKFLOW_FALLBACK_SEMANTICS_VERSION = "m5-t28-v1" as const;

/** Machine-readable reason codes (stable sort order in output). */
export type WorkflowFallbackSignalCode =
  | "enrichment_materialization_scaffold_thin"
  | "enrichment_materialization_usable_with_caveats"
  | "honesty_support_rollup_mixed_or_weak"
  | "pipeline_materialization_incoherent"
  | "provenance_legacy_or_limited_trace"
  | "provenance_truthfulness_mixed_evidence_and_model"
  | "provenance_truthfulness_scaffold_or_thin"
  | "retrieval_depth_partial_or_thin"
  | "synthesis_orchestration_thin_or_partial"
  | "synthesis_retrieval_partial_flag";

/** How much trace-backed evidence backs the current package for creator trust decisions. */
export type WorkflowGroundingBand =
  | "strong_guidance"
  | "mixed_guidance"
  | "thin_guidance"
  | "scaffold_only_guidance";

/**
 * Composite posture for the research-job package surface — not publish readiness
 * (research packages remain creator guidance only).
 */
export type WorkflowCompositePosture =
  | "healthy_grounded_package"
  | "usable_with_explicit_limits"
  | "degraded_partial_package"
  | "thin_or_risky_guidance_only";

export type HonestySliceForWorkflowFallback = {
  retrieval_depth: { tier: "thin" | "partial" | "solid"; next_action: string };
  synthesis_orchestration: {
    tier: "thin" | "partial" | "solid";
    pipeline_materialization_coherent: boolean | null;
    next_action: string;
  };
  has_mixed_or_weak_support: boolean;
  provenance_traceability: "full_m5_t08" | "legacy_package_no_node_provenance_index" | "unavailable_no_enrichment";
  synthesis_retrieval_partial: boolean | null;
};

export type AssessWorkflowFallbackSemanticsInput = {
  honestySummary: HonestySliceForWorkflowFallback;
  enrichmentMaterialization: EnrichmentMaterializationQualityV1 | null;
  provenanceTruthfulness: ProvenanceTruthfulnessAssessmentV1 | null;
};

export type WorkflowFallbackSemanticsV1 = {
  schema_version: typeof WORKFLOW_FALLBACK_SEMANTICS_VERSION;
  signal_codes: readonly WorkflowFallbackSignalCode[];
  grounding_band: WorkflowGroundingBand;
  composite_workflow_posture: WorkflowCompositePosture;
  headline: string;
  creator_next_actions: readonly string[];
  /** Short line safe for compact UI chrome (API + web). */
  ui_hint_line: string;
};

function tierRank(t: "thin" | "partial" | "solid"): number {
  if (t === "thin") return 0;
  if (t === "partial") return 1;
  return 2;
}

function matRank(t: EnrichmentMaterializationTier): number {
  if (t === "scaffold_thin") return 0;
  if (t === "usable_with_caveats") return 1;
  return 2;
}

function postureRank(p: ProvenanceTruthfulnessOriginPosture | null): number {
  /** Null = provenance block absent (pre-deploy client); do not treat as worst-case. */
  if (!p) return 1;
  if (p === "thin_or_unclassified" || p === "scaffold_and_model_led") return 0;
  if (p === "mixed_evidence_and_model") return 1;
  return 2;
}

function uniqueOrderedStrings(lines: readonly string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const s = raw.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Deterministic assessment from persisted package slices only.
 */
export function assessWorkflowFallbackSemantics(input: AssessWorkflowFallbackSemanticsInput): WorkflowFallbackSemanticsV1 {
  const h = input.honestySummary;
  const em = input.enrichmentMaterialization;
  const pt = input.provenanceTruthfulness;

  const signals = new Set<WorkflowFallbackSignalCode>();

  if (h.retrieval_depth.tier === "thin" || h.retrieval_depth.tier === "partial") {
    signals.add("retrieval_depth_partial_or_thin");
  }
  if (h.synthesis_orchestration.tier === "thin" || h.synthesis_orchestration.tier === "partial") {
    signals.add("synthesis_orchestration_thin_or_partial");
  }
  if (h.synthesis_retrieval_partial === true) {
    signals.add("synthesis_retrieval_partial_flag");
  }
  if (h.synthesis_orchestration.pipeline_materialization_coherent === false) {
    signals.add("pipeline_materialization_incoherent");
  }
  if (h.has_mixed_or_weak_support) {
    signals.add("honesty_support_rollup_mixed_or_weak");
  }
  if (h.provenance_traceability !== "full_m5_t08") {
    signals.add("provenance_legacy_or_limited_trace");
  }

  const combinedMat = em?.combined_overall ?? null;
  if (combinedMat === "scaffold_thin") {
    signals.add("enrichment_materialization_scaffold_thin");
  } else if (combinedMat === "usable_with_caveats") {
    signals.add("enrichment_materialization_usable_with_caveats");
  }

  const posture = pt?.combined_origin_posture ?? null;
  if (posture === "mixed_evidence_and_model") {
    signals.add("provenance_truthfulness_mixed_evidence_and_model");
  }
  if (posture === "scaffold_and_model_led" || posture === "thin_or_unclassified") {
    signals.add("provenance_truthfulness_scaffold_or_thin");
  }

  const retrievalR = tierRank(h.retrieval_depth.tier);
  const synthR = tierRank(h.synthesis_orchestration.tier);
  const matR = combinedMat ? matRank(combinedMat) : 1;
  const postR = postureRank(posture);

  const pipelineBroken = h.synthesis_orchestration.pipeline_materialization_coherent === false;
  const provenanceThinOrScaffold = postR <= 0 || signals.has("provenance_truthfulness_scaffold_or_thin");
  const materializationScaffold = combinedMat === "scaffold_thin" || signals.has("enrichment_materialization_scaffold_thin");
  const researchStackVeryWeak = retrievalR <= 0 && synthR <= 0;

  let grounding_band: WorkflowGroundingBand;
  if (provenanceThinOrScaffold || materializationScaffold || researchStackVeryWeak) {
    grounding_band = "scaffold_only_guidance";
  } else if (
    retrievalR <= 1 ||
    synthR <= 1 ||
    matR <= 0 ||
    postR <= 1 ||
    h.has_mixed_or_weak_support ||
    h.synthesis_retrieval_partial === true ||
    pipelineBroken ||
    h.provenance_traceability !== "full_m5_t08"
  ) {
    grounding_band = "thin_guidance";
  } else if (matR <= 1 || signals.has("enrichment_materialization_usable_with_caveats") || signals.has("provenance_truthfulness_mixed_evidence_and_model")) {
    grounding_band = "mixed_guidance";
  } else {
    grounding_band = "strong_guidance";
  }

  let composite_workflow_posture: WorkflowCompositePosture;
  if (grounding_band === "scaffold_only_guidance") {
    composite_workflow_posture = "thin_or_risky_guidance_only";
  } else if (grounding_band === "thin_guidance" || pipelineBroken) {
    composite_workflow_posture = "degraded_partial_package";
  } else if (grounding_band === "mixed_guidance") {
    composite_workflow_posture = "usable_with_explicit_limits";
  } else {
    composite_workflow_posture = "healthy_grounded_package";
  }

  const actionPool: string[] = [
    h.retrieval_depth.next_action,
    h.synthesis_orchestration.next_action,
    em?.chronology_layer.next_action ?? "",
    em?.draft_enrichment_layer.next_action ?? "",
    em?.manuscript_shell?.next_action ?? "",
    pt?.next_action ?? "",
    pt?.draft_enrichment_origin?.next_action ?? "",
    pt?.manuscript_origin?.next_action ?? "",
  ];

  if (grounding_band === "scaffold_only_guidance" || composite_workflow_posture === "thin_or_risky_guidance_only") {
    actionPool.push(
      "Treat visible narrative or outline text as scaffolding: verify every factual claim against primary sources before any public use.",
    );
  }
  if (signals.has("synthesis_retrieval_partial_flag")) {
    actionPool.push("Re-run or widen bounded retrieval when the host supports it, then re-open the package honesty rails.");
  }
  if (signals.has("provenance_legacy_or_limited_trace")) {
    actionPool.push("Prefer packages with M5-T08 per-node provenance when auditing links; legacy shapes are not silently equivalent.");
  }
  actionPool.push(
    "This research package remains creator guidance, not a publish-ready manuscript—continue in the editor or validation flow before publishing.",
  );

  const creator_next_actions = uniqueOrderedStrings(actionPool, 8);

  const headline =
    composite_workflow_posture === "healthy_grounded_package"
      ? "Package rails align: retrieval, synthesis materialization, enrichment depth, and provenance posture look strong for editorial guidance (still not publish-by-default)."
      : composite_workflow_posture === "usable_with_explicit_limits"
        ? "Package is usable for guidance with explicit limits—review retrieval, synthesis structure, and provenance rails before trusting breadth."
        : composite_workflow_posture === "degraded_partial_package"
          ? "Partial or mixed signals: expect thinner grounding or incomplete pipeline wiring—follow the listed next actions instead of assuming completeness."
          : "Thin or scaffold-led signals dominate: use as exploratory scaffolding only; deepen research and manual editing before trusting surfaced claims.";

  const ui_hint_line = `Workflow fallback (M5-T28): posture=${composite_workflow_posture}, grounding_band=${grounding_band}, signals=${[...signals].sort().join(",") || "none"}.`;

  const signal_codes = [...signals].sort() as WorkflowFallbackSignalCode[];

  return {
    schema_version: WORKFLOW_FALLBACK_SEMANTICS_VERSION,
    signal_codes,
    grounding_band,
    composite_workflow_posture,
    headline,
    creator_next_actions,
    ui_hint_line,
  };
}
