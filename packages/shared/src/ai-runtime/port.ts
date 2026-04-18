import type { AiChatMessage, AiInvocationContext } from "./types";
import type { AiRuntimeConfigSnapshot } from "./config";
import type { AiCallRateLimiter } from "./policy";
import { buildTelemetryEvent, type AiRuntimeTelemetrySink } from "./telemetry";
import {
  AiRuntimeBlockedByPolicyError,
  AiRuntimeDisabledError,
  AiRuntimeMisconfiguredError,
  AiRuntimeTransportNotImplementedError,
} from "./execution-errors";

export {
  AiRuntimeBlockedByPolicyError,
  AiRuntimeDisabledError,
  AiRuntimeMisconfiguredError,
  AiRuntimeTransportNotImplementedError,
} from "./execution-errors";

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
  /** When set with armed `openai_compatible` config, M5-T10 enables live HTTP chat completions. */
  openAiApiKey?: string | null;
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

function chatCompletionsUrl(baseUrl: string): string {
  const b = baseUrl.replace(/\/$/, "");
  if (b.endsWith("/v1")) return `${b}/chat/completions`;
  return `${b}/v1/chat/completions`;
}

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

/**
 * OpenAI-compatible HTTP transport (Chat Completions). M5-T10 — first executable path.
 */
export class OpenAiCompatibleHttpTextGenerationPort implements AiTextGenerationPort {
  readonly implementationId = "openai_compatible_http_v1";

  constructor(
    private readonly deps: AiTextGenerationPortDependencies,
    private readonly apiKey: string,
  ) {}

  isConfigurationArmed(): boolean {
    return this.deps.config.surface === "armed" && Boolean(this.deps.config.baseUrl);
  }

  async completeChat(request: AiChatCompletionRequest): Promise<AiChatCompletionResult> {
    const { sink, limiter, config } = this.deps;
    const t0 = Date.now();
    const rate = limiter.tryConsume();
    if (!rate.ok) {
      sink.emit(
        buildTelemetryEvent({
          surface: config.surface,
          provider: config.provider,
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

    const baseUrl = config.baseUrl;
    if (!baseUrl) {
      throw new Error("OpenAiCompatibleHttpTextGenerationPort: baseUrl missing");
    }

    const model = config.defaultModel?.trim() || "gpt-4o-mini";
    const maxRetries = config.operational.maxRetries;
    const timeoutMs = config.operational.timeoutMs;

    let lastErr: string | undefined;
    let attempts = 0;
    const maxAttempts = 1 + maxRetries;

    while (attempts < maxAttempts) {
      attempts += 1;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(chatCompletionsUrl(baseUrl), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: request.messages,
            temperature: 0.35,
            response_format: { type: "json_object" },
          }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);

        const json = (await res.json()) as OpenAiChatResponse;
        if (!res.ok) {
          lastErr = json.error?.message ?? `http_${res.status}`;
          const retryable = res.status >= 500 || res.status === 429;
          if (retryable && attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 400 * attempts));
            continue;
          }
          sink.emit(
            buildTelemetryEvent({
              surface: config.surface,
              provider: config.provider,
              context: request.context,
              outcome_class: "failed",
              latency_ms: Date.now() - t0,
              retry_count: attempts - 1,
              failure_category: "provider",
              notes: `openai_http_status_${res.status}`,
            }),
          );
          throw new Error(`OpenAI-compatible chat failed: ${lastErr}`);
        }

        const text = json.choices?.[0]?.message?.content?.trim() ?? "";
        if (!text) {
          lastErr = "empty_model_content";
          if (attempts < maxAttempts) continue;
          sink.emit(
            buildTelemetryEvent({
              surface: config.surface,
              provider: config.provider,
              context: request.context,
              outcome_class: "failed",
              latency_ms: Date.now() - t0,
              failure_category: "provider",
              notes: "empty_model_content",
            }),
          );
          throw new Error("OpenAI-compatible chat returned empty content");
        }

        sink.emit(
          buildTelemetryEvent({
            surface: config.surface,
            provider: config.provider,
            context: request.context,
            outcome_class: "succeeded",
            latency_ms: Date.now() - t0,
            retry_count: attempts - 1,
            notes: `openai_ok model=${model}`,
          }),
        );
        return { text, providerModelLabel: model };
      } catch (e) {
        clearTimeout(timer);
        const aborted = e instanceof Error && e.name === "AbortError";
        lastErr = aborted ? "timeout" : e instanceof Error ? e.message : String(e);
        const retryable = aborted || (e instanceof TypeError && String(e.message).includes("fetch"));
        if (retryable && attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 500 * attempts));
          continue;
        }
        sink.emit(
          buildTelemetryEvent({
            surface: config.surface,
            provider: config.provider,
            context: request.context,
            outcome_class: aborted ? "timeout" : "failed",
            latency_ms: Date.now() - t0,
            retry_count: attempts - 1,
            failure_category: aborted ? "timeout" : "network",
            notes: lastErr?.slice(0, 200),
          }),
        );
        throw e;
      }
    }

    sink.emit(
      buildTelemetryEvent({
        surface: config.surface,
        provider: config.provider,
        context: request.context,
        outcome_class: "failed",
        latency_ms: Date.now() - t0,
        failure_category: "unknown",
        notes: lastErr?.slice(0, 200),
      }),
    );
    throw new Error(`OpenAI-compatible chat exhausted retries: ${lastErr ?? "unknown"}`);
  }
}

export function createAiTextGenerationPort(deps: AiTextGenerationPortDependencies): AiTextGenerationPort {
  const { config, openAiApiKey } = deps;
  const key = openAiApiKey?.trim();
  if (
    config.surface === "armed" &&
    config.provider === "openai_compatible" &&
    config.baseUrl &&
    key &&
    key.length > 0
  ) {
    return new OpenAiCompatibleHttpTextGenerationPort(deps, key);
  }
  return new NonExecutableAiTextGenerationPort(deps);
}
