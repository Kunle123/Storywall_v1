import { describe, expect, it } from "vitest";
import { parseAiRuntimeConfigFromEnv } from "./config";
import { AiCallRateLimiter } from "./policy";
import {
  AiRuntimeBlockedByPolicyError,
  AiRuntimeDisabledError,
  AiRuntimeMisconfiguredError,
  AiRuntimeTransportNotImplementedError,
  createAiTextGenerationPort,
} from "./port";
import type { AiProviderExecutionTelemetry, AiRuntimeTelemetrySink } from "./telemetry";

function memorySink(): { sink: AiRuntimeTelemetrySink; events: AiProviderExecutionTelemetry[] } {
  const events: AiProviderExecutionTelemetry[] = [];
  return {
    sink: {
      kind: "none",
      emit(e: AiProviderExecutionTelemetry) {
        events.push(e);
      },
    },
    events,
  };
}

describe("NonExecutableAiTextGenerationPort", () => {
  it("throws disabled when surface is disabled", async () => {
    const cfg = parseAiRuntimeConfigFromEnv({});
    const { sink, events } = memorySink();
    const port = createAiTextGenerationPort({
      config: cfg,
      limiter: new AiCallRateLimiter(cfg.operational),
      sink,
    });
    await expect(
      port.completeChat({
        messages: [{ role: "user", content: "x" }],
        context: { purpose: "research_synthesis" },
      }),
    ).rejects.toBeInstanceOf(AiRuntimeDisabledError);
    expect(events.some((e) => e.outcome_class === "disabled")).toBe(true);
  });

  it("throws transport not implemented when armed", async () => {
    const cfg = parseAiRuntimeConfigFromEnv({
      STORYWALL_AI_RUNTIME_ENABLED: "true",
      STORYWALL_AI_PROVIDER: "openai_compatible",
      STORYWALL_AI_BASE_URL: "https://example.com/v1",
      STORYWALL_AI_API_KEY: "secret",
    });
    expect(cfg.surface).toBe("armed");
    const { sink, events } = memorySink();
    const port = createAiTextGenerationPort({
      config: cfg,
      limiter: new AiCallRateLimiter(cfg.operational),
      sink,
    });
    await expect(
      port.completeChat({
        messages: [{ role: "user", content: "x" }],
        context: { purpose: "framing_generation", promptVersion: "pv-test" },
      }),
    ).rejects.toBeInstanceOf(AiRuntimeTransportNotImplementedError);
    expect(events.some((e) => e.outcome_class === "transport_unavailable")).toBe(true);
  });

  it("throws misconfigured when enabled with invalid combo", async () => {
    const cfg = parseAiRuntimeConfigFromEnv({
      STORYWALL_AI_RUNTIME_ENABLED: "true",
      STORYWALL_AI_PROVIDER: "none",
    });
    const { sink, events } = memorySink();
    const port = createAiTextGenerationPort({
      config: cfg,
      limiter: new AiCallRateLimiter(cfg.operational),
      sink,
    });
    await expect(
      port.completeChat({
        messages: [{ role: "user", content: "x" }],
        context: { purpose: "scoped_enrichment" },
      }),
    ).rejects.toBeInstanceOf(AiRuntimeMisconfiguredError);
    expect(events.some((e) => e.outcome_class === "misconfigured")).toBe(true);
  });

  it("blocks second call when rate window is saturated", async () => {
    const cfg = parseAiRuntimeConfigFromEnv({
      STORYWALL_AI_RUNTIME_ENABLED: "true",
      STORYWALL_AI_PROVIDER: "openai_compatible",
      STORYWALL_AI_BASE_URL: "https://example.com/v1",
      STORYWALL_AI_API_KEY: "secret",
      STORYWALL_AI_MAX_CALLS_PER_WINDOW: "1",
    });
    const { sink, events } = memorySink();
    const limiter = new AiCallRateLimiter(cfg.operational);
    const port = createAiTextGenerationPort({ config: cfg, limiter, sink });
    const req = {
      messages: [{ role: "user", content: "x" }] as const,
      context: { purpose: "research_synthesis" as const },
    };
    await expect(port.completeChat(req)).rejects.toBeInstanceOf(AiRuntimeTransportNotImplementedError);
    await expect(port.completeChat(req)).rejects.toBeInstanceOf(AiRuntimeBlockedByPolicyError);
    expect(events.filter((e) => e.outcome_class === "blocked_by_policy").length).toBe(1);
  });
});
