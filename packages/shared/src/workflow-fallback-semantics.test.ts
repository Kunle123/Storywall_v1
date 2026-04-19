import { describe, expect, it } from "vitest";
import { ENRICHMENT_MATERIALIZATION_QUALITY_VERSION } from "./enrichment-materialization-quality";
import { PROVENANCE_TRUTHFULNESS_VERSION } from "./provenance-truthfulness";
import { WORKFLOW_FALLBACK_SEMANTICS_VERSION, assessWorkflowFallbackSemantics } from "./workflow-fallback-semantics";

const baseHonesty = {
  retrieval_depth: { tier: "solid" as const, next_action: "r0" },
  synthesis_orchestration: {
    tier: "solid" as const,
    pipeline_materialization_coherent: true as boolean | null,
    next_action: "s0",
  },
  has_mixed_or_weak_support: false,
  provenance_traceability: "full_m5_t08" as const,
  synthesis_retrieval_partial: false as boolean | null,
};

function emStub(overall: "production_usable" | "usable_with_caveats" | "scaffold_thin") {
  return {
    schema_version: ENRICHMENT_MATERIALIZATION_QUALITY_VERSION,
    combined_overall: overall,
    ui_hint_line: "ui",
    chronology_layer: {
      event_total: 4,
      non_preamble_count: 3,
      substantive_event_count: 3,
      substantive_event_ratio: 1,
      average_summary_chars_substantive: 120,
      sourced_claim_row_count: 2,
      overall: "production_usable" as const,
      headline: "ch",
      next_action: "cn",
    },
    draft_enrichment_layer: {
      has_m5_t08_package: true,
      summary_spine_chars: 400,
      rich_key_event_count: 3,
      rich_suggested_section_count: 3,
      major_arc_count: 1,
      overall: "production_usable" as const,
      headline: "dr",
      next_action: "dn",
    },
    manuscript_shell: null,
  };
}

function ptStub(posture: "evidence_first" | "mixed_evidence_and_model" | "scaffold_and_model_led" | "thin_or_unclassified") {
  return {
    schema_version: PROVENANCE_TRUTHFULNESS_VERSION,
    combined_origin_posture: posture,
    headline: "h",
    next_action: "pn",
    ui_hint_line: "u",
    research_origin: {
      candidate_source_rows: 3,
      synthesis_parseable: true,
      synthesis_retrieval_mode: "stub" as const,
      synthesis_finding_counts: { sourced_claim: 2, synthesis_summary: 1, gap_note: 0, total: 3 },
      chronology_rows_with_candidate_sourced_claim_trace: 2,
      chronology_rows_other_profile: 1,
    },
    draft_enrichment_origin: {
      trace_index_present: true,
      support_status_counts: {
        fully_source_backed: 4,
        partially_source_backed: 0,
        chronology_thin_sources: 0,
        unresolved_weak: 0,
        total_nodes: 4,
      },
      fully_source_backed_share: 1,
      headline: "de",
      next_action: "den",
    },
    manuscript_origin: null,
  };
}

describe("assessWorkflowFallbackSemantics", () => {
  it("labels thin retrieval as non-healthy posture", () => {
    const out = assessWorkflowFallbackSemantics({
      honestySummary: {
        ...baseHonesty,
        retrieval_depth: { tier: "thin", next_action: "Broaden sources" },
        has_mixed_or_weak_support: true,
      },
      enrichmentMaterialization: emStub("usable_with_caveats"),
      provenanceTruthfulness: ptStub("mixed_evidence_and_model"),
    });
    expect(out.schema_version).toBe(WORKFLOW_FALLBACK_SEMANTICS_VERSION);
    expect(out.composite_workflow_posture).not.toBe("healthy_grounded_package");
    expect(out.signal_codes).toContain("retrieval_depth_partial_or_thin");
    expect(out.creator_next_actions.length).toBeGreaterThanOrEqual(2);
  });

  it("allows healthy posture only when stacked rails are nominal", () => {
    const out = assessWorkflowFallbackSemantics({
      honestySummary: baseHonesty,
      enrichmentMaterialization: emStub("production_usable"),
      provenanceTruthfulness: ptStub("evidence_first"),
    });
    expect(out.grounding_band).toBe("strong_guidance");
    expect(out.composite_workflow_posture).toBe("healthy_grounded_package");
    expect(out.signal_codes.length).toBe(0);
  });

  it("marks scaffold materialization as thin-or-risky guidance", () => {
    const out = assessWorkflowFallbackSemantics({
      honestySummary: {
        ...baseHonesty,
        retrieval_depth: { tier: "partial", next_action: "r" },
        synthesis_orchestration: {
          tier: "partial",
          pipeline_materialization_coherent: true,
          next_action: "s",
        },
      },
      enrichmentMaterialization: emStub("scaffold_thin"),
      provenanceTruthfulness: ptStub("scaffold_and_model_led"),
    });
    expect(out.composite_workflow_posture).toBe("thin_or_risky_guidance_only");
    expect(out.signal_codes).toContain("enrichment_materialization_scaffold_thin");
  });
});
