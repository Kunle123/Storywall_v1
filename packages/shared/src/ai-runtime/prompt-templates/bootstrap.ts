import {
  STORYWALL_CANONICAL_PROMPT_TEMPLATE_REGISTRY,
  ensureCanonicalPromptTemplateRegistryValidated,
} from "./registry";

const PROMPT_REGISTRY_SCHEMA_ID = "m5_t03_v1" as const;

export type StorywallPromptRegistrySchemaId = typeof PROMPT_REGISTRY_SCHEMA_ID;

/** Single-line bootstrap log for API/worker (no secrets, no variable values). */
export function formatPromptTemplateRegistryBootstrapLine(): string {
  ensureCanonicalPromptTemplateRegistryValidated();
  const n = Object.keys(STORYWALL_CANONICAL_PROMPT_TEMPLATE_REGISTRY).length;
  return `[ai-prompt-templates] schema=${PROMPT_REGISTRY_SCHEMA_ID} registered=${n}`;
}

export function getPromptTemplateRegistrySchemaId(): StorywallPromptRegistrySchemaId {
  return PROMPT_REGISTRY_SCHEMA_ID;
}
