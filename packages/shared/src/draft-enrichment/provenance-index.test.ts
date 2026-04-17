import { describe, expect, it } from "vitest";
import { buildChronologyEventsFromResearchPackage, CHRONOLOGY_EXTRACTION_VERSION } from "../chronology-extraction";
import { synthesizeResearchPackageV1 } from "../research-synthesis/synthesize";
import { buildDraftEnrichmentPackageV1 } from "./build";
import { buildDraftEnrichmentProvenanceIndex } from "./provenance-index";

describe("buildDraftEnrichmentProvenanceIndex", () => {
  it("flattens m5-t08 package into audit nodes", () => {
    const idA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const idB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const pkg = synthesizeResearchPackageV1({
      retrievalMode: "live",
      retrievalPartial: false,
      storyTitle: "T",
      sources: [
        {
          id: idA,
          positionIndex: 0,
          sourceUrl: "https://en.wikipedia.org/wiki/T",
          sourceTitle: "T",
          excerpt: "e1",
          relevanceNote: "r0",
          reliabilityTier: "high",
        },
        {
          id: idB,
          positionIndex: 1,
          sourceUrl: "https://en.wikipedia.org/wiki/O",
          sourceTitle: "O",
          excerpt: "e2",
          relevanceNote: "r1",
          reliabilityTier: "medium",
        },
      ],
    });
    const rows = buildChronologyEventsFromResearchPackage(
      {
        evidencePackageSummary: "x",
        candidateEventHints: [],
        riskFlags: [],
        researchSynthesisPackage: pkg,
      },
      [
        { id: idA, positionIndex: 0, sourceTitle: "T", excerpt: "e", relevanceNote: "r0", reliabilityTier: "high" },
        { id: idB, positionIndex: 1, sourceTitle: "O", excerpt: "e2", relevanceNote: "r1", reliabilityTier: "medium" },
      ],
    );
    const events = rows.map((r, i) => ({
      id: `cccccccc-0000-4000-8000-${String(i).padStart(12, "0")}`,
      positionIndex: i,
      headline: r.headline,
      summary: r.summary,
      contextLabel: r.contextLabel,
      eventType: r.eventType,
      supportingCandidateSourceIds: r.supportingCandidateSourceIds,
      ambiguityNote: r.ambiguityNote,
      creatorNote: r.creatorNote,
      claimRiskLevel: r.claimRiskLevel,
      confidenceState: r.confidenceState,
    }));
    const enrich = buildDraftEnrichmentPackageV1({
      storyId: "11111111-1111-1111-1111-111111111111",
      researchJobId: "22222222-2222-2222-2222-222222222222",
      storyTitle: "T",
      researchSynthesisPackage: pkg,
      chronologyExtractionVersion: CHRONOLOGY_EXTRACTION_VERSION,
      chronologyEvents: events,
    });
    const idx = buildDraftEnrichmentProvenanceIndex(enrich);
    expect(idx).not.toBeNull();
    expect(idx?.nodes.length).toBeGreaterThan(4);
    const arc = idx?.nodes.find((n) => n.node_kind === "major_arc");
    expect(arc?.provenance.synthesis_finding_ids.length).toBeGreaterThan(0);
    const ke = idx?.nodes.find((n) => n.node_kind === "key_event" && n.provenance.chronology_event_ids.length > 0);
    expect(ke?.provenance.chronology_event_ids[0]).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("returns null for legacy schema", () => {
    expect(buildDraftEnrichmentProvenanceIndex({ schema_version: "m5-t07-v1" })).toBeNull();
  });
});
