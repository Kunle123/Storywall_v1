import { describe, expect, it } from "vitest";
import { RESEARCH_SYNTHESIS_SCHEMA_VERSION } from "./types";
import { parseResearchSynthesisPackageV1 } from "./parse";

describe("parseResearchSynthesisPackageV1", () => {
  it("returns null for wrong schema", () => {
    expect(parseResearchSynthesisPackageV1({ schema_version: "x", findings: [] })).toBeNull();
  });

  it("parses a minimal valid package", () => {
    const pkg = parseResearchSynthesisPackageV1({
      schema_version: RESEARCH_SYNTHESIS_SCHEMA_VERSION,
      retrieval_mode: "stub",
      retrieval_partial: false,
      generated_at: "2026-01-01T00:00:00.000Z",
      coverage_notes: ["n"],
      open_questions: ["q"],
      findings: [
        {
          id: "f1",
          kind: "gap_note",
          text: "t",
          supporting_research_candidate_source_ids: [],
          confidence: "low",
        },
      ],
      clusters: [],
    });
    expect(pkg).not.toBeNull();
    expect(pkg?.findings[0]?.id).toBe("f1");
  });
});
