/**
 * M5-T14 — narrow behavior checks for client-derived validation-assist.
 * Imports production derivation only (no duplicated logic).
 *
 * Run: pnpm --filter @storywall/web run verify:m5-t14
 */

import type { CreatorWorkflowState } from "@storywall/shared";
import type { ResearchPackageHonestySummary } from "../src/api/types";
import {
  buildValidationAssistFromArtifacts,
  type ValidationAssistSummaryV1,
} from "../src/lib/validationAssist";

const JOB = "research-job-abc";

function honestyBase(overrides: Partial<ResearchPackageHonestySummary> = {}): ResearchPackageHonestySummary {
  return {
    schema_version: "m5-t09-v1",
    narrative_generation_mode: "deterministic_scaffolding",
    provenance_traceability: "full_m5_t08",
    has_mixed_or_weak_support: false,
    publishable_narrative_posture: "creator_guidance_only",
    synthesis_retrieval_partial: false,
    support_status_rollup: {
      fully_source_backed: 5,
      partially_source_backed: 0,
      chronology_thin_sources: 0,
      unresolved_weak: 0,
      total_nodes: 5,
    },
    retrieval_depth: {
      tier: "partial",
      evidence: {
        retrieval_mode: "stub",
        synthesis_retrieval_partial: false,
        candidate_source_count: 4,
        distinct_source_hosts: 1,
        synthesis_finding_count: 8,
        sourced_claim_finding_count: 4,
        synthesis_cluster_count: 1,
      },
      headline: "Retrieval depth: partial — deterministic stub/scaffold material exists, but it is not live-web-grounded.",
      next_action:
        "Treat findings as structural only; enable live retrieval and re-run when you need web-grounded evidence, or add manual sources.",
    },
    synthesis_orchestration: {
      tier: "partial",
      evidence: {
        finding_total: 8,
        sourced_claim_count: 4,
        gap_note_count: 1,
        synthesis_summary_count: 1,
        cluster_count: 1,
        cluster_member_link_count: 4,
      },
      consumer_alignment: {
        framing_live_prompt_includes_structured_brief: true,
        chronology_events_materialized: 6,
        draft_enrichment_package_materialized: true,
      },
      pipeline_materialization_coherent: true,
      headline: "Synthesis orchestration: partial — usable clusters and sourced claims exist.",
      next_action: "Proceed to framing selection and draft assembly while tightening claims where synthesis gaps remain.",
    },
    ui_hints: [],
    ...overrides,
  };
}

function fullOptionalLayers(jobId: string) {
  return {
    aiFramingGeneration: { research_job_id: jobId },
    liveEventDraftEnrichment: {
      schema_version: "m5-t11-v1",
      research_job_id: jobId,
      generation_mode: "live_model",
      status: "success",
    },
    aiEditorialReview: {
      schema_version: "m5-t12-v1",
      research_job_id: jobId,
      review_findings: [],
      status: "complete",
      review_mode: "live",
    },
    draftEnrichmentProvenance: {
      schema_version: "m5-t08-trace-v1",
      nodes: [{ id: "n1" }],
    },
  };
}

type Check = { name: string; pass: boolean; detail?: string };

function assertAdvisoryOnly(summary: ValidationAssistSummaryV1): Check[] {
  const n = summary.advisory_not_authoritative_note.toLowerCase();
  const checks: Check[] = [
    {
      name: "advisory_note_present",
      pass: summary.advisory_not_authoritative_note.length > 80,
    },
    {
      name: "advisory_not_publish_approval_phrase",
      pass: !/\bpublish\s+approval\b/i.test(summary.advisory_not_authoritative_note),
    },
    {
      name: "advisory_semantics_substitute_or_advisory",
      pass: n.includes("substitute") || n.includes("advisory") || n.includes("not a"),
    },
  ];
  return checks;
}

function assertSummaryShape(s: ValidationAssistSummaryV1): Check {
  const keys = [
    "status",
    "assessment_mode",
    "overall_confidence_posture",
    "strengths",
    "risks",
    "recommended_next_actions",
    "blocking_conditions",
    "grounding_refs",
    "input_gaps",
    "advisory_not_authoritative_note",
  ] as const;
  const missing = keys.filter((k) => !(k in s));
  return {
    name: "summary_shape_matches_panel_contract",
    pass: missing.length === 0,
    detail: missing.length ? `missing: ${missing.join(", ")}` : undefined,
  };
}

type Scenario = {
  id: string;
  workflow: CreatorWorkflowState;
  honesty: ResearchPackageHonestySummary | null;
  draftEnrichmentProvenance: unknown;
  liveEventDraftEnrichment: unknown | null | undefined;
  aiEditorialReview: unknown | null | undefined;
  aiFramingGeneration: unknown | null | undefined;
  /** Assertions for this scenario; all must pass. */
  assert: (s: ValidationAssistSummaryV1) => Check[];
};

const scenarios: Scenario[] = [
  {
    id: "strong_ready_full_signals",
    workflow: "ready_for_edit",
    honesty: honestyBase(),
    ...fullOptionalLayers(JOB),
    assert: (s) => [
      assertSummaryShape(s),
      { name: "posture_strong", pass: s.overall_confidence_posture === "strong_enough_to_continue" },
      { name: "status_ready_no_input_gaps", pass: s.status === "ready" && s.input_gaps.length === 0 },
      {
        name: "next_action_assemble_not_generic_only",
        pass: s.recommended_next_actions.some((a) => a.includes("Assemble full draft")),
      },
      ...assertAdvisoryOnly(s),
    ],
  },
  {
    id: "usable_with_caveats_missing_editorial",
    workflow: "assembling_draft",
    honesty: honestyBase({
      has_mixed_or_weak_support: true,
      support_status_rollup: {
        fully_source_backed: 4,
        partially_source_backed: 1,
        chronology_thin_sources: 0,
        unresolved_weak: 0,
        total_nodes: 5,
      },
    }),
    aiFramingGeneration: { research_job_id: JOB },
    liveEventDraftEnrichment: {
      schema_version: "m5-t11-v1",
      research_job_id: JOB,
      generation_mode: "live_model",
      status: "success",
    },
    aiEditorialReview: undefined,
    draftEnrichmentProvenance: { schema_version: "m5-t08-trace-v1", nodes: [{ id: "n1" }] },
    assert: (s) => [
      assertSummaryShape(s),
      { name: "posture_usable", pass: s.overall_confidence_posture === "usable_with_caveats" },
      {
        name: "honest_gap_editorial",
        pass: s.input_gaps.some((g) => g.includes("M5-T12") || g.includes("editorial")),
      },
      { name: "status_partial_when_gaps", pass: s.status === "partial_inputs" },
      {
        name: "optional_editorial_action_when_honesty_flags",
        pass: s.recommended_next_actions.some((a) => a.includes("editorial review")),
      },
      ...assertAdvisoryOnly(s),
    ],
  },
  {
    id: "weak_support_research_first",
    workflow: "researching",
    honesty: honestyBase({
      has_mixed_or_weak_support: true,
      synthesis_retrieval_partial: true,
      support_status_rollup: {
        fully_source_backed: 2,
        partially_source_backed: 0,
        chronology_thin_sources: 2,
        unresolved_weak: 2,
        total_nodes: 6,
      },
    }),
    aiFramingGeneration: { research_job_id: JOB },
    liveEventDraftEnrichment: {
      schema_version: "m5-t11-v1",
      research_job_id: JOB,
      generation_mode: "live_model",
      status: "success",
    },
    aiEditorialReview: {
      schema_version: "m5-t12-v1",
      research_job_id: JOB,
      review_findings: [],
      status: "complete",
      review_mode: "live",
    },
    draftEnrichmentProvenance: { schema_version: "m5-t08-trace-v1", nodes: [{ id: "n1" }] },
    assert: (s) => [
      assertSummaryShape(s),
      { name: "posture_weak", pass: s.overall_confidence_posture === "weakly_supported_needs_research" },
      {
        name: "research_priority_action",
        pass: s.recommended_next_actions.some((a) =>
          a.toLowerCase().includes("additional research"),
        ),
      },
      { name: "blocking_partial_retrieval", pass: s.blocking_conditions.some((b) => b.includes("Partial retrieval")) },
      ...assertAdvisoryOnly(s),
    ],
  },
  {
    id: "stale_framing_job_mismatch",
    workflow: "awaiting_framing_choice",
    honesty: honestyBase(),
    aiFramingGeneration: { research_job_id: "older-research-job-xyz" },
    liveEventDraftEnrichment: {
      schema_version: "m5-t11-v1",
      research_job_id: JOB,
      generation_mode: "live_model",
      status: "success",
    },
    aiEditorialReview: {
      schema_version: "m5-t12-v1",
      research_job_id: JOB,
      review_findings: [],
      status: "complete",
      review_mode: "live",
    },
    draftEnrichmentProvenance: { schema_version: "m5-t08-trace-v1", nodes: [{ id: "n1" }] },
    assert: (s) => [
      assertSummaryShape(s),
      {
        name: "gap_stale_framing",
        pass: s.input_gaps.some((g) => g.includes("stale") || g.includes("not the completed job")),
      },
      {
        name: "grounding_framing_mismatch",
        pass: s.grounding_refs.some((r) => r.source === "framing_audit" && r.detail === "job_id_mismatch"),
      },
      {
        name: "framing_regenerate_action",
        pass: s.recommended_next_actions.some((a) => a.includes("Regenerate framing")),
      },
      ...assertAdvisoryOnly(s),
    ],
  },
  {
    id: "fallback_only_enrichment_editorial",
    workflow: "ready_for_edit",
    honesty: honestyBase(),
    aiFramingGeneration: { research_job_id: JOB },
    liveEventDraftEnrichment: {
      schema_version: "m5-t11-v1",
      research_job_id: JOB,
      generation_mode: "deterministic_scaffolding_fallback",
      status: "success",
    },
    aiEditorialReview: {
      schema_version: "m5-t12-v1",
      research_job_id: JOB,
      review_findings: [],
      status: "fallback_deterministic",
      review_mode: "live",
    },
    draftEnrichmentProvenance: { schema_version: "m5-t08-trace-v1", nodes: [{ id: "n1" }] },
    assert: (s) => [
      assertSummaryShape(s),
      {
        name: "gaps_call_out_fallback_layers",
        pass:
          s.input_gaps.some((g) => g.includes("fallback") || g.includes("deterministic mapping")) &&
          s.input_gaps.length >= 2,
      },
      {
        name: "optional_rerun_enrichment_action",
        pass: s.recommended_next_actions.some((a) => a.includes("re-run live") || a.includes("enrichment")),
      },
      ...assertAdvisoryOnly(s),
    ],
  },
  {
    id: "incomplete_missing_honesty",
    workflow: "drafting_brief",
    honesty: null,
    aiFramingGeneration: undefined,
    liveEventDraftEnrichment: undefined,
    aiEditorialReview: undefined,
    draftEnrichmentProvenance: {},
    assert: (s) => [
      assertSummaryShape(s),
      { name: "posture_incomplete", pass: s.overall_confidence_posture === "incomplete_assessment" },
      { name: "status_partial", pass: s.status === "partial_inputs" },
      {
        name: "honest_many_gaps_not_false_ready",
        pass: s.input_gaps.length >= 3 && s.blocking_conditions.some((b) => b.includes("Honesty")),
      },
      ...assertAdvisoryOnly(s),
    ],
  },
  {
    id: "missing_framing_envelope",
    workflow: "awaiting_framing_choice",
    honesty: honestyBase(),
    aiFramingGeneration: undefined,
    liveEventDraftEnrichment: {
      schema_version: "m5-t11-v1",
      research_job_id: JOB,
      generation_mode: "live_model",
      status: "success",
    },
    aiEditorialReview: {
      schema_version: "m5-t12-v1",
      research_job_id: JOB,
      review_findings: [],
      status: "complete",
      review_mode: "live",
    },
    draftEnrichmentProvenance: { schema_version: "m5-t08-trace-v1", nodes: [{ id: "n1" }] },
    assert: (s) => [
      assertSummaryShape(s),
      {
        name: "gap_framing_envelope",
        pass: s.input_gaps.some((g) => g.includes("framing") && g.includes("envelope")),
      },
      {
        name: "choose_framing_action",
        pass: s.recommended_next_actions.some((a) => a.includes("Choose or regenerate framing")),
      },
      ...assertAdvisoryOnly(s),
    ],
  },
  {
    id: "limited_provenance_trace",
    workflow: "ready_for_edit",
    honesty: honestyBase({ provenance_traceability: "legacy_package_no_node_provenance_index" }),
    ...fullOptionalLayers(JOB),
    assert: (s) => [
      assertSummaryShape(s),
      {
        name: "provenance_risk_or_gap",
        pass: s.risks.some((r) => r.includes("Provenance")) || s.input_gaps.some((g) => g.includes("provenance")),
      },
      { name: "posture_not_strong_when_prov_weak", pass: s.overall_confidence_posture !== "strong_enough_to_continue" },
      ...assertAdvisoryOnly(s),
    ],
  },
];

function main() {
  let failed = 0;
  const rows: Record<string, unknown>[] = [];

  for (const sc of scenarios) {
    const summary = buildValidationAssistFromArtifacts({
      researchJobId: JOB,
      workflow: sc.workflow,
      honesty: sc.honesty,
      draftEnrichmentProvenance: sc.draftEnrichmentProvenance,
      liveEventDraftEnrichment: sc.liveEventDraftEnrichment,
      aiEditorialReview: sc.aiEditorialReview,
      aiFramingGeneration: sc.aiFramingGeneration,
    });

    const flatChecks = sc.assert(summary);

    for (const c of flatChecks) {
      if (!c.pass) failed += 1;
    }

    rows.push({
      scenario: sc.id,
      workflow: sc.workflow,
      posture: summary.overall_confidence_posture,
      status: summary.status,
      input_gaps_count: summary.input_gaps.length,
      input_gaps_preview: summary.input_gaps.slice(0, 2),
      recommended_next_actions: summary.recommended_next_actions,
      risks_preview: summary.risks.slice(0, 2),
      checks: flatChecks.map((c) => ({ name: c.name, pass: c.pass, detail: c.detail })),
    });

    console.log("\n---", sc.id, "---");
    console.log("posture:", summary.overall_confidence_posture, "| status:", summary.status);
    console.log("actions:", summary.recommended_next_actions);
    console.log("gaps:", summary.input_gaps);
    console.log(
      "checks:",
      flatChecks.map((c) => `${c.pass ? "PASS" : "FAIL"}:${c.name}${c.detail ? ` (${c.detail})` : ""}`).join(" | "),
    );
  }

  console.log("\n=== JSON summary ===\n" + JSON.stringify(rows, null, 2));

  if (failed > 0) {
    console.error(`\nverify-m5-t14: ${failed} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nverify-m5-t14: all scenarios passed");
}

main();
