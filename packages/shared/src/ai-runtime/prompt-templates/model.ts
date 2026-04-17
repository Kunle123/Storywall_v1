import type { AiChatMessage, AiRuntimePurpose } from "../types";

/** Alias for prompt definitions — same literals as `AiRuntimePurpose`. */
export type StorywallPromptTemplateFamily = AiRuntimePurpose;

/** Canonical in-repo prompt definition (M5-T03). Transport does not consume this directly yet. */
export type CanonicalPromptTemplateDefinition = {
  readonly family: StorywallPromptTemplateFamily;
  /** Stable dotted key, e.g. `research.retrieval.bounded_query`. */
  readonly key: string;
  /** Content / contract version (semver string). */
  readonly version: string;
  /** Short operator-facing label (not end-user marketing). */
  readonly intent_label: string;
  readonly system?: string;
  readonly user: string;
  /** Declared variables; must match `{{name}}` placeholders exactly. */
  readonly variable_names: readonly string[];
};

/** Metadata safe to attach to telemetry / persistence (no raw user text beyond what caller already chose to pass elsewhere). */
export type AiPromptExecutionAuditMetadata = {
  readonly family: StorywallPromptTemplateFamily;
  readonly prompt_key: string;
  readonly prompt_version: string;
  /** Variable names that were bound, sorted lexicographically (no values). */
  readonly variables_bound_sorted: readonly string[];
  /**
   * SHA-256 (hex) of JSON `[["name", utf8ByteLength], ...]` sorted by name.
   * Detects binding shape changes without storing secret or PII payloads in audit fields.
   */
  readonly variable_shape_fingerprint_sha256: string;
};

export type AiPromptTemplateRenderResult = {
  readonly messages: AiChatMessage[];
  readonly audit: AiPromptExecutionAuditMetadata;
};
