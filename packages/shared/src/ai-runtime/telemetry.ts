import { randomUUID } from "node:crypto";
import type { AiInvocationContext, AiProviderKind, AiRuntimeSurface } from "./types";

/**
 * Final or terminal classification for a provider interaction.
 * Keep values explicit for dashboards and later transport mapping.
 */
export type AiProviderOutcomeClass =
  | "attempted"
  | "blocked_by_policy"
  | "disabled"
  | "misconfigured"
  | "transport_unavailable"
  | "succeeded"
  | "failed"
  | "timeout";

export type AiProviderFailureCategory = "network" | "provider" | "policy" | "timeout" | "unknown";

/**
 * Execution telemetry for a single logical provider attempt.
 * **Never** place API keys, raw prompts, or end-user message bodies on this object.
 */
export type AiProviderExecutionTelemetry = {
  event_id: string;
  /** ISO-8601 timestamp when the event was recorded. */
  recorded_at: string;
  surface: AiRuntimeSurface;
  provider: AiProviderKind;
  purpose: AiInvocationContext["purpose"];
  story_id?: string;
  prompt_version?: string;
  provider_model_label?: string;
  outcome_class: AiProviderOutcomeClass;
  latency_ms?: number;
  retry_count?: number;
  failure_category?: AiProviderFailureCategory;
  /** Short, operator-safe diagnostic (no secrets). */
  notes?: string;
};

export type AiRuntimeTelemetrySinkKind = "none" | "console";

export interface AiRuntimeTelemetrySink {
  readonly kind: AiRuntimeTelemetrySinkKind;
  emit(event: AiProviderExecutionTelemetry): void;
}

export class NoOpAiRuntimeTelemetrySink implements AiRuntimeTelemetrySink {
  readonly kind = "none" as const;
  emit(_event: AiProviderExecutionTelemetry): void {}
}

/** JSON one-liner to stdout — safe fields only; never logs request bodies. */
export class ConsoleAiRuntimeTelemetrySink implements AiRuntimeTelemetrySink {
  readonly kind = "console" as const;
  emit(event: AiProviderExecutionTelemetry): void {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        kind: "ai_provider_execution",
        ...event,
      }),
    );
  }
}

export function createTelemetrySinkFromEnv(env: Record<string, string | undefined>): AiRuntimeTelemetrySink {
  const raw = (env.STORYWALL_AI_TELEMETRY_SINK ?? "none").trim().toLowerCase();
  if (raw === "console") {
    return new ConsoleAiRuntimeTelemetrySink();
  }
  return new NoOpAiRuntimeTelemetrySink();
}

export function buildTelemetryEvent(params: {
  surface: AiRuntimeSurface;
  provider: AiProviderKind;
  context: AiInvocationContext;
  outcome_class: AiProviderOutcomeClass;
  latency_ms?: number;
  retry_count?: number;
  failure_category?: AiProviderFailureCategory;
  notes?: string;
}): AiProviderExecutionTelemetry {
  return {
    event_id: randomUUID(),
    recorded_at: new Date().toISOString(),
    surface: params.surface,
    provider: params.provider,
    purpose: params.context.purpose,
    story_id: params.context.storyId,
    prompt_version: params.context.promptVersion,
    provider_model_label: params.context.providerModelLabel,
    outcome_class: params.outcome_class,
    latency_ms: params.latency_ms,
    retry_count: params.retry_count,
    failure_category: params.failure_category,
    notes: params.notes,
  };
}
