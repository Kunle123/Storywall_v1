import { describe, expect, it } from "vitest";
import { synthesizeResearchPackageV1 } from "./synthesize";
import { RESEARCH_SYNTHESIS_SCHEMA_VERSION } from "./types";

describe("synthesizeResearchPackageV1", () => {
  it("builds provenance-linked findings for live mode", () => {
    const pkg = synthesizeResearchPackageV1({
      retrievalMode: "live",
      retrievalPartial: false,
      storyTitle: "Test Story",
      sources: [
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          positionIndex: 0,
          sourceUrl: "https://en.wikipedia/wiki/Foo",
          sourceTitle: "Foo",
          excerpt: "Alpha snippet.",
          relevanceNote: "r",
          reliabilityTier: "medium",
        },
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          positionIndex: 1,
          sourceUrl: "https://en.wikipedia/wiki/Bar",
          sourceTitle: "Bar",
          excerpt: null,
          relevanceNote: "r2",
          reliabilityTier: "unrated",
        },
      ],
    });
    expect(pkg.schema_version).toBe(RESEARCH_SYNTHESIS_SCHEMA_VERSION);
    expect(pkg.retrieval_mode).toBe("live");
    const sourced = pkg.findings.filter((f) => f.kind === "sourced_claim");
    expect(sourced.length).toBe(2);
    expect(sourced[0]!.supporting_research_candidate_source_ids).toEqual(["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]);
    expect(sourced[1]!.supporting_research_candidate_source_ids).toEqual(["bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"]);
    const summary = pkg.findings.find((f) => f.kind === "synthesis_summary");
    expect(summary?.supporting_research_candidate_source_ids.length).toBe(2);
    expect(pkg.clusters[0]!.supporting_research_candidate_source_ids.length).toBe(2);
  });

  it("marks stub honesty and omits live-only gaps", () => {
    const pkg = synthesizeResearchPackageV1({
      retrievalMode: "stub",
      retrievalPartial: false,
      storyTitle: "S",
      sources: [
        {
          id: "c",
          positionIndex: 0,
          sourceUrl: "https://example.invalid/x",
          sourceTitle: "Stub",
          excerpt: "x",
          relevanceNote: "r",
          reliabilityTier: "low",
        },
      ],
    });
    expect(pkg.findings.some((f) => f.id === "finding-gap-stub")).toBe(true);
    expect(pkg.findings.some((f) => f.id === "finding-gap-partial-retrieval")).toBe(false);
  });

  it("records partial retrieval notes", () => {
    const pkg = synthesizeResearchPackageV1({
      retrievalMode: "live",
      retrievalPartial: true,
      retrievalPartialNotes: "Only two rows returned.",
      storyTitle: "T",
      sources: [
        {
          id: "d",
          positionIndex: 0,
          sourceUrl: "https://en.wikipedia/wiki/X",
          sourceTitle: "X",
          excerpt: "e",
          relevanceNote: "r",
          reliabilityTier: "medium",
        },
      ],
    });
    expect(pkg.retrieval_partial).toBe(true);
    expect(pkg.findings.some((f) => f.id === "finding-gap-partial-retrieval")).toBe(true);
  });
});
