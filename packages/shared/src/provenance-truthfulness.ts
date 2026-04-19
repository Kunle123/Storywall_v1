/**
 * M5-T27 — deterministic provenance & generation truthfulness (content-origin), separate from
 * M5-T23 retrieval depth, M5-T24 synthesis orchestration, M5-T25 framing quality, M5-T26 materialization tiers.
 * No speculative scores — counts and booleans from persisted synthesis, chronology labels, M5-T08 enrichment nodes,
 * and manuscript generation_mode / section_origin only.
 */

import { parseResearchSynthesisPackageV1 } from "./research-synthesis/parse";

export const PROVENANCE_TRUTHFULNESS_VERSION = "m5-t27-v1" as const;

export type ProvenanceTruthfulnessOriginPosture =
  | "evidence_first"
  | "mixed_evidence_and_model"
  | "scaffold_and_model_led"
  | "thin_or_unclassified";

export type ProvenanceTruthfulnessChronologyRow = {
  context_label?: string | null;
};

export type ProvenanceTruthfulnessManuscriptEvent = {
  generation_mode: string;
};

export type ProvenanceTruthfulnessManuscriptSection = {
  section_origin: string;
};

export type ProvenanceTruthfulnessNode = {
  support_status: string;
};

export type ProvenanceTruthfulnessAssessmentV1 = {
  schema_version: typeof PROVENANCE_TRUTHFULNESS_VERSION;
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
  combined_origin_posture: ProvenanceTruthfulnessOriginPosture;
  headline: string;
  next_action: string;
  ui_hint_line: string;
};

export type AssessProvenanceTruthfulnessInput = {
  researchSynthesisPackage: unknown;
  /** Flat nodes from `buildDraftEnrichmentProvenanceIndex` (null when no M5-T08 index). */
  draftEnrichmentProvenanceNodes: readonly ProvenanceTruthfulnessNode[] | null;
  chronologyEvents: readonly ProvenanceTruthfulnessChronologyRow[];
  manuscript: {
    events: readonly ProvenanceTruthfulnessManuscriptEvent[];
    sections: readonly ProvenanceTruthfulnessManuscriptSection[];
  } | null;
  candidateSourceCount: number;
};

function rollupSupport(nodes: readonly ProvenanceTruthfulnessNode[]) {
  const acc = {
    fully_source_backed: 0,
    partially_source_backed: 0,
    chronology_thin_sources: 0,
    unresolved_weak: 0,
    total_nodes: nodes.length,
  };
  for (const n of nodes) {
    const s = n.support_status;
    if (s === "fully_source_backed") acc.fully_source_backed += 1;
    else if (s === "partially_source_backed") acc.partially_source_backed += 1;
    else if (s === "chronology_thin_sources") acc.chronology_thin_sources += 1;
    else acc.unresolved_weak += 1;
  }
  return acc;
}

function countBy<T>(items: readonly T[], pick: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    const v = pick(it) || "unknown";
    out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

function postureFromSignals(params: {
  synthesisParseable: boolean;
  candidateRows: number;
  sourcedClaimFindings: number;
  chronologySourcedRows: number;
  retrievalMode: "stub" | "live" | null;
  tracePresent: boolean;
  fullyShare: number | null;
}): ProvenanceTruthfulnessOriginPosture {
  if (!params.synthesisParseable && params.candidateRows === 0) return "thin_or_unclassified";
  if (params.sourcedClaimFindings === 0 && params.chronologySourcedRows === 0 && params.candidateRows < 2) {
    return "thin_or_unclassified";
  }
  const scaffoldLed =
    params.retrievalMode === "stub" &&
    (params.sourcedClaimFindings < 2 || params.chronologySourcedRows < 2);
  if (scaffoldLed) return "scaffold_and_model_led";

  const evidenceStrong =
    params.chronologySourcedRows >= 2 &&
    params.sourcedClaimFindings >= 2 &&
    params.tracePresent &&
    params.fullyShare !== null &&
    params.fullyShare >= 0.25;
  if (evidenceStrong) return "evidence_first";

  return "mixed_evidence_and_model";
}

export function assessProvenanceTruthfulness(input: AssessProvenanceTruthfulnessInput): ProvenanceTruthfulnessAssessmentV1 {
  const syn = parseResearchSynthesisPackageV1(input.researchSynthesisPackage ?? null);
  const synthesis_parseable = Boolean(syn);
  const retrieval = syn?.retrieval_mode ?? null;
  const fc = { sourced_claim: 0, synthesis_summary: 0, gap_note: 0, total: 0 };
  if (syn) {
    for (const f of syn.findings) {
      fc.total += 1;
      if (f.kind === "sourced_claim") fc.sourced_claim += 1;
      else if (f.kind === "synthesis_summary") fc.synthesis_summary += 1;
      else if (f.kind === "gap_note") fc.gap_note += 1;
    }
  }

  let chron_sourced = 0;
  let chron_other = 0;
  for (const r of input.chronologyEvents) {
    const ctx = (r.context_label ?? "").toLowerCase();
    if (ctx.includes("m5_t06.candidate.sourced_claim")) chron_sourced += 1;
    else chron_other += 1;
  }

  const nodes = input.draftEnrichmentProvenanceNodes;
  const tracePresent = Boolean(nodes && nodes.length > 0);
  const support = nodes && nodes.length ? rollupSupport(nodes) : null;
  const fullyShare =
    support && support.total_nodes > 0 ? Math.round((support.fully_source_backed / support.total_nodes) * 1000) / 1000 : null;

  const draftHead =
    !tracePresent
      ? "Draft enrichment layer: per-node M5-T08 trace index unavailable — treat enrichment text as unaudited for origin."
      : support && support.unresolved_weak + support.chronology_thin_sources > support.fully_source_backed
        ? "Draft enrichment layer: mixed support — many nodes are partial, thin-chronology, or weak relative to full backing."
        : "Draft enrichment layer: traceable — M5-T08 nodes link synthesis findings, chronology ids, and candidate source ids where established.";

  const draftNext =
    !tracePresent
      ? "Re-run research after worker upgrade, or inspect raw draft_enrichment_package in artifact for legacy shapes."
      : fullyShare !== null && fullyShare < 0.35
        ? "Treat suggested sections and arcs as editorial scaffolding; add primary sources before asserting facts."
        : "Use provenance lists on each node to verify which claims tie to which candidate rows.";

  let manuscript_origin: ProvenanceTruthfulnessAssessmentV1["manuscript_origin"] = null;
  if (input.manuscript && (input.manuscript.events.length > 0 || input.manuscript.sections.length > 0)) {
    const eg = countBy(input.manuscript.events, (e) => e.generation_mode);
    const so = countBy(input.manuscript.sections, (s) => s.section_origin);
    const manualAfter = input.manuscript.events.filter((e) => e.generation_mode === "manual_after_ai").length;
    const manual = input.manuscript.events.filter((e) => e.generation_mode === "manual").length;
    const creatorSec = input.manuscript.sections.filter((s) => s.section_origin === "creator_edited").length;
    manuscript_origin = {
      event_generation_modes: eg,
      section_origins: so,
      creator_touch_signals: {
        manual_after_ai_events: manualAfter,
        manual_events: manual,
        creator_edited_sections: creatorSec,
      },
      headline:
        manualAfter > 0 || creatorSec > 0
          ? "Manuscript layer: creator overrides present — some rows are manual_after_ai or creator-edited sections."
          : "Manuscript layer: assembled rows reflect generation_mode / section_origin as stored (AI-assembled vs manual).",
      next_action:
        manualAfter > 0
          ? "Re-fetch package after substantive edits to refresh truthfulness; corroborate edited beats against sources."
          : "Inspect generation_mode on events and section_origin on sections before publish.",
    };
  }

  const combined = postureFromSignals({
    synthesisParseable: synthesis_parseable,
    candidateRows: input.candidateSourceCount,
    sourcedClaimFindings: fc.sourced_claim,
    chronologySourcedRows: chron_sourced,
    retrievalMode: retrieval,
    tracePresent,
    fullyShare,
  });

  const head =
    combined === "evidence_first"
      ? "Origin posture: evidence-first — sourced claims and chronology traces dominate; still not a publish guarantee."
      : combined === "mixed_evidence_and_model"
        ? "Origin posture: mixed — evidence-backed atoms coexist with synthesis summaries, enrichment glue, and assembled narrative."
        : combined === "scaffold_and_model_led"
          ? "Origin posture: scaffold- and model-led — stub or thin retrieval; treat narrative as structural until live sources are added."
          : "Origin posture: thin or unclassified — missing or sparse synthesis/candidate linkage; do not infer strong sourcing.";

  const next =
    combined === "evidence_first"
      ? "Continue verifying dates externally; use enrichment provenance lists when tightening claims."
      : combined === "mixed_evidence_and_model"
        ? "Label mentally: sourced_claim rows vs synthesis_summary vs assembled prose; edit weak nodes and re-run validation."
        : combined === "scaffold_and_model_led"
          ? "Enable live retrieval or add manual sources, then re-run research before treating copy as grounded."
          : "Re-run research or inspect artifact persistence; broaden brief if chronology stayed empty.";

  const ui = `Provenance truthfulness (M5-T27): posture=${combined} — synthesis_findings sourced_claim=${fc.sourced_claim}, chronology_sourced_rows=${chron_sourced}, enrichment_nodes=${support?.total_nodes ?? 0}, manuscript_traced=${manuscript_origin ? "yes" : "no"}.`;

  return {
    schema_version: PROVENANCE_TRUTHFULNESS_VERSION,
    research_origin: {
      candidate_source_rows: input.candidateSourceCount,
      synthesis_parseable,
      synthesis_retrieval_mode: retrieval,
      synthesis_finding_counts: fc,
      chronology_rows_with_candidate_sourced_claim_trace: chron_sourced,
      chronology_rows_other_profile: chron_other,
    },
    draft_enrichment_origin: {
      trace_index_present: tracePresent,
      support_status_counts: support ?? {
        fully_source_backed: 0,
        partially_source_backed: 0,
        chronology_thin_sources: 0,
        unresolved_weak: 0,
        total_nodes: 0,
      },
      fully_source_backed_share: fullyShare,
      headline: draftHead,
      next_action: draftNext,
    },
    manuscript_origin,
    combined_origin_posture: combined,
    headline: head,
    next_action: next,
    ui_hint_line: ui,
  };
}
