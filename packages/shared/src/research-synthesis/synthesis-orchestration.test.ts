import { describe, expect, it } from "vitest";
import { synthesizeResearchPackageV1 } from "./synthesize";
import { computeSynthesisOrchestrationAssessment, formatSynthesisOrchestrationBriefForPrompt } from "./synthesis-orchestration";

const idA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const idB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("M5-T24 synthesis orchestration", () => {
  it("formatSynthesisOrchestrationBriefForPrompt includes cluster and finding lines", () => {
    const pkg = synthesizeResearchPackageV1({
      retrievalMode: "stub",
      retrievalPartial: false,
      storyTitle: "T",
      sources: [
        {
          id: idA,
          positionIndex: 0,
          sourceUrl: "https://a.example/x",
          sourceTitle: "A",
          excerpt: "one",
          relevanceNote: "r",
          reliabilityTier: "high",
        },
        {
          id: idB,
          positionIndex: 1,
          sourceUrl: "https://b.example/y",
          sourceTitle: "B",
          excerpt: "two",
          relevanceNote: "r",
          reliabilityTier: "medium",
        },
      ],
    });
    const brief = formatSynthesisOrchestrationBriefForPrompt(pkg);
    expect(brief).toContain("Clusters");
    expect(brief).toContain("cluster-primary-candidates");
    expect(brief).toContain("Findings");
    expect(brief).toContain("finding-src-0");
  });

  it("thin tier when package missing or unparseable", () => {
    const a = computeSynthesisOrchestrationAssessment({ researchSynthesisPackage: null });
    expect(a.tier).toBe("thin");
    expect(a.evidence.sourced_claim_count).toBe(0);
  });

  it("pipeline_materialization_coherent is null when supplement counts unknown", () => {
    const pkg = synthesizeResearchPackageV1({
      retrievalMode: "live",
      retrievalPartial: false,
      storyTitle: "S",
      sources: [
        {
          id: idA,
          positionIndex: 0,
          sourceUrl: "https://en.wikipedia.org/wiki/S",
          sourceTitle: "W",
          excerpt: "e",
          relevanceNote: "r",
          reliabilityTier: "high",
        },
        {
          id: idB,
          positionIndex: 1,
          sourceUrl: "https://en.wikipedia.org/wiki/S2",
          sourceTitle: "W2",
          excerpt: "e2",
          relevanceNote: "r",
          reliabilityTier: "medium",
        },
        {
          id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
          positionIndex: 2,
          sourceUrl: "https://www.britannica.com/x",
          sourceTitle: "B",
          excerpt: "e3",
          relevanceNote: "r",
          reliabilityTier: "medium",
        },
        {
          id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
          positionIndex: 3,
          sourceUrl: "https://www.nytimes.com/x",
          sourceTitle: "N",
          excerpt: "e4",
          relevanceNote: "r",
          reliabilityTier: "medium",
        },
      ],
    });
    const o = computeSynthesisOrchestrationAssessment({ researchSynthesisPackage: pkg });
    expect(o.pipeline_materialization_coherent).toBeNull();
    expect(o.consumer_alignment.chronology_events_materialized).toBeNull();
    expect(o.headline).toContain("not evaluated");
  });

  it("pipeline_materialization_coherent true when chronology and enrichment present", () => {
    const pkg = synthesizeResearchPackageV1({
      retrievalMode: "live",
      retrievalPartial: false,
      storyTitle: "S",
      sources: [
        {
          id: idA,
          positionIndex: 0,
          sourceUrl: "https://a.example/x",
          sourceTitle: "A",
          excerpt: "one",
          relevanceNote: "r",
          reliabilityTier: "high",
        },
        {
          id: idB,
          positionIndex: 1,
          sourceUrl: "https://b.example/y",
          sourceTitle: "B",
          excerpt: "two",
          relevanceNote: "r",
          reliabilityTier: "medium",
        },
        {
          id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
          positionIndex: 2,
          sourceUrl: "https://c.example/z",
          sourceTitle: "C",
          excerpt: "three",
          relevanceNote: "r",
          reliabilityTier: "medium",
        },
        {
          id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
          positionIndex: 3,
          sourceUrl: "https://d.example/w",
          sourceTitle: "D",
          excerpt: "four",
          relevanceNote: "r",
          reliabilityTier: "medium",
        },
      ],
    });
    const o = computeSynthesisOrchestrationAssessment({
      researchSynthesisPackage: pkg,
      chronology_event_count: 5,
      draft_enrichment_package_present: true,
    });
    expect(o.pipeline_materialization_coherent).toBe(true);
    expect(o.consumer_alignment.framing_live_prompt_includes_structured_brief).toBe(true);
    expect(o.evidence.sourced_claim_count).toBeGreaterThanOrEqual(4);
  });
});
