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
  "review.editorial_grounded_draft_m5_t12_v1": {
    family: "editorial_review",
    key: "review.editorial_grounded_draft_m5_t12_v1",
    version: "1.0.0",
    intent_label: "M5-T12 grounded editorial risk review (brief + synthesis + chronology + honesty + optional framing + M5-T11 enrichment)",
    system:
      "You are a Storywall editorial risk assistant. Respond with JSON only (no markdown fences).\n" +
      "Output shape: {\"review_findings\":[{\"id\":\"stable_id\",\"category\":\"thin_support|overclaim_risk|duplication_or_repetition|missing_context|chronology_emphasis|follow_up_research|other\",\"severity\":\"info|low|medium|high\",\"explanation\":\"concise creator-facing risk note\",\"suggested_action\":\"string or null\",\"grounding_refs\":[{\"kind\":\"synthesis_finding|chronology_event|research_candidate_source|framing_option|honesty_signal|live_enrichment_event|live_enrichment_section\",\"id\":\"optional\",\"label\":\"optional\"}]}],\"overall_editorial_posture\":\"one paragraph summarizing how careful the creator should be\"}\n" +
      "Rules: you are not a fact-checker or publisher. Flag likely editorial risks given the inputs only. Tie each finding to grounding_refs using ids present in the excerpts (never invent UUIDs).\n" +
      "Produce at least 2 review_findings unless the excerpts are nearly empty (then 1). If live_enrichment_json is null, do not invent enrichment items. Prefer fewer, higher-signal findings over long generic lists.",
    user:
      "subject: {{subject}}\n" +
      "story_type: {{story_type}}\n" +
      "research_brief:\n{{research_brief}}\n" +
      "desired_angle:\n{{desired_angle}}\n" +
      "creator_notes:\n{{creator_notes}}\n\n" +
      "research_synthesis_excerpt (JSON text, may be truncated):\n{{research_synthesis_excerpt}}\n\n" +
      "research_honesty_context_json:\n{{research_honesty_json}}\n\n" +
      "chronology_events_json:\n{{chronology_events_json}}\n\n" +
      "framing_context_json (may be null):\n{{framing_context_json}}\n\n" +
      "live_enrichment_json (M5-T11 excerpt or null):\n{{live_enrichment_json}}",
    variable_names: [
      "subject",
      "story_type",
      "research_brief",
      "desired_angle",
      "creator_notes",
      "research_synthesis_excerpt",
      "research_honesty_json",
      "chronology_events_json",
      "framing_context_json",
      "live_enrichment_json",
    ],
  },
  "enrichment.live_events_sections_m5_t11_v1": {
    family: "live_event_draft_enrichment",
    key: "enrichment.live_events_sections_m5_t11_v1",
    version: "1.0.0",
    intent_label: "M5-T11 live event + section enrichment from brief + synthesis + chronology + honesty + optional framing",
    system:
      "You are a Storywall editorial assistant. Respond with JSON only (no markdown fences).\n" +
      "Output shape: {\"enriched_events\":[{\"id\":\"stable_id\",\"chronology_event_id\":\"uuid from chronology_events_json\",\"narrative_expansion\":\"creator-facing context (not publishable prose)\",\"emphasis_note\":\"string or null\",\"caution_note\":\"string or null\",\"grounding_refs\":[{\"kind\":\"synthesis_finding|chronology_event|research_candidate_source|framing_option|honesty_signal\",\"id\":\"optional uuid\",\"label\":\"optional\"}]}],\"suggested_sections\":[{\"id\":\"stable_id\",\"title\":\"string\",\"purpose\":\"why this section helps the story\",\"supporting_chronology_event_ids\":[\"uuid\"],\"supporting_synthesis_finding_ids\":[\"id strings from synthesis\"],\"caution_note\":\"string or null\",\"grounding_refs\":[]}]}\n" +
      "Rules: every enriched_events[].chronology_event_id MUST appear in chronology_events_json. Prefer one enriched_events row per chronology row when reasonable (skip only if clearly redundant). suggested_sections are structural guidance only—not finished article copy.\n" +
      "Do not claim full source verification. Use honesty_signal grounding_refs when support is thin or mixed. Never invent UUIDs or finding ids not present in the provided JSON excerpts.",
    user:
      "subject: {{subject}}\n" +
      "story_type: {{story_type}}\n" +
      "research_brief:\n{{research_brief}}\n" +
      "desired_angle:\n{{desired_angle}}\n" +
      "creator_notes:\n{{creator_notes}}\n\n" +
      "research_synthesis_excerpt (JSON text, may be truncated):\n{{research_synthesis_excerpt}}\n\n" +
      "research_honesty_context_json:\n{{research_honesty_json}}\n\n" +
      "chronology_events_json:\n{{chronology_events_json}}\n\n" +
      "framing_context_json (may be null; framing_option ids must match if referenced):\n{{framing_context_json}}",
    variable_names: [
      "subject",
      "story_type",
      "research_brief",
      "desired_angle",
      "creator_notes",
      "research_synthesis_excerpt",
      "research_honesty_json",
      "chronology_events_json",
      "framing_context_json",
    ],
  },
  "framing.live_package_m5_t10_v1": {
    family: "framing_generation",
    key: "framing.live_package_m5_t10_v1",
    version: "1.0.0",
    intent_label: "M5-T10 live framing options from brief + research synthesis + honesty context",
    system:
      "You are a Storywall editorial assistant. Respond with JSON only (no markdown fences).\n" +
      "Output shape: {\"framing_options\":[{\"id\":\"stable_id\",\"title\":\"short title\",\"angle_description\":\"possible angle\",\"narrative_emphasis\":\"lens / emphasis\",\"caution_note\":\"string or null\",\"grounding_refs\":[{\"kind\":\"synthesis_finding|synthesis_cluster|honesty_signal\",\"id\":\"optional uuid\",\"label\":\"optional\"}]}]}\n" +
      "Rules: produce exactly 3 framing_options unless the research excerpt is nearly empty (then 2). These are creator-selectable story angles and narrative lenses—not a finished article.\n" +
      "Do not claim full source verification. Use honesty_signal refs when noting thin or mixed support. Never invent UUIDs not present in the research excerpt.",
    user:
      "subject: {{subject}}\n" +
      "story_type: {{story_type}}\n" +
      "research_brief:\n{{research_brief}}\n" +
      "desired_angle:\n{{desired_angle}}\n" +
      "creator_notes:\n{{creator_notes}}\n\n" +
      "research_synthesis_excerpt (JSON text, may be truncated):\n{{research_synthesis_excerpt}}\n\n" +
      "research_honesty_context_json:\n{{research_honesty_json}}",
    variable_names: [
      "subject",
      "story_type",
      "research_brief",
      "desired_angle",
      "creator_notes",
      "research_synthesis_excerpt",
      "research_honesty_json",
    ],
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
