import { describe, expect, it } from "vitest";
import { assessProvenanceTruthfulness, PROVENANCE_TRUTHFULNESS_VERSION } from "./provenance-truthfulness";

const SYNTH_STUB = {
  schema_version: "m5-t05-v1",
  retrieval_mode: "stub",
  retrieval_partial: false,
  generated_at: "2026-01-01T00:00:00.000Z",
  coverage_notes: [],
  open_questions: [],
  findings: [
    {
      id: "a",
      kind: "sourced_claim",
      text: "x".repeat(40),
      supporting_research_candidate_source_ids: ["s1"],
      confidence: "medium",
    },
    {
      id: "b",
      kind: "sourced_claim",
      text: "y".repeat(40),
      supporting_research_candidate_source_ids: ["s2"],
      confidence: "medium",
    },
    { id: "c", kind: "synthesis_summary", text: "z".repeat(80), supporting_research_candidate_source_ids: [], confidence: "low" },
  ],
  clusters: [{ id: "cl", label: "L", summary: "S", member_finding_ids: ["a"], supporting_research_candidate_source_ids: ["s1"] }],
};

describe("assessProvenanceTruthfulness (M5-T27)", () => {
  it("returns thin_or_unclassified when synthesis and candidates are absent", () => {
    const q = assessProvenanceTruthfulness({
      researchSynthesisPackage: null,
      draftEnrichmentProvenanceNodes: null,
      chronologyEvents: [],
      manuscript: null,
      candidateSourceCount: 0,
    });
    expect(q.schema_version).toBe(PROVENANCE_TRUTHFULNESS_VERSION);
    expect(q.combined_origin_posture).toBe("thin_or_unclassified");
    expect(q.manuscript_origin).toBeNull();
  });

  it("classifies stub retrieval with thin chronology as scaffold_and_model_led", () => {
    const nodes = [
      { support_status: "partially_source_backed" },
      { support_status: "chronology_thin_sources" },
    ] as const;
    const q = assessProvenanceTruthfulness({
      researchSynthesisPackage: SYNTH_STUB,
      draftEnrichmentProvenanceNodes: [...nodes],
      chronologyEvents: [{ context_label: "m5_t06.candidate.sourced_claim:x" }],
      manuscript: null,
      candidateSourceCount: 4,
    });
    expect(q.research_origin.synthesis_finding_counts.sourced_claim).toBe(2);
    expect(q.combined_origin_posture).toBe("scaffold_and_model_led");
  });

  it("detects creator manual_after_ai on manuscript events", () => {
    const q = assessProvenanceTruthfulness({
      researchSynthesisPackage: SYNTH_STUB,
      draftEnrichmentProvenanceNodes: [
        { support_status: "fully_source_backed" },
        { support_status: "fully_source_backed" },
        { support_status: "fully_source_backed" },
      ],
      chronologyEvents: [
        { context_label: "m5_t06.candidate.sourced_claim:a" },
        { context_label: "m5_t06.candidate.sourced_claim:b" },
        { context_label: "m5_t06.candidate.sourced_claim:c" },
      ],
      manuscript: {
        events: [
          { generation_mode: "ai_draft" },
          { generation_mode: "manual_after_ai" },
        ],
        sections: [{ section_origin: "ai_generated" }],
      },
      candidateSourceCount: 4,
    });
    expect(q.manuscript_origin?.creator_touch_signals.manual_after_ai_events).toBe(1);
    expect(q.manuscript_origin?.event_generation_modes.manual_after_ai).toBe(1);
  });
});
