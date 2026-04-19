import { describe, expect, it } from "vitest";
import { assessEnrichmentMaterializationQuality, ENRICHMENT_MATERIALIZATION_QUALITY_VERSION } from "./enrichment-materialization-quality";

describe("assessEnrichmentMaterializationQuality (M5-T26)", () => {
  it("marks empty chronology + missing package as scaffold_thin", () => {
    const q = assessEnrichmentMaterializationQuality({
      chronologyEvents: [],
      draftEnrichmentPackage: null,
      manuscript: null,
    });
    expect(q.schema_version).toBe(ENRICHMENT_MATERIALIZATION_QUALITY_VERSION);
    expect(q.chronology_layer.overall).toBe("scaffold_thin");
    expect(q.draft_enrichment_layer.overall).toBe("scaffold_thin");
    expect(q.manuscript_shell).toBeNull();
    expect(q.combined_overall).toBe("scaffold_thin");
  });

  it("treats substantive sourced_claim chronology rows as production_usable when ratio and averages hold", () => {
    const rows = [
      { headline: "Chronology coverage (M5-T06)", summary: "preamble", context_label: "m5_t06.insufficient_or_package_honesty" },
      ...Array.from({ length: 5 }, (_, i) => ({
        headline: `Sourced beat ${i + 1}`,
        summary:
          "A".repeat(110) +
          " This excerpt-scale summary ties the beat to candidate material for editing, not a one-line stub.",
        context_label: "m5_t06.candidate.sourced_claim:abc",
        event_type: "standard",
        position_index: i + 1,
      })),
    ];
    const pkg = {
      schema_version: "m5-t08-v1",
      summary_spine: "X".repeat(240),
      key_events: [
        { headline: "Key opening beat", summary_clip: "Y".repeat(60) },
        { headline: "Key turning point", summary_clip: "Z".repeat(60) },
      ],
      suggested_sections: [
        { title: "Act structure", rationale: "R".repeat(58) },
        { title: "Resolution", rationale: "S".repeat(58) },
      ],
      major_arcs: [{ id: "a1" }],
    };
    const q = assessEnrichmentMaterializationQuality({
      chronologyEvents: rows,
      draftEnrichmentPackage: pkg,
      manuscript: null,
    });
    expect(q.chronology_layer.overall).toBe("production_usable");
    expect(q.draft_enrichment_layer.overall).toBe("production_usable");
    expect(q.combined_overall).toBe("production_usable");
  });

  it("pulls combined tier down when manuscript shell is thin", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      headline: `Beat ${i}`,
      summary: "B".repeat(100),
      context_label: "m5_t06.candidate.sourced_claim:x",
    }));
    const pkg = {
      schema_version: "m5-t08-v1",
      summary_spine: "S".repeat(240),
      key_events: [
        { headline: "K1", summary_clip: "C".repeat(55) },
        { headline: "K2", summary_clip: "D".repeat(55) },
      ],
      suggested_sections: [
        { title: "S1", rationale: "E".repeat(58) },
        { title: "S2", rationale: "F".repeat(58) },
      ],
      major_arcs: [],
    };
    const q = assessEnrichmentMaterializationQuality({
      chronologyEvents: rows,
      draftEnrichmentPackage: pkg,
      manuscript: { events: [{ headline: "x", summary: "short" }], sections: [] },
    });
    expect(q.manuscript_shell?.overall).toBe("scaffold_thin");
    expect(q.combined_overall).toBe("scaffold_thin");
  });
});
