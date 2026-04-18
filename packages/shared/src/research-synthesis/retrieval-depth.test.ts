import { describe, expect, it } from "vitest";
import { synthesizeResearchPackageV1 } from "./synthesize";
import { computeRetrievalDepthAssessment } from "./retrieval-depth";

describe("computeRetrievalDepthAssessment (M5-T23)", () => {
  it("classifies stub with several candidates as partial (never solid)", () => {
    const pkg = synthesizeResearchPackageV1({
      retrievalMode: "stub",
      retrievalPartial: false,
      storyTitle: "Subject",
      sources: [
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          positionIndex: 0,
          sourceUrl: "https://example.invalid/a",
          sourceTitle: "A",
          excerpt: "one",
          relevanceNote: "r",
          reliabilityTier: "medium",
        },
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          positionIndex: 1,
          sourceUrl: "https://example.invalid/b",
          sourceTitle: "B",
          excerpt: "two",
          relevanceNote: "r",
          reliabilityTier: "medium",
        },
        {
          id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
          positionIndex: 2,
          sourceUrl: "https://example.invalid/c",
          sourceTitle: "C",
          excerpt: "three",
          relevanceNote: "r",
          reliabilityTier: "low",
        },
        {
          id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
          positionIndex: 3,
          sourceUrl: "https://example.invalid/d",
          sourceTitle: "D",
          excerpt: "four",
          relevanceNote: "r",
          reliabilityTier: "low",
        },
      ],
    });
    const d = computeRetrievalDepthAssessment({
      researchSynthesisPackage: pkg,
      candidateSources: [
        { source_url: "https://example.invalid/a" },
        { source_url: "https://example.invalid/b" },
        { source_url: "https://example.invalid/c" },
        { source_url: "https://example.invalid/d" },
      ],
    });
    expect(d.tier).toBe("partial");
    expect(d.evidence.retrieval_mode).toBe("stub");
    expect(d.evidence.distinct_source_hosts).toBe(1);
    expect(d.evidence.candidate_source_count).toBeGreaterThanOrEqual(4);
    expect(d.evidence.sourced_claim_finding_count).toBeGreaterThanOrEqual(4);
  });

  it("classifies diversified live package as solid when breadth thresholds met", () => {
    const sources = [
      {
        id: "a0000000-0000-4000-8000-000000000001",
        positionIndex: 0,
        sourceUrl: "https://en.wikipedia.org/wiki/A",
        sourceTitle: "A",
        excerpt: "e",
        relevanceNote: "r",
        reliabilityTier: "high",
      },
      {
        id: "a0000000-0000-4000-8000-000000000002",
        positionIndex: 1,
        sourceUrl: "https://en.wikipedia.org/wiki/B",
        sourceTitle: "B",
        excerpt: "e",
        relevanceNote: "r",
        reliabilityTier: "high",
      },
      {
        id: "a0000000-0000-4000-8000-000000000003",
        positionIndex: 2,
        sourceUrl: "https://www.britannica.com/foo",
        sourceTitle: "Brit",
        excerpt: "e",
        relevanceNote: "r",
        reliabilityTier: "medium",
      },
      {
        id: "a0000000-0000-4000-8000-000000000004",
        positionIndex: 3,
        sourceUrl: "https://www.nytimes.com/bar",
        sourceTitle: "NYT",
        excerpt: "e",
        relevanceNote: "r",
        reliabilityTier: "medium",
      },
      {
        id: "a0000000-0000-4000-8000-000000000005",
        positionIndex: 4,
        sourceUrl: "https://www.reuters.com/baz",
        sourceTitle: "Reuters",
        excerpt: "e",
        relevanceNote: "r",
        reliabilityTier: "medium",
      },
    ];
    const pkg = synthesizeResearchPackageV1({
      retrievalMode: "live",
      retrievalPartial: false,
      storyTitle: "Wide",
      sources,
    });
    const d = computeRetrievalDepthAssessment({
      researchSynthesisPackage: pkg,
      candidateSources: sources.map((s) => ({ source_url: s.sourceUrl })),
    });
    expect(d.tier).toBe("solid");
    expect(d.evidence.distinct_source_hosts).toBeGreaterThanOrEqual(2);
  });

  it("live partial with tiny hit set is thin", () => {
    const pkg = synthesizeResearchPackageV1({
      retrievalMode: "live",
      retrievalPartial: true,
      retrievalPartialNotes: "timeout",
      storyTitle: "T",
      sources: [
        {
          id: "x",
          positionIndex: 0,
          sourceUrl: "https://en.wikipedia.org/wiki/X",
          sourceTitle: "X",
          excerpt: null,
          relevanceNote: "r",
          reliabilityTier: "low",
        },
      ],
    });
    const d = computeRetrievalDepthAssessment({
      researchSynthesisPackage: pkg,
      candidateSources: [{ source_url: "https://en.wikipedia.org/wiki/X" }],
    });
    expect(d.tier).toBe("thin");
  });
});
