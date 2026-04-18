import { describe, expect, it } from "vitest";
import type { DraftEnrichmentPackageV1 } from "../draft-enrichment/types";
import { DRAFT_ENRICHMENT_SCHEMA_VERSION } from "../draft-enrichment/types";
import { buildFallbackLiveEnrichmentFromDraftPackage } from "./fallback-from-draft-enrichment";
import { LIVE_EVENT_DRAFT_ENRICHMENT_SCHEMA_VERSION } from "./types";

const minimalDraftPkg = {
  schema_version: DRAFT_ENRICHMENT_SCHEMA_VERSION,
  story_id: "00000000-0000-4000-8000-0000000000a1",
  research_job_id: "00000000-0000-4000-8000-0000000000b2",
  generated_at: "2026-01-01T00:00:00.000Z",
  retrieval_context: "stub" as const,
  retrieval_partial: false,
  not_publishable_narrative_note: "x".repeat(50),
  provenance_trace_note: "M5-T08 trace",
  synthesis_schema_version: "m5-t05-v1",
  chronology_extraction_version: "m5-t06-v1",
  summary_spine: "spine",
  summary_spine_node: {
    id: "summary:spine" as const,
    text: "t",
    provenance: {
      synthesis_finding_ids: ["f1"],
      chronology_event_ids: ["evt1"],
      research_candidate_source_ids: [],
    },
    support_status: "partially_source_backed" as const,
    weak_support_explanation: null,
  },
  major_arcs: [],
  suggested_sections: [
    {
      id: "sec:1",
      title: "Opening",
      rationale: "Hook readers.",
      linked_synthesis_finding_ids: ["f1"],
      linked_chronology_position_indexes: [0],
      provenance: {
        synthesis_finding_ids: ["f1"],
        chronology_event_ids: ["evt1"],
        research_candidate_source_ids: [],
      },
      support_status: "partially_source_backed" as const,
      weak_support_explanation: "thin",
    },
  ],
  key_events: [
    {
      chronology_event_id: "evt1",
      position_index: 0,
      headline: "H",
      summary_clip: "S",
      event_type: "milestone",
      context_label: null,
      supporting_research_candidate_source_ids: [],
      linked_synthesis_finding_ids: ["f1"],
      claim_risk_level: "low",
      confidence_state: "emerging",
      ambiguity_carryforward: null,
      provenance: {
        synthesis_finding_ids: ["f1"],
        chronology_event_ids: ["evt1"],
        research_candidate_source_ids: ["src1"],
      },
      support_status: "partially_source_backed" as const,
      weak_support_explanation: null,
    },
  ],
  coverage_gaps: [],
  ambiguity_notes: [],
} satisfies DraftEnrichmentPackageV1;

describe("buildFallbackLiveEnrichmentFromDraftPackage", () => {
  it("maps m5-t08 draft enrichment into m5-t11 envelope", () => {
    const out = buildFallbackLiveEnrichmentFromDraftPackage({
      storyId: "00000000-0000-4000-8000-0000000000a1",
      researchJobId: "00000000-0000-4000-8000-0000000000b2",
      draftEnrichmentPackage: minimalDraftPkg,
      honestyContext: { schema_version: "m5-t09-v1" },
      framingReference: {
        framing_generation_prompt_key: "framing.live_package_m5_t10_v1",
        framing_option_ids: ["opt1"],
      },
      provider: "none",
      promptTemplateKey: "enrichment.live_events_sections_m5_t11_v1",
      promptVersion: "1.0.0",
    });
    expect(out).not.toBeNull();
    if (!out) return;
    expect(out.schema_version).toBe(LIVE_EVENT_DRAFT_ENRICHMENT_SCHEMA_VERSION);
    expect(out.generation_mode).toBe("deterministic_scaffolding_fallback");
    expect(out.status).toBe("fallback_deterministic");
    expect(out.enriched_events).toHaveLength(1);
    expect(out.enriched_events[0].chronology_event_id).toBe("evt1");
    expect(out.suggested_sections).toHaveLength(1);
    expect(out.suggested_sections[0].supporting_synthesis_finding_ids).toContain("f1");
    expect(out.failure?.code).toBe("live_enrichment_used_deterministic_draft_mapping");
  });

  it("returns null for wrong schema", () => {
    expect(
      buildFallbackLiveEnrichmentFromDraftPackage({
        storyId: "s",
        researchJobId: "j",
        draftEnrichmentPackage: { schema_version: "other" },
        honestyContext: null,
        framingReference: null,
        provider: "none",
        promptTemplateKey: "k",
        promptVersion: "1",
      }),
    ).toBeNull();
  });
});
