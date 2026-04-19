import { describe, expect, it } from "vitest";
import { RESEARCH_SYNTHESIS_SCHEMA_VERSION } from "./research-synthesis/types";
import { synthesizeResearchPackageV1 } from "./research-synthesis/synthesize";
import { buildChronologyEventsFromResearchPackage, inferHeuristicYearFromProse } from "./chronology-extraction";

describe("inferHeuristicYearFromProse", () => {
  it("surfaces the first plausible AD year for reader labels without inventing a calendar day", () => {
    const h = inferHeuristicYearFromProse("Pressure builds through 1972 and into 1973.");
    expect(h).not.toBeNull();
    expect(h?.yearAnchor).toBe(1972);
    expect(h?.displayDate).toContain("1972");
    expect(h?.eventDatePrecision).toBe("year");
  });

  it("returns null when no year token is present", () => {
    expect(inferHeuristicYearFromProse("No dates in this sentence.")).toBeNull();
  });
});

describe("buildChronologyEventsFromResearchPackage", () => {
  it("derives one row per candidate hint with grounded source ids", () => {
    const rows = buildChronologyEventsFromResearchPackage(
      {
        evidencePackageSummary: "Package body.",
        candidateEventHints: [
          { label: "timeline_anchor", detail: "Anchor event for the narrative spine." },
          { label: "open_questions", detail: "Verify dates with two references." },
        ],
        riskFlags: [{ code: "x", severity: "low", detail: "stub" }],
      },
      [
        {
          id: "11111111-1111-1111-1111-111111111111",
          positionIndex: 0,
          sourceTitle: "A",
          excerpt: null,
          relevanceNote: "r0",
          reliabilityTier: "high",
        },
        {
          id: "22222222-2222-2222-2222-222222222222",
          positionIndex: 1,
          sourceTitle: "B",
          excerpt: null,
          relevanceNote: "r1",
          reliabilityTier: "medium",
        },
      ],
    );
    expect(rows.length).toBe(2);
    expect(rows[0].supportingCandidateSourceIds.length).toBeGreaterThan(0);
    expect(rows[0].eventDatePrecision).toBe("unknown");
    expect(rows[0].mediaKind).toBe("none");
  });

  it("falls back to summary splitting when hints are empty", () => {
    const rows = buildChronologyEventsFromResearchPackage(
      {
        evidencePackageSummary: "First block of text.\n\nSecond block of text.",
        candidateEventHints: [],
        riskFlags: [],
      },
      [],
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((r) => r.summary.length > 0)).toBe(true);
    expect(rows.every((r) => r.creatorNote === null)).toBe(true);
  });

  it("M5-T06: uses synthesis package when schema matches", () => {
    const idA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const idB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const pkg = synthesizeResearchPackageV1({
      retrievalMode: "live",
      retrievalPartial: false,
      storyTitle: "Test Story",
      sources: [
        {
          id: idA,
          positionIndex: 0,
          sourceUrl: "https://example.com/a",
          sourceTitle: "Source A",
          excerpt: "Alpha claim.",
          relevanceNote: "r0",
          reliabilityTier: "high",
        },
        {
          id: idB,
          positionIndex: 1,
          sourceUrl: "https://example.com/b",
          sourceTitle: "Source B",
          excerpt: "Beta claim.",
          relevanceNote: "r1",
          reliabilityTier: "medium",
        },
      ],
    });
    expect(pkg.schema_version).toBe(RESEARCH_SYNTHESIS_SCHEMA_VERSION);

    const rows = buildChronologyEventsFromResearchPackage(
      {
        evidencePackageSummary: "ignored when synthesis parses",
        candidateEventHints: [],
        riskFlags: [],
        researchSynthesisPackage: pkg,
      },
      [
        {
          id: idA,
          positionIndex: 0,
          sourceTitle: "Source A",
          excerpt: "Alpha claim.",
          relevanceNote: "r0",
          reliabilityTier: "high",
        },
        {
          id: idB,
          positionIndex: 1,
          sourceTitle: "Source B",
          excerpt: "Beta claim.",
          relevanceNote: "r1",
          reliabilityTier: "medium",
        },
      ],
    );

    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0].eventType).toBe("context_note");
    expect(rows[0].contextLabel).toBe("m5_t06.insufficient_or_package_honesty");

    const sourced = rows.filter((r) => r.contextLabel?.startsWith("m5_t06.candidate.sourced_claim:"));
    expect(sourced.length).toBeGreaterThanOrEqual(2);
    expect(sourced[0].supportingCandidateSourceIds).toEqual([idA]);
    expect(sourced[1].supportingCandidateSourceIds).toEqual([idB]);
    expect(sourced.every((r) => r.creatorNote?.includes("finding_id"))).toBe(true);

    const summaryRow = rows.find((r) => r.contextLabel?.startsWith("m5_t06.non_event.synthesis_summary:"));
    expect(summaryRow?.eventType).toBe("synthesis");
    expect(summaryRow?.supportingCandidateSourceIds.sort()).toEqual([idA, idB].sort());
  });

  it("M5-T06: stub empty package stays honest with high claim risk", () => {
    const pkg = synthesizeResearchPackageV1({
      retrievalMode: "stub",
      retrievalPartial: true,
      retrievalPartialNotes: "timeout",
      storyTitle: "Lonely",
      sources: [],
    });
    const rows = buildChronologyEventsFromResearchPackage(
      {
        evidencePackageSummary: "",
        candidateEventHints: [],
        riskFlags: [],
        researchSynthesisPackage: pkg,
      },
      [],
    );
    expect(rows[0].claimRiskLevel).toBe("high");
    expect(rows.some((r) => r.contextLabel?.includes("coverage.gap_note"))).toBe(true);
  });
});
