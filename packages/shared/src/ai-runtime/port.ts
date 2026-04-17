import type { AiChatMessage, AiInvocationContext } from "./types";
import type { AiRuntimeConfigSnapshot } from "./config";
import type { AiCallRateLimiter } from "./policy";
import { buildTelemetryEvent, type AiRuntimeTelemetrySink } from "./telemetry";

export class AiRuntimeDisabledError extends Error {
  readonly code = "ai_runtime_disabled" as const;
  constructor(message = "AI runtime is disabled (STORYWALL_AI_RUNTIME_ENABLED is not true).") {
    super(message);
    this.name = "AiRuntimeDisabledError";
  }
}

export class AiRuntimeMisconfiguredError extends Error {
  readonly code = "ai_runtime_misconfigured" as const;
  constructor(public readonly reasons: string[]) {
    super(`AI runtime is misconfigured: ${reasons.join(" | ")}`);
    this.name = "AiRuntimeMisconfiguredError";
  }
}

export class AiRuntimeBlockedByPolicyError extends Error {
  readonly code = "ai_runtime_blocked_by_policy" as const;
  constructor(
    message: string,
    public readonly retry_after_ms?: number,
  ) {
    super(message);
    this.name = "AiRuntimeBlockedByPolicyError";
  }
}

/**
 * Thrown when configuration is armed but no HTTP transport exists yet.
 * M5-T03 adds prompt templates; transport remains for a later M5 ticket.
 */
export class AiRuntimeTransportNotImplementedError extends Error {
  readonly code = "ai_runtime_transport_not_implemented" as const;
  constructor() {
    super(
      "AI provider transport is not implemented yet (M5-T01–T03: configuration, policy, telemetry, and prompt templates only).",
    );
    this.name = "AiRuntimeTransportNotImplementedError";
  }
}

export type AiChatCompletionRequest = {
  messages: AiChatMessage[];
  context: AiInvocationContext;
};

export type AiChatCompletionResult = {
  text: string;
  /** Populated once transport exists — M5-T01 returns placeholder only in tests of shape. */
  providerModelLabel?: string;
};

/**
 * Provider-neutral boundary for text generation. Implementations must not imply live AI when disabled.
 */
export interface AiTextGenerationPort {
  /** Stable identifier for logs (`null_port`, later `openai_compatible_http`, …). */
  readonly implementationId: string;

  /** Whether a later ticket may attach transport without config changes. */
  isConfigurationArmed(): boolean;

  completeChat(request: AiChatCompletionRequest): Promise<AiChatCompletionResult>;
}

export type AiTextGenerationPortDependencies = {
  config: AiRuntimeConfigSnapshot;
  limiter: AiCallRateLimiter;
  sink: AiRuntimeTelemetrySink;
};

/**
 * Default port: validates surface, enforces first-pass rate policy, emits telemetry, and refuses execution.
 */
export class NonExecutableAiTextGenerationPort implements AiTextGenerationPort {
  readonly implementationId = "non_executable_m5_t03";

  constructor(private readonly deps: AiTextGenerationPortDependencies) {}

  private get config(): AiRuntimeConfigSnapshot {
    return this.deps.config;
  }

  isConfigurationArmed(): boolean {
    return this.config.surface === "armed";
  }

  async completeChat(request: AiChatCompletionRequest): Promise<AiChatCompletionResult> {
    const { sink, limiter } = this.deps;
    const t0 = Date.now();

    if (this.config.surface === "disabled") {
      sink.emit(
        buildTelemetryEvent({
          surface: this.config.surface,
          provider: this.config.provider,
          context: request.context,
          outcome_class: "disabled",
          latency_ms: Date.now() - t0,
          notes: "runtime_flag_off",
        }),
      );
      throw new AiRuntimeDisabledError();
    }

    if (this.config.surface === "misconfigured") {
      sink.emit(
        buildTelemetryEvent({
          surface: this.config.surface,
          provider: this.config.provider,
          context: request.context,
          outcome_class: "misconfigured",
          latency_ms: Date.now() - t0,
          notes: "configuration_invalid",
        }),
      );
      throw new AiRuntimeMisconfiguredError(this.config.misconfigurationReasons);
    }

    const rate = limiter.tryConsume();
    if (!rate.ok) {
      sink.emit(
        buildTelemetryEvent({
          surface: this.config.surface,
          provider: this.config.provider,
          context: request.context,
          outcome_class: "blocked_by_policy",
          latency_ms: Date.now() - t0,
          failure_category: "policy",
          notes: "rate_limit_window_exhausted",
        }),
      );
      throw new AiRuntimeBlockedByPolicyError(
        "AI call blocked by operational rate policy for this process.",
        rate.retry_after_ms,
      );
    }

    sink.emit(
      buildTelemetryEvent({
        surface: this.config.surface,
        provider: this.config.provider,
        context: request.context,
        outcome_class: "transport_unavailable",
        latency_ms: Date.now() - t0,
        failure_category: "unknown",
        notes: "transport_not_implemented",
      }),
    );

    throw new AiRuntimeTransportNotImplementedError();
  }
}

export function createAiTextGenerationPort(deps: AiTextGenerationPortDependencies): AiTextGenerationPort {
  return new NonExecutableAiTextGenerationPort(deps);
}
