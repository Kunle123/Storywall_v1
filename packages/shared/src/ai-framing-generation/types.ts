/**
 * M5-T10 — persisted + API contract for AI-backed framing generation (not publishable narrative).
 */

export const AI_FRAMING_GENERATION_SCHEMA_VERSION = "m5-t10-v1" as const;

export type AiFramingGenerationMode = "live_ai_backed" | "deterministic_scaffolding_fallback";

export type AiFramingGenerationStatus = "succeeded" | "failed" | "fallback_deterministic";

export type AiFramingGroundingRefKind = "synthesis_finding" | "synthesis_cluster" | "honesty_signal";

export type AiFramingOptionGroundingRef = {
  kind: AiFramingGroundingRefKind;
  id?: string;
  label?: string;
};

export type AiFramingGenerationOption = {
  id: string;
  title: string;
  angle_description: string;
  narrative_emphasis: string;
  caution_note: string | null;
  grounding_refs: readonly AiFramingOptionGroundingRef[];
};

export type AiFramingGenerationFailure = {
  code: string;
  message: string;
};

/**
 * Stored on `story_brief.ai_framing_generation_package` and returned from `POST …/frames/generate`.
 */
export type AiFramingGenerationPackageV1 = {
  schema_version: typeof AI_FRAMING_GENERATION_SCHEMA_VERSION;
  generation_mode: AiFramingGenerationMode;
  status: AiFramingGenerationStatus;
  prompt_template_key: string;
  prompt_version: string;
  provider: string;
  model: string | null;
  story_id: string;
  research_job_id: string | null;
  /** Fixed honesty line — model framing is guidance, not verified publishable copy. */
  not_publishable_framing_note: string;
  framing_options: readonly AiFramingGenerationOption[];
  failure: AiFramingGenerationFailure | null;
  /** Snapshot of M5-T09 honesty summary JSON when available (null if no research package). */
  honesty_context: unknown | null;
  generated_at: string;
};
