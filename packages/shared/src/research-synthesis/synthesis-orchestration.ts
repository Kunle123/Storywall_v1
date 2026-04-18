/**
 * M5-T24 — deterministic synthesis orchestration signals (structure + downstream wiring hints).
 * No speculative AI scoring; counts and booleans from persisted M5-T05 packages + optional pipeline facts.
 */

import { parseResearchSynthesisPackageV1 } from "./parse";
import type { ResearchSynthesisPackageV1 } from "./types";

export type SynthesisOrchestrationTier = "thin" | "partial" | "solid";

export type SynthesisOrchestrationEvidence = {
  finding_total: number;
  sourced_claim_count: number;
  gap_note_count: number;
  synthesis_summary_count: number;
  cluster_count: number;
  /** Sum of cluster member_finding_ids (duplicates allowed; shows linking density). */
  cluster_member_link_count: number;
};

export type SynthesisConsumerAlignment = {
  /** Live framing prompts include JSON excerpt + structured brief (M5-T24). */
  framing_live_prompt_includes_structured_brief: true;
  /** Persisted chronology rows for this job when API supplies count. */
  chronology_events_materialized: number | null;
  /** Persisted draft enrichment package on artifact when API supplies flag. */
  draft_enrichment_package_materialized: boolean | null;
};

export type SynthesisOrchestrationAssessment = {
  tier: SynthesisOrchestrationTier;
  evidence: SynthesisOrchestrationEvidence;
  consumer_alignment: SynthesisConsumerAlignment;
  /** True when chronology + enrichment materialized; false when known incomplete; null when counts unknown. */
  pipeline_materialization_coherent: boolean | null;
  headline: string;
  next_action: string;
  ui_hint_line: string;
};

export type ComputeSynthesisOrchestrationInput = {
  researchSynthesisPackage: unknown;
  chronology_event_count?: number | null;
  draft_enrichment_package_present?: boolean | null;
};

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function tierFromStructure(ev: SynthesisOrchestrationEvidence): SynthesisOrchestrationTier {
  const { sourced_claim_count: sc, cluster_count: cc, finding_total: ft, synthesis_summary_count: ss } = ev;
  if (sc < 2 || cc < 1 || ft < 3) return "thin";
  if (sc >= 4 && cc >= 1 && ss >= 1 && ft >= 6) return "solid";
  return "partial";
}

function headlineFor(
  tier: SynthesisOrchestrationTier,
  coherent: boolean | null,
  ev: SynthesisOrchestrationEvidence,
): string {
  if (tier === "thin") {
    return "Synthesis orchestration: thin — too few sourced claims or clusters to anchor framing/chronology meaningfully.";
  }
  if (coherent === null) {
    if (tier === "partial") {
      return "Synthesis orchestration: partial — M5-T05 clusters and sourced claims are present (chronology/enrichment wiring not evaluated in this honesty snapshot).";
    }
    return "Synthesis orchestration: solid — rich structured package (chronology/enrichment wiring not evaluated in this honesty snapshot).";
  }
  if (!coherent) {
    return "Synthesis package is structured, but chronology or draft enrichment materialization is missing — pipeline orchestration incomplete.";
  }
  if (tier === "partial") {
    return "Synthesis orchestration: partial — usable clusters and sourced claims exist; enrichment and framing can proceed with honest caveats.";
  }
  return "Synthesis orchestration: solid — structured findings, clusters, and summary spine suitable for framing + chronology + enrichment consumers.";
}

function nextActionFor(tier: SynthesisOrchestrationTier, coherent: boolean | null): string {
  if (coherent === false) {
    return "Re-run research or check worker logs — a succeeded job should persist chronology rows and draft enrichment from synthesis.";
  }
  if (coherent === null) {
    return "Use GET …/research/jobs/:jobId/package for full orchestration counts (chronology rows + enrichment) when wiring is evaluated.";
  }
  if (tier === "thin") {
    return "Broaden retrieval or brief, then re-run research so synthesis has enough candidate-backed claims to cluster.";
  }
  if (tier === "partial") {
    return "Proceed to framing selection and draft assembly while tightening claims where synthesis gaps remain.";
  }
  return "Continue to framing and manuscript assembly — treat synthesis as the spine for angles, chronology beats, and enrichment nodes.";
}

/**
 * Creator-facing brief: clusters + findings (deterministic; for framing LLM alongside raw JSON excerpt).
 */
export function formatSynthesisOrchestrationBriefForPrompt(
  pkg: ResearchSynthesisPackageV1,
  maxChars = 2500,
): string {
  const lines: string[] = [];
  lines.push(
    `Structured synthesis (M5-T05 ${pkg.schema_version}, mode=${pkg.retrieval_mode}, partial=${pkg.retrieval_partial})`,
  );
  lines.push(`Open questions (${pkg.open_questions.length}):`);
  for (const q of pkg.open_questions.slice(0, 4)) {
    lines.push(`- ${clip(q, 220)}`);
  }
  lines.push(`Clusters (${pkg.clusters.length}):`);
  for (const c of pkg.clusters) {
    lines.push(
      `- [${c.id}] ${clip(c.label, 90)} — ${clip(c.summary, 240)} · members: ${c.member_finding_ids.slice(0, 12).join(", ")}${c.member_finding_ids.length > 12 ? "…" : ""}`,
    );
  }
  lines.push(`Findings (${pkg.findings.length}):`);
  for (const f of pkg.findings) {
    lines.push(
      `- [${f.id}] ${f.kind} (${f.confidence}) · ${f.supporting_research_candidate_source_ids.length} source id(s): ${clip(f.text, 200)}`,
    );
  }
  return clip(lines.join("\n"), maxChars);
}

export function computeSynthesisOrchestrationAssessment(
  input: ComputeSynthesisOrchestrationInput,
): SynthesisOrchestrationAssessment {
  const syn = parseResearchSynthesisPackageV1(input.researchSynthesisPackage ?? null);
  const chrono = input.chronology_event_count ?? null;
  const enrich = input.draft_enrichment_package_present ?? null;

  if (!syn) {
    const ev: SynthesisOrchestrationEvidence = {
      finding_total: 0,
      sourced_claim_count: 0,
      gap_note_count: 0,
      synthesis_summary_count: 0,
      cluster_count: 0,
      cluster_member_link_count: 0,
    };
    const consumer_alignment: SynthesisConsumerAlignment = {
      framing_live_prompt_includes_structured_brief: true,
      chronology_events_materialized: chrono,
      draft_enrichment_package_materialized: enrich,
    };
    const coherent: boolean | null =
      chrono === null || enrich === null ? null : chrono > 0 && enrich === true;
    return {
      tier: "thin",
      evidence: ev,
      consumer_alignment,
      pipeline_materialization_coherent: coherent,
      headline: headlineFor("thin", coherent, ev),
      next_action: nextActionFor("thin", coherent),
      ui_hint_line:
        "Synthesis orchestration (M5-T24): thin — no parseable research_synthesis_package; framing/chronology should rely on brief only until research materializes.",
    };
  }

  let sc = 0;
  let gn = 0;
  let ss = 0;
  for (const f of syn.findings) {
    if (f.kind === "sourced_claim") sc += 1;
    else if (f.kind === "gap_note") gn += 1;
    else if (f.kind === "synthesis_summary") ss += 1;
  }
  let memberLinks = 0;
  for (const c of syn.clusters) {
    memberLinks += c.member_finding_ids.length;
  }
  const ev: SynthesisOrchestrationEvidence = {
    finding_total: syn.findings.length,
    sourced_claim_count: sc,
    gap_note_count: gn,
    synthesis_summary_count: ss,
    cluster_count: syn.clusters.length,
    cluster_member_link_count: memberLinks,
  };
  const tier = tierFromStructure(ev);
  const consumer_alignment: SynthesisConsumerAlignment = {
    framing_live_prompt_includes_structured_brief: true,
    chronology_events_materialized: chrono,
    draft_enrichment_package_materialized: enrich,
  };
  const coherent: boolean | null =
    chrono === null || enrich === null ? null : chrono > 0 && enrich === true;
  const headline = headlineFor(tier, coherent, ev);
  const next_action = nextActionFor(tier, coherent);
  const ui_hint_line = `Synthesis orchestration (M5-T24): ${tier} — ${ev.sourced_claim_count} sourced_claim(s), ${ev.cluster_count} cluster(s), ${ev.finding_total} findings; chronology_rows=${chrono ?? "unknown"}, enrichment=${enrich === null ? "unknown" : enrich ? "yes" : "no"}.`;

  return {
    tier,
    evidence: ev,
    consumer_alignment,
    pipeline_materialization_coherent: coherent,
    headline,
    next_action,
    ui_hint_line,
  };
}
