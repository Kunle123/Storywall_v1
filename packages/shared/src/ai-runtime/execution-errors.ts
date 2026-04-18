/** Shared errors for AI text generation (used by port + OpenAI HTTP transport). */

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

export class AiRuntimeTransportNotImplementedError extends Error {
  readonly code = "ai_runtime_transport_not_implemented" as const;
  constructor() {
    super(
      "AI provider transport is not implemented yet (M5-T01–T03: configuration, policy, telemetry, and prompt templates only).",
    );
    this.name = "AiRuntimeTransportNotImplementedError";
  }
}
