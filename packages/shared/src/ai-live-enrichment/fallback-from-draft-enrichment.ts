import type { DraftEnrichmentPackageV1 } from "../draft-enrichment/types";
import { DRAFT_ENRICHMENT_SCHEMA_VERSION } from "../draft-enrichment/types";
import type {
  LiveEnrichmentEnrichedEvent,
  LiveEnrichmentSuggestedSection,
  LiveEventDraftEnrichmentPackageV1,
} from "./types";
import { LIVE_EVENT_DRAFT_ENRICHMENT_SCHEMA_VERSION } from "./types";

const NOTE =
  "Deterministic Storywall draft enrichment (M5-T07/M5-T08) mapped into this audit envelope because live AI enrichment did not complete. Not publishable narrative.";

/**
 * When live LLM output is unavailable, map persisted deterministic `draft_enrichment_package` (m5-t08-v1) into M5-T11 shape.
 */
export function buildFallbackLiveEnrichmentFromDraftPackage(params: {
  storyId: string;
  researchJobId: string;
  draftEnrichmentPackage: unknown;
  honestyContext: unknown | null;
  framingReference: LiveEventDraftEnrichmentPackageV1["framing_reference"];
  provider: string;
  promptTemplateKey: string;
  promptVersion: string;
}): LiveEventDraftEnrichmentPackageV1 | null {
  const raw = params.draftEnrichmentPackage;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Partial<DraftEnrichmentPackageV1>;
  if (p.schema_version !== DRAFT_ENRICHMENT_SCHEMA_VERSION) return null;

  const pkg = raw as DraftEnrichmentPackageV1;

  const enriched_events: LiveEnrichmentEnrichedEvent[] = pkg.key_events.slice(0, 48).map((k, i) => ({
    id: `det_ev:${k.chronology_event_id}:${i}`,
    chronology_event_id: k.chronology_event_id,
    narrative_expansion: [k.headline, k.summary_clip].filter(Boolean).join(" — ").slice(0, 8000),
    emphasis_note: k.claim_risk_level ? `claim_risk: ${k.claim_risk_level}` : null,
    caution_note: k.ambiguity_carryforward ?? k.weak_support_explanation ?? null,
    grounding_refs: [
      ...k.provenance.synthesis_finding_ids.map((id) => ({ kind: "synthesis_finding" as const, id })),
      ...k.provenance.chronology_event_ids.map((id) => ({ kind: "chronology_event" as const, id })),
      ...k.provenance.research_candidate_source_ids.map((id) => ({
        kind: "research_candidate_source" as const,
        id,
      })),
    ],
  }));

  const suggested_sections: LiveEnrichmentSuggestedSection[] = pkg.suggested_sections.slice(0, 24).map((s, i) => ({
    id: `det_sec:${s.id}:${i}`,
    title: s.title,
    purpose: s.rationale.slice(0, 8000),
    supporting_chronology_event_ids: [],
    supporting_synthesis_finding_ids: [...s.linked_synthesis_finding_ids],
    caution_note: s.weak_support_explanation,
    grounding_refs: [
      ...s.provenance.synthesis_finding_ids.map((id) => ({ kind: "synthesis_finding" as const, id })),
      ...s.provenance.chronology_event_ids.map((id) => ({ kind: "chronology_event" as const, id })),
    ],
  }));

  return {
    schema_version: LIVE_EVENT_DRAFT_ENRICHMENT_SCHEMA_VERSION,
    generation_mode: "deterministic_scaffolding_fallback",
    status: "fallback_deterministic",
    prompt_template_key: params.promptTemplateKey,
    prompt_version: params.promptVersion,
    provider: params.provider,
    model: null,
    story_id: params.storyId,
    research_job_id: params.researchJobId,
    framing_reference: params.framingReference,
    honesty_context: params.honestyContext,
    enriched_events,
    suggested_sections,
    not_publishable_enrichment_note: NOTE,
    failure: {
      code: "live_enrichment_used_deterministic_draft_mapping",
      message: "Live model path did not produce validated output; mapped deterministic draft_enrichment_package instead.",
    },
    generated_at: new Date().toISOString(),
  };
}
