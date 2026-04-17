/**
 * M5-T01 — shared types for AI runtime configuration and provider abstraction.
 * Transport and live calls are deferred to later M5 tickets; this layer stays honest.
 */

/** Declared provider wiring; `none` keeps runtime off without vendor lock-in. */
export type AiProviderKind = "none" | "openai_compatible";

/**
 * - `disabled` — STORYWALL_AI_RUNTIME_ENABLED is not true; safe default.
 * - `misconfigured` — enabled flag asks for runtime but required env is missing/invalid.
 * - `armed` — env satisfies declared provider checklist; transport still not implemented (M5-T01).
 */
export type AiRuntimeSurface = "disabled" | "misconfigured" | "armed";

/** Domain use-cases later tickets will attach metadata for (audit / prompts). */
export type AiRuntimePurpose =
  | "research_synthesis"
  | "framing_generation"
  | "scoped_enrichment"
  | "validation_explainer";

export type AiChatRole = "system" | "user" | "assistant";

export type AiChatMessage = {
  role: AiChatRole;
  content: string;
};

/** Caller-supplied audit fields (optional until prompt packs land). */
export type AiInvocationContext = {
  purpose: AiRuntimePurpose;
  storyId?: string;
  promptVersion?: string;
  providerModelLabel?: string;
};
