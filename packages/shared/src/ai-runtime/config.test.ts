import { describe, expect, it } from "vitest";
import { parseAiRuntimeConfigFromEnv } from "./config";

describe("parseAiRuntimeConfigFromEnv", () => {
  it("defaults to disabled when flag absent", () => {
    const c = parseAiRuntimeConfigFromEnv({});
    expect(c.surface).toBe("disabled");
    expect(c.enabled).toBe(false);
    expect(c.provider).toBe("none");
  });

  it("flags misconfiguration when enabled with none provider", () => {
    const c = parseAiRuntimeConfigFromEnv({
      STORYWALL_AI_RUNTIME_ENABLED: "true",
      STORYWALL_AI_PROVIDER: "none",
    });
    expect(c.surface).toBe("misconfigured");
    expect(c.misconfigurationReasons.length).toBeGreaterThan(0);
  });

  it("flags misconfiguration when openai_compatible missing base URL", () => {
    const c = parseAiRuntimeConfigFromEnv({
      STORYWALL_AI_RUNTIME_ENABLED: "true",
      STORYWALL_AI_PROVIDER: "openai_compatible",
      STORYWALL_AI_API_KEY: "x",
    });
    expect(c.surface).toBe("misconfigured");
    expect(c.misconfigurationReasons.some((r) => r.includes("BASE_URL"))).toBe(true);
  });

  it("arms when openai_compatible has base URL and API key", () => {
    const c = parseAiRuntimeConfigFromEnv({
      STORYWALL_AI_RUNTIME_ENABLED: "true",
      STORYWALL_AI_PROVIDER: "openai_compatible",
      STORYWALL_AI_BASE_URL: "https://api.openai.com/v1",
      STORYWALL_AI_API_KEY: "sk-test-not-real",
      STORYWALL_AI_DEFAULT_MODEL: "gpt-4o-mini",
    });
    expect(c.surface).toBe("armed");
    expect(c.apiKeyPresent).toBe(true);
    expect(c.baseUrl).toContain("openai");
  });
});
