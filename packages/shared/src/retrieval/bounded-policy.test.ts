import { describe, expect, it } from "vitest";
import { formatBoundedRetrievalBootstrapLine, parseBoundedRetrievalPolicyFromEnv } from "./bounded-policy";

describe("parseBoundedRetrievalPolicyFromEnv", () => {
  it("defaults to stub when flag is absent or false", () => {
    expect(parseBoundedRetrievalPolicyFromEnv({}).mode).toBe("stub");
    expect(parseBoundedRetrievalPolicyFromEnv({ STORYWALL_RETRIEVAL_ENABLED: "false" }).mode).toBe("stub");
  });

  it("parses live mode with defaults", () => {
    const p = parseBoundedRetrievalPolicyFromEnv({ STORYWALL_RETRIEVAL_ENABLED: "true" });
    expect(p.mode).toBe("live");
    if (p.mode === "live") {
      expect(p.timeoutMs).toBe(12_000);
      expect(p.maxCandidates).toBe(4);
      expect(p.allowedApiHosts).toEqual(["en.wikipedia.org"]);
      expect(p.userAgent).toContain("StorywallResearch");
    }
  });

  it("invalidates live when allowed host list is empty after explicit empty CSV", () => {
    const p = parseBoundedRetrievalPolicyFromEnv({
      STORYWALL_RETRIEVAL_ENABLED: "true",
      STORYWALL_RETRIEVAL_ALLOWED_API_HOSTS: " , , ",
    });
    expect(p.mode).toBe("invalid_live");
    if (p.mode === "invalid_live") {
      expect(p.reasons.length).toBeGreaterThan(0);
    }
  });

  it("format line stays secret-free", () => {
    const p = parseBoundedRetrievalPolicyFromEnv({ STORYWALL_RETRIEVAL_ENABLED: "true" });
    const line = formatBoundedRetrievalBootstrapLine(p);
    expect(line).toContain("mode=live");
    expect(line).not.toMatch(/secret|key|token/i);
  });
});
