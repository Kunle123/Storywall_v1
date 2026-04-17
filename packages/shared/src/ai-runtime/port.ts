import type { AiChatMessage, AiInvocationContext } from "./types";
import type { AiRuntimeConfigSnapshot } from "./config";

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

/**
 * Thrown when configuration is armed but no HTTP transport exists yet (M5-T01 boundary).
 * Later M5 tickets replace this with real provider errors.
 */
export class AiRuntimeTransportNotImplementedError extends Error {
  readonly code = "ai_runtime_transport_not_implemented" as const;
  constructor() {
    super("AI provider transport is not implemented yet (M5-T01 only defines configuration and abstraction).");
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

/**
 * M5-T01 default port: validates surface and refuses execution so callers cannot accidentally
 * assume a model ran. Later tickets swap this for a real transport while keeping the interface.
 */
export class NonExecutableAiTextGenerationPort implements AiTextGenerationPort {
  readonly implementationId = "non_executable_m5_t01";

  constructor(private readonly config: AiRuntimeConfigSnapshot) {}

  isConfigurationArmed(): boolean {
    return this.config.surface === "armed";
  }

  async completeChat(_request: AiChatCompletionRequest): Promise<AiChatCompletionResult> {
    if (this.config.surface === "disabled") {
      throw new AiRuntimeDisabledError();
    }
    if (this.config.surface === "misconfigured") {
      throw new AiRuntimeMisconfiguredError(this.config.misconfigurationReasons);
    }
    throw new AiRuntimeTransportNotImplementedError();
  }
}

/** Factory for the only port implementation in M5-T01 (non-executable). */
export function createAiTextGenerationPort(config: AiRuntimeConfigSnapshot): AiTextGenerationPort {
  return new NonExecutableAiTextGenerationPort(config);
}
