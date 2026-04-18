import { describe, expect, it } from "vitest";
import { parseFramingOptionsFromLlmJson } from "./parse-llm-framing";

describe("parseFramingOptionsFromLlmJson", () => {
  it("parses valid framing_options", () => {
    const raw = JSON.stringify({
      framing_options: [
        {
          id: "a1",
          title: "Chronology-first",
          angle_description: "Time-ordered telling",
          narrative_emphasis: "Sequence of developments",
          caution_note: "Verify dates independently.",
          grounding_refs: [{ kind: "honesty_signal", label: "mixed_support" }],
        },
        {
          id: "a2",
          title: "Forces lens",
          angle_description: "Causal context",
          narrative_emphasis: "Why outcomes unfolded",
          caution_note: null,
          grounding_refs: [],
        },
      ],
    });
    const r = parseFramingOptionsFromLlmJson(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.options).toHaveLength(2);
      expect(r.options[0].grounding_refs[0]?.kind).toBe("honesty_signal");
    }
  });

  it("rejects invalid payloads", () => {
    expect(parseFramingOptionsFromLlmJson("{").ok).toBe(false);
    expect(parseFramingOptionsFromLlmJson(JSON.stringify({})).ok).toBe(false);
  });
});
