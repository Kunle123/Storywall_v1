import { describe, expect, it } from "vitest";
import { parseLiveEnrichmentFromLlmJson } from "./parse-llm-live-enrichment";

describe("parseLiveEnrichmentFromLlmJson", () => {
  it("parses valid payload", () => {
    const raw = JSON.stringify({
      enriched_events: [
        {
          id: "e1",
          chronology_event_id: "00000000-0000-4000-8000-000000000001",
          narrative_expansion: "Context for the row.",
          emphasis_note: "medium",
          caution_note: null,
          grounding_refs: [{ kind: "chronology_event", id: "00000000-0000-4000-8000-000000000001" }],
        },
      ],
      suggested_sections: [
        {
          id: "s1",
          title: "Opening",
          purpose: "Set stakes.",
          supporting_chronology_event_ids: ["00000000-0000-4000-8000-000000000001"],
          supporting_synthesis_finding_ids: ["f1"],
          caution_note: "Thin sources.",
          grounding_refs: [{ kind: "honesty_signal", label: "mixed_support" }],
        },
      ],
    });
    const r = parseLiveEnrichmentFromLlmJson(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.enriched_events).toHaveLength(1);
      expect(r.suggested_sections).toHaveLength(1);
    }
  });

  it("rejects invalid", () => {
    expect(parseLiveEnrichmentFromLlmJson("{}").ok).toBe(false);
  });
});
