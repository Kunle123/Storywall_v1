import { describe, expect, it } from "vitest";
import { buildChronologyEventsFromResearchPackage, CHRONOLOGY_EXTRACTION_VERSION } from "../chronology-extraction";
import { synthesizeResearchPackageV1 } from "../research-synthesis/synthesize";
import { RESEARCH_SYNTHESIS_SCHEMA_VERSION } from "../research-synthesis/types";
import { buildDraftEnrichmentPackageV1 } from "./build";
import { buildDraftEnrichmentProvenanceIndex } from "./provenance-index";
import { buildResearchPackageHonestySummary, RESEARCH_PACKAGE_HONESTY_SUMMARY_VERSION } from "./honesty-summary";

function sampleEnrichmentAndSynthesis() {
  const idA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const idB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const idC = "cccccccc-cccc-cccc-cccc-cccccccccccc";
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
      {
        id: idC,
        positionIndex: 2,
        sourceUrl: "https://www.britannica.com/biography/Test-Subject",
        sourceTitle: "Britannica",
        excerpt: "Third excerpt for M5-T23 breadth.",
        relevanceNote: "r2",
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
      { id: idC, positionIndex: 2, sourceTitle: "B", excerpt: "e3", relevanceNote: "r2", reliabilityTier: "medium" },
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
  const enrich = buildDraftEnrichmentPackageV1({
    storyId: "11111111-1111-1111-1111-111111111111",
    researchJobId: "22222222-2222-2222-2222-222222222222",
    storyTitle: "Test Subject",
    researchSynthesisPackage: pkg,
    chronologyExtractionVersion: CHRONOLOGY_EXTRACTION_VERSION,
    chronologyEvents: events,
  });
  return { pkg, enrich };
}

describe("buildResearchPackageHonestySummary", () => {
  it("M5-T09: m5-t08 enrichment yields full provenance traceability + rollup aligned with provenance index", () => {
    const { pkg, enrich } = sampleEnrichmentAndSynthesis();
    const idx = buildDraftEnrichmentProvenanceIndex(enrich);
    expect(idx).not.toBeNull();

    const h = buildResearchPackageHonestySummary({
      draftEnrichmentPackage: enrich,
      researchSynthesisPackage: pkg,
    });

    expect(h.schema_version).toBe(RESEARCH_PACKAGE_HONESTY_SUMMARY_VERSION);
    expect(h.narrative_generation_mode).toBe("deterministic_scaffolding");
    expect(h.provenance_traceability).toBe("full_m5_t08");
    expect(h.publishable_narrative_posture).toBe("creator_guidance_only");
    expect(h.synthesis_retrieval_partial).toBe(false);
    expect(h.support_status_rollup.total_nodes).toBe(idx!.nodes.length);
    const sum =
      h.support_status_rollup.fully_source_backed +
      h.support_status_rollup.partially_source_backed +
      h.support_status_rollup.chronology_thin_sources +
      h.support_status_rollup.unresolved_weak;
    expect(sum).toBe(h.support_status_rollup.total_nodes);
    expect(h.ui_hints.length).toBeGreaterThanOrEqual(4);
    expect(h.ui_hints.some((l) => l.includes("deterministic"))).toBe(true);
    expect(h.ui_hints.some((l) => l.includes("M5-T08"))).toBe(true);
    expect(h.retrieval_depth.tier).toBe("partial");
    expect(h.retrieval_depth.evidence.retrieval_mode).toBe("live");
  });

  it("reports unavailable provenance when enrichment is absent", () => {
    const h = buildResearchPackageHonestySummary({
      draftEnrichmentPackage: null,
      researchSynthesisPackage: null,
    });
    expect(h.provenance_traceability).toBe("unavailable_no_enrichment");
    expect(h.support_status_rollup.total_nodes).toBe(0);
    expect(h.has_mixed_or_weak_support).toBe(false);
    expect(h.retrieval_depth.tier).toBe("thin");
  });

  it("legacy m5-t07 package is flagged without implying full traceability", () => {
    const h = buildResearchPackageHonestySummary({
      draftEnrichmentPackage: {
        schema_version: "m5-t07-v1",
        story_id: "11111111-1111-1111-1111-111111111111",
        research_job_id: "22222222-2222-2222-2222-222222222222",
      },
      researchSynthesisPackage: {
        schema_version: RESEARCH_SYNTHESIS_SCHEMA_VERSION,
        retrieval_mode: "live",
        retrieval_partial: false,
        generated_at: "2020-01-01T00:00:00.000Z",
        coverage_notes: [],
        open_questions: [],
        findings: [],
        clusters: [],
      },
    });
    expect(h.provenance_traceability).toBe("legacy_package_no_node_provenance_index");
    expect(h.has_mixed_or_weak_support).toBe(true);
    expect(h.ui_hints.some((l) => l.includes("unavailable"))).toBe(true);
    expect(h.retrieval_depth.tier).toBe("thin");
  });

  it("surfaces partial retrieval from synthesis alongside enrichment", () => {
    const { pkg, enrich } = sampleEnrichmentAndSynthesis();
    const partialPkg = { ...pkg, retrieval_partial: true };
    const h = buildResearchPackageHonestySummary({
      draftEnrichmentPackage: enrich,
      researchSynthesisPackage: partialPkg,
    });
    expect(h.synthesis_retrieval_partial).toBe(true);
    expect(h.has_mixed_or_weak_support).toBe(true);
    expect(h.ui_hints.some((l) => l.toLowerCase().includes("partial"))).toBe(true);
    expect(h.retrieval_depth.tier).toBe("partial");
  });
});
