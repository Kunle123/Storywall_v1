import { describe, expect, it } from "vitest";
import { buildChronologyEventsFromResearchPackage } from "./chronology-extraction";

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
  });
});
