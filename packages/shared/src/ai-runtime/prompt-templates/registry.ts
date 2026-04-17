import type { CanonicalPromptTemplateDefinition } from "./model";
import { PromptTemplateRenderError } from "./errors";
import { assertPlaceholderContractMatchesDefinition } from "./placeholders";

/**
 * Small seed registry — later tickets add versions or DB-backed resolution without changing audit types.
 */
export const STORYWALL_CANONICAL_PROMPT_TEMPLATE_REGISTRY = {
  "research.retrieval.bounded_query": {
    family: "research_retrieval",
    key: "research.retrieval.bounded_query",
    version: "1.0.0",
    intent_label: "Bounded retrieval problem statement",
    system: "You assist with research planning. Use only the provided variables.",
    user: "Story title: {{story_title}}\nSeed query: {{query_seed}}\nSummarize the retrieval objective in one short paragraph.",
    variable_names: ["story_title", "query_seed"],
  },
  "research.synthesis.package_stub": {
    family: "research_synthesis",
    key: "research.synthesis.package_stub",
    version: "1.0.0",
    intent_label: "Post-retrieval package scaffolding text",
    user: "Candidate source rows: {{candidate_row_count}}\nDescribe the next synthesis step without fabricating URLs.",
    variable_names: ["candidate_row_count"],
  },
  "framing.candidate_axes_stub": {
    family: "framing_generation",
    key: "framing.candidate_axes_stub",
    version: "1.0.0",
    intent_label: "Framing axes skeleton from brief excerpt",
    user: "Brief excerpt:\n{{brief_excerpt}}\nList tentative framing axes (outline only).",
    variable_names: ["brief_excerpt"],
  },
  "scoped_enrichment.field_stub": {
    family: "scoped_enrichment",
    key: "scoped_enrichment.field_stub",
    version: "1.0.0",
    intent_label: "Scoped field enrichment brief",
    system: "Editorial assistant for Storywall scoped edits.",
    user: "Target: {{target_label}}\nField: {{field_name}}\nDraft assistant notes (no claims of live web access).",
    variable_names: ["target_label", "field_name"],
  },
  "validation.issue_explainer_stub": {
    family: "validation_explainer",
    key: "validation.issue_explainer_stub",
    version: "1.0.0",
    intent_label: "Validation issue human explainer scaffold",
    user: "Validation issue code: {{issue_code}}\nSummarize what the creator should check next (non-authoritative).",
    variable_names: ["issue_code"],
  },
} as const satisfies Record<string, CanonicalPromptTemplateDefinition>;

export type StorywallCanonicalPromptTemplateKey = keyof typeof STORYWALL_CANONICAL_PROMPT_TEMPLATE_REGISTRY;

export type RegisteredPromptTemplateRef = {
  readonly key: string;
  readonly version: string;
};

let validated = false;

export function ensureCanonicalPromptTemplateRegistryValidated(): void {
  if (validated) {
    return;
  }
  for (const def of Object.values(STORYWALL_CANONICAL_PROMPT_TEMPLATE_REGISTRY)) {
    assertPlaceholderContractMatchesDefinition(def);
  }
  validated = true;
}

export function listRegisteredPromptTemplateRefs(): RegisteredPromptTemplateRef[] {
  ensureCanonicalPromptTemplateRegistryValidated();
  return Object.values(STORYWALL_CANONICAL_PROMPT_TEMPLATE_REGISTRY).map((d) => ({
    key: d.key,
    version: d.version,
  }));
}

export function getCanonicalPromptTemplate(ref: {
  key: string;
  version?: string;
}): CanonicalPromptTemplateDefinition {
  ensureCanonicalPromptTemplateRegistryValidated();
  const def =
    STORYWALL_CANONICAL_PROMPT_TEMPLATE_REGISTRY[ref.key as StorywallCanonicalPromptTemplateKey];
  if (!def) {
    throw new PromptTemplateRenderError(
      "unknown_template",
      `Unknown prompt template key: ${ref.key}`,
      { key: ref.key },
    );
  }
  if (ref.version && ref.version !== def.version) {
    throw new PromptTemplateRenderError(
      "version_mismatch",
      `Prompt template version mismatch for ${ref.key}`,
      { key: ref.key, requested: ref.version, available: def.version },
    );
  }
  return def;
}
