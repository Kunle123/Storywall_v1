/**
 * M5-T14 — client-derived validation-assist (advisory only; not publishability certification).
 * Combines honesty, optional framing/enrichment/editorial audit envelopes, and workflow state.
 */

import type { CreatorWorkflowState } from "@storywall/shared";
import type { ResearchPackageHonestySummary } from "../api/types";

export type ValidationAssistOverallPosture =
  | "strong_enough_to_continue"
  | "usable_with_caveats"
  | "weakly_supported_needs_research"
  | "incomplete_assessment";

export type ValidationAssistStatus = "ready" | "partial_inputs";

export type ValidationAssistAssessmentMode = "derived_from_package_v1";

export type ValidationAssistGroundingRef = {
  source: "honesty_summary" | "provenance_index" | "editorial_review" | "live_enrichment" | "framing_audit" | "workflow" | "research_job_scope";
  detail?: string;
};

export type ValidationAssistSummaryV1 = {
  status: ValidationAssistStatus;
  assessment_mode: ValidationAssistAssessmentMode;
  overall_confidence_posture: ValidationAssistOverallPosture;
  strengths: readonly string[];
  risks: readonly string[];
  recommended_next_actions: readonly string[];
  blocking_conditions: readonly string[];
  grounding_refs: readonly ValidationAssistGroundingRef[];
  /** Honest disclosure when optional layers are missing, stale job scope, or fallback-only. */
  input_gaps: readonly string[];
  advisory_not_authoritative_note: string;
};

const NOTE =
  "This block is Storywall validation-assist: it merges existing honesty, provenance, and optional AI audit envelopes. It is not a substitute for primary-source review, rule-based validation, or editorial sign-off.";

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function framingJobId(afg: unknown): string | null {
  const o = asRecord(afg);
  const id = o?.research_job_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function enrichmentJobScoped(enrichment: unknown, jobId: string): { present: boolean; mode: string | null; isFallback: boolean } {
  const o = asRecord(enrichment);
  if (!o || o.schema_version !== "m5-t11-v1") return { present: false, mode: null, isFallback: false };
  const rj = o.research_job_id;
  if (typeof rj !== "string" || rj !== jobId) return { present: false, mode: null, isFallback: false };
  const mode = typeof o.generation_mode === "string" ? o.generation_mode : null;
  const isFallback =
    mode === "deterministic_scaffolding_fallback" ||
    o.status === "fallback_deterministic" ||
    (asRecord(o.failure) !== null && o.failure !== undefined);
  return { present: true, mode, isFallback };
}

function editorialJobScoped(editorial: unknown, jobId: string): { present: boolean; highFindingCount: number; fallback: boolean } {
  const o = asRecord(editorial);
  if (!o || o.schema_version !== "m5-t12-v1") return { present: false, highFindingCount: 0, fallback: false };
  const rj = o.research_job_id;
  if (typeof rj !== "string" || rj !== jobId) return { present: false, highFindingCount: 0, fallback: false };
  const findings = Array.isArray(o.review_findings) ? o.review_findings : [];
  let high = 0;
  for (const f of findings) {
    const fr = asRecord(f);
    if (fr?.severity === "high") high += 1;
  }
  const fallback = o.status === "fallback_deterministic" || o.review_mode === "deterministic_honesty_fallback";
  return { present: true, highFindingCount: high, fallback };
}

function provenanceLabel(trace: string): { ok: boolean; label: string } {
  switch (trace) {
    case "full_m5_t08":
      return { ok: true, label: "full per-node provenance (M5-T08)" };
    case "legacy_package_no_node_provenance_index":
      return { ok: false, label: "legacy / limited provenance index" };
    case "unavailable_no_enrichment":
      return { ok: false, label: "no enrichment layer to trace" };
    default:
      return { ok: false, label: trace };
  }
}

export function buildValidationAssistFromArtifacts(params: {
  researchJobId: string;
  workflow: CreatorWorkflowState;
  honesty: ResearchPackageHonestySummary | null;
  /** GET package `draft_enrichment_provenance` when present. */
  draftEnrichmentProvenance: unknown;
  liveEventDraftEnrichment: unknown | null | undefined;
  aiEditorialReview: unknown | null | undefined;
  aiFramingGeneration: unknown | null | undefined;
}): ValidationAssistSummaryV1 {
  const grounding_refs: ValidationAssistGroundingRef[] = [
    { source: "research_job_scope", detail: params.researchJobId },
    { source: "workflow", detail: params.workflow },
  ];

  const strengths: string[] = [];
  const risks: string[] = [];
  const blocking_conditions: string[] = [];
  const input_gaps: string[] = [];
  const recommended_next_actions: string[] = [];

  const framingId = framingJobId(params.aiFramingGeneration);
  if (!params.aiFramingGeneration) {
    input_gaps.push("No framing audit envelope returned with frames list — cannot assess live vs deterministic framing for this story.");
  } else if (framingId && framingId !== params.researchJobId) {
    input_gaps.push(
      `Framing audit references research job ${framingId}, not the completed job ${params.researchJobId} — treat framing guidance as potentially stale for this package.`,
    );
    grounding_refs.push({ source: "framing_audit", detail: "job_id_mismatch" });
  } else if (params.aiFramingGeneration) {
    grounding_refs.push({ source: "framing_audit", detail: framingId ?? "present" });
  }

  const enr = enrichmentJobScoped(params.liveEventDraftEnrichment, params.researchJobId);
  const ed = editorialJobScoped(params.aiEditorialReview, params.researchJobId);

  if (!enr.present) {
    input_gaps.push("No M5-T11 live event/draft enrichment stored for this research job (optional step not run or not persisted).");
  } else {
    grounding_refs.push({ source: "live_enrichment", detail: enr.mode ?? "unknown" });
    if (enr.isFallback) {
      input_gaps.push("Enrichment for this job used deterministic mapping or empty fallback — not a full live model pass.");
    }
  }
  if (!ed.present) {
    input_gaps.push("No M5-T12 editorial review stored for this research job (optional advisory pass not run).");
  } else {
    grounding_refs.push({ source: "editorial_review", detail: ed.fallback ? "fallback" : "present" });
    if (ed.fallback) {
      input_gaps.push("Editorial review used honesty-derived fallback or empty envelope — not a full live critique.");
    }
    if (ed.highFindingCount > 0) {
      risks.push(`${ed.highFindingCount} high-severity editorial finding(s) — tighten claims or add sourcing before narrative polish.`);
    }
  }

  const prov = asRecord(params.draftEnrichmentProvenance);
  const provSchema = typeof prov?.schema_version === "string" ? prov.schema_version : null;
  if (provSchema === "m5-t08-trace-v1") {
    grounding_refs.push({ source: "provenance_index", detail: provSchema });
    const nodes = Array.isArray(prov?.nodes) ? prov.nodes.length : 0;
    if (nodes > 0) {
      strengths.push(`Provenance index lists ${nodes} traceable enrichment node(s) for audit.`);
    }
  } else {
    input_gaps.push("Flat provenance index missing or not m5-t08-trace-v1 — per-node trace may be limited.");
    grounding_refs.push({ source: "provenance_index", detail: "limited_or_absent" });
  }

  let posture: ValidationAssistOverallPosture = "usable_with_caveats";
  let status: ValidationAssistStatus = "ready";

  if (!params.honesty) {
    posture = "incomplete_assessment";
    status = "partial_inputs";
    blocking_conditions.push("Honesty summary unavailable — cannot score support posture from this screen.");
  } else {
    grounding_refs.push({ source: "honesty_summary", detail: params.honesty.schema_version });
    const h = params.honesty;
    const r = h.support_status_rollup;
    const provMeta = provenanceLabel(h.provenance_traceability);

    if (provMeta.ok) {
      strengths.push(`Provenance traceability: ${provMeta.label}.`);
    } else {
      risks.push(`Provenance posture: ${provMeta.label}.`);
    }

    if (h.has_mixed_or_weak_support) {
      risks.push("Honesty rollup reports mixed or weak support somewhere in deterministic enrichment nodes.");
    } else {
      strengths.push("Honesty rollup reports no mixed/weak support flag at package level.");
    }

    if (h.synthesis_retrieval_partial === true) {
      risks.push("Synthesis retrieval was partial — candidate coverage may be incomplete.");
      blocking_conditions.push("Partial retrieval — consider another research pass before treating coverage as complete.");
    }

    const thin = r.chronology_thin_sources + r.unresolved_weak;
    if (thin >= 3 && r.total_nodes >= 3) {
      risks.push(`${thin} chronology-thin or unresolved nodes in ${r.total_nodes} traced — reporting gaps likely.`);
    }

    if (h.has_mixed_or_weak_support && (h.synthesis_retrieval_partial === true || thin >= 3)) {
      posture = "weakly_supported_needs_research";
    } else if (!h.has_mixed_or_weak_support && h.synthesis_retrieval_partial !== true && provMeta.ok && thin === 0) {
      posture = "strong_enough_to_continue";
    } else {
      posture = "usable_with_caveats";
    }
  }

  if (input_gaps.length > 0) {
    status = "partial_inputs";
  }

  if (params.workflow === "awaiting_framing_choice") {
    recommended_next_actions.push("Choose or regenerate framing so the story draft shell matches your intent for this research package.");
    if (framingId && framingId !== params.researchJobId) {
      recommended_next_actions.push("Regenerate framing from the brief workspace so the framing audit references this research job.");
    }
  } else   if (params.workflow === "ready_for_edit") {
    recommended_next_actions.push("When satisfied with coverage, run Assemble full draft from the brief workspace to build the starter manuscript.");
    if (ed.present && ed.highFindingCount > 0) {
      recommended_next_actions.push("Resolve or document editorial review findings before tightening publish-facing claims.");
    }
  } else {
    recommended_next_actions.push("Continue from the brief workspace according to your current workflow state.");
  }

  if (enr.present && enr.isFallback) {
    recommended_next_actions.push("Optionally re-run live event/draft enrichment when the AI runtime is armed if you want richer scaffolding notes.");
  }

  if (!ed.present && params.honesty && (params.honesty.has_mixed_or_weak_support || params.honesty.synthesis_retrieval_partial)) {
    recommended_next_actions.push("Run optional editorial review for this job to surface structured risk notes (still advisory).");
  }

  if (posture === "weakly_supported_needs_research") {
    recommended_next_actions.unshift("Prioritize additional research or narrower claims before heavy narrative drafting.");
  }

  function uniqStrings(xs: string[]): string[] {
    return [...new Set(xs)];
  }
  function uniqRefs(xs: ValidationAssistGroundingRef[]): ValidationAssistGroundingRef[] {
    const seen = new Set<string>();
    const out: ValidationAssistGroundingRef[] = [];
    for (const g of xs) {
      const k = `${g.source}:${g.detail ?? ""}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(g);
    }
    return out;
  }

  return {
    status,
    assessment_mode: "derived_from_package_v1",
    overall_confidence_posture: posture,
    strengths: uniqStrings(strengths),
    risks: uniqStrings(risks),
    recommended_next_actions: uniqStrings(recommended_next_actions),
    blocking_conditions: uniqStrings(blocking_conditions),
    grounding_refs: uniqRefs(grounding_refs),
    input_gaps: uniqStrings(input_gaps),
    advisory_not_authoritative_note: NOTE,
  };
}
