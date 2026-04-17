import { describe, expect, it } from "vitest";
import { buildChronologyEventsFromResearchPackage, CHRONOLOGY_EXTRACTION_VERSION } from "../chronology-extraction";
import { synthesizeResearchPackageV1 } from "../research-synthesis/synthesize";
import { RESEARCH_SYNTHESIS_SCHEMA_VERSION } from "../research-synthesis/types";
import { buildDraftEnrichmentPackageV1 } from "./build";
import { DRAFT_ENRICHMENT_SCHEMA_VERSION } from "./types";

describe("buildDraftEnrichmentPackageV1", () => {
  it("grounds enrichment in synthesis + chronology with provenance ids", () => {
    const idA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const idB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const pkg = synthesizeResearchPackageV1({
      retrievalMode: "live",
      retrievalPartial: false,
      storyTitle: "Test Subject",
      sources: [
        {
          id: idA,
          positionIndex: 0,
          sourceUrl: "https://en.wikipedia.org/wiki/Test",
          sourceTitle: "T",
          excerpt: "Excerpt one.",
          relevanceNote: "r0",
          reliabilityTier: "high",
        },
        {
          id: idB,
          positionIndex: 1,
          sourceUrl: "https://en.wikipedia.org/wiki/Other",
          sourceTitle: "O",
          excerpt: "Excerpt two.",
          relevanceNote: "r1",
          reliabilityTier: "medium",
        },
      ],
    });
    expect(pkg.schema_version).toBe(RESEARCH_SYNTHESIS_SCHEMA_VERSION);

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
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
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

    const out = buildDraftEnrichmentPackageV1({
      storyId: "11111111-1111-1111-1111-111111111111",
      researchJobId: "22222222-2222-2222-2222-222222222222",
      storyTitle: "Test Subject",
      researchSynthesisPackage: pkg,
      chronologyExtractionVersion: CHRONOLOGY_EXTRACTION_VERSION,
      chronologyEvents: events,
    });

    expect(out.schema_version).toBe(DRAFT_ENRICHMENT_SCHEMA_VERSION);
    expect(out.synthesis_schema_version).toBe("m5-t05-v1");
    expect(out.retrieval_context).toBe("live");
    expect(out.not_publishable_narrative_note.length).toBeGreaterThan(40);
    expect(out.major_arcs.length).toBeGreaterThanOrEqual(1);
    expect(out.key_events.length).toBeGreaterThanOrEqual(1);
    const withSource = out.key_events.find((k) => k.supporting_research_candidate_source_ids.includes(idA));
    expect(withSource).toBeTruthy();
    const linked = out.key_events.some((k) => k.linked_synthesis_finding_ids.length > 0);
    expect(linked).toBe(true);
    expect(out.coverage_gaps.length + out.ambiguity_notes.length).toBeGreaterThan(0);
  });

  it("handles missing synthesis with chronology-only honesty", () => {
    const rows = buildChronologyEventsFromResearchPackage(
      {
        evidencePackageSummary: "Line one.\n\nLine two block.",
        candidateEventHints: [],
        riskFlags: [],
      },
      [],
    );
    const events = rows.map((r, i) => ({
      id: `bbbbbbbb-0000-4000-8000-${String(i).padStart(12, "0")}`,
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
    const out = buildDraftEnrichmentPackageV1({
      storyId: "c",
      researchJobId: "d",
      storyTitle: "Legacy",
      researchSynthesisPackage: null,
      chronologyExtractionVersion: CHRONOLOGY_EXTRACTION_VERSION,
      chronologyEvents: events,
    });
    expect(out.synthesis_schema_version).toBeNull();
    expect(out.retrieval_context).toBe("unknown");
    expect(out.major_arcs[0]?.origin).toBe("chronology_only");
  });
});
