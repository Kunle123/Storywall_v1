import { describe, expect, it } from "vitest";
import { parseEditorialReviewFromLlmJson } from "./parse-llm-editorial-review";

describe("parseEditorialReviewFromLlmJson", () => {
  it("parses valid payload", () => {
    const raw = JSON.stringify({
      review_findings: [
        {
          id: "f1",
          category: "thin_support",
          severity: "high",
          explanation: "Headline overstates what sources support.",
          suggested_action: "Soften headline or add citation.",
          grounding_refs: [{ kind: "chronology_event", id: "00000000-0000-4000-8000-000000000001" }],
        },
      ],
      overall_editorial_posture: "Treat chronology as provisional where density is low.",
    });
    const r = parseEditorialReviewFromLlmJson(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.review_findings).toHaveLength(1);
      expect(r.overall_editorial_posture.length).toBeGreaterThan(10);
    }
  });

  it("rejects invalid", () => {
    expect(parseEditorialReviewFromLlmJson("{}").ok).toBe(false);
  });
});
