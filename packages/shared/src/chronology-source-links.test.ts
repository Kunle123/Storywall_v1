import { describe, expect, it } from "vitest";
import { buildChronologyEventSourceLinkRows } from "./chronology-source-links";

describe("buildChronologyEventSourceLinkRows", () => {
  const base = {
    chronologyExtractedEventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    storyId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    researchJobId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  };

  it("maps primary high-tier source to documents with sufficiency", () => {
    const id1 = "11111111-1111-1111-1111-111111111111";
    const m = new Map([
      [id1, { id: id1, reliabilityTier: "high" as const, relevanceNote: "Direct coverage." }],
    ]);
    const rows = buildChronologyEventSourceLinkRows({
      ...base,
      candidateSourceIds: [id1],
      sourceById: m,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].relationKind).toBe("documents");
    expect(rows[0].countsTowardSufficiency).toBe(true);
  });

  it("marks second source as corroborates", () => {
    const id1 = "11111111-1111-1111-1111-111111111111";
    const id2 = "22222222-2222-2222-2222-222222222222";
    const m = new Map([
      [id1, { id: id1, reliabilityTier: "high" as const, relevanceNote: "A" }],
      [id2, { id: id2, reliabilityTier: "medium" as const, relevanceNote: "B" }],
    ]);
    const rows = buildChronologyEventSourceLinkRows({
      ...base,
      candidateSourceIds: [id1, id2],
      sourceById: m,
    });
    expect(rows).toHaveLength(2);
    expect(rows[1].relationKind).toBe("corroborates");
    expect(rows[1].orderingIndex).toBe(1);
  });

  it("uses disputes when relevance text signals conflict", () => {
    const id1 = "11111111-1111-1111-1111-111111111111";
    const m = new Map([
      [id1, { id: id1, reliabilityTier: "high" as const, relevanceNote: "Source disputes the timeline." }],
    ]);
    const rows = buildChronologyEventSourceLinkRows({
      ...base,
      candidateSourceIds: [id1],
      sourceById: m,
    });
    expect(rows[0].relationKind).toBe("disputes");
    expect(rows[0].countsTowardSufficiency).toBe(false);
  });
});
