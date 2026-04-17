import { describe, expect, it } from "vitest";
import { parseAiRuntimeConfigFromEnv } from "./config";
import {
  AiRuntimeDisabledError,
  AiRuntimeMisconfiguredError,
  AiRuntimeTransportNotImplementedError,
  createAiTextGenerationPort,
} from "./port";

describe("NonExecutableAiTextGenerationPort", () => {
  it("throws disabled when surface is disabled", async () => {
    const cfg = parseAiRuntimeConfigFromEnv({});
    const port = createAiTextGenerationPort(cfg);
    await expect(
      port.completeChat({
        messages: [{ role: "user", content: "x" }],
        context: { purpose: "research_synthesis" },
      }),
    ).rejects.toBeInstanceOf(AiRuntimeDisabledError);
  });

  it("throws transport not implemented when armed", async () => {
    const cfg = parseAiRuntimeConfigFromEnv({
      STORYWALL_AI_RUNTIME_ENABLED: "true",
      STORYWALL_AI_PROVIDER: "openai_compatible",
      STORYWALL_AI_BASE_URL: "https://example.com/v1",
      STORYWALL_AI_API_KEY: "secret",
    });
    expect(cfg.surface).toBe("armed");
    const port = createAiTextGenerationPort(cfg);
    await expect(
      port.completeChat({
        messages: [{ role: "user", content: "x" }],
        context: { purpose: "framing_generation", promptVersion: "pv-test" },
      }),
    ).rejects.toBeInstanceOf(AiRuntimeTransportNotImplementedError);
  });

  it("throws misconfigured when enabled with invalid combo", async () => {
    const cfg = parseAiRuntimeConfigFromEnv({
      STORYWALL_AI_RUNTIME_ENABLED: "true",
      STORYWALL_AI_PROVIDER: "none",
    });
    const port = createAiTextGenerationPort(cfg);
    await expect(
      port.completeChat({
        messages: [{ role: "user", content: "x" }],
        context: { purpose: "scoped_enrichment" },
      }),
    ).rejects.toBeInstanceOf(AiRuntimeMisconfiguredError);
  });
});
