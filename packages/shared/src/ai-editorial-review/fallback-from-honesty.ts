import type { DraftEnrichmentCoverageGapNode, DraftEnrichmentPackageV1 } from "../draft-enrichment/types";
import { DRAFT_ENRICHMENT_SCHEMA_VERSION } from "../draft-enrichment/types";
import { RESEARCH_PACKAGE_HONESTY_SUMMARY_VERSION, type ResearchPackageHonestySummary } from "../draft-enrichment/honesty-summary";
import type { AiEditorialReviewPackageV1, EditorialReviewFinding } from "./types";
import { AI_EDITORIAL_REVIEW_SCHEMA_VERSION } from "./types";

const NOTE =
  "Deterministic editorial signals derived from Storywall honesty summary and coverage gaps (M5-T09 / M5-T08). Not a live model review and not authoritative — use alongside sourcing.";

function isHonestySummary(v: unknown): v is ResearchPackageHonestySummary {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    (v as { schema_version?: string }).schema_version === RESEARCH_PACKAGE_HONESTY_SUMMARY_VERSION
  );
}

function findingsFromHonesty(h: ResearchPackageHonestySummary): EditorialReviewFinding[] {
  const out: EditorialReviewFinding[] = [];
  const rollup = h.support_status_rollup;
  let idx = 0;
  if (rollup.total_nodes > 0 && (rollup.chronology_thin_sources > 0 || rollup.unresolved_weak > 0)) {
    out.push({
      id: `det:rollup:${idx++}`,
      category: "thin_support",
      severity: rollup.unresolved_weak > 0 ? "high" : "medium",
      explanation: `Provenance rollup: ${rollup.chronology_thin_sources} chronology-thin node(s), ${rollup.unresolved_weak} unresolved/weak node(s) of ${rollup.total_nodes} total. Treat narrative beats in those areas as higher-risk until corroborated.`,
      suggested_action: "Add corroborating sources or narrow claims where support is thin.",
      grounding_refs: [{ kind: "honesty_signal", label: "support_status_rollup" }],
    });
  }
  if (h.synthesis_retrieval_partial === true) {
    out.push({
      id: `det:partial:${idx++}`,
      category: "follow_up_research",
      severity: "medium",
      explanation: "Synthesis retrieval was partial — some candidate material may be missing from the research package.",
      suggested_action: "Consider re-running research with retrieval enabled or adding manual sources.",
      grounding_refs: [{ kind: "honesty_signal", label: "synthesis_retrieval_partial" }],
    });
  }
  const hints = h.ui_hints.slice(0, 12);
  for (let i = 0; i < hints.length; i += 1) {
    const text = hints[i].trim();
    if (!text) continue;
    out.push({
      id: `det:hint:${i}`,
      category: "other",
      severity: "low",
      explanation: text.slice(0, 2000),
      suggested_action: "Cross-check this signal against synthesis findings and chronology before drafting.",
      grounding_refs: [{ kind: "honesty_signal", label: `ui_hint:${i}` }],
    });
  }
  return out;
}

function findingsFromCoverageGaps(gaps: readonly DraftEnrichmentCoverageGapNode[]): EditorialReviewFinding[] {
  return gaps.slice(0, 8).map((g, i) => ({
    id: `det:gap:${g.id}:${i}`,
    category: "follow_up_research" as const,
    severity: "medium" as const,
    explanation: g.text.slice(0, 2000),
    suggested_action: "Address this coverage gap with additional reporting or tighter scope.",
    grounding_refs: [
      ...g.provenance.synthesis_finding_ids.map((id) => ({ kind: "synthesis_finding" as const, id })),
      ...g.provenance.chronology_event_ids.map((id) => ({ kind: "chronology_event" as const, id })),
    ],
  }));
}

/**
 * When live LLM review fails, surface deterministic honesty + known coverage gaps as review-shaped findings.
 */
export function buildFallbackEditorialReviewFromHonesty(params: {
  storyId: string;
  researchJobId: string;
  honestyContext: unknown;
  draftEnrichmentPackage: unknown;
  framingReference: AiEditorialReviewPackageV1["framing_reference"];
  liveEnrichmentReference: AiEditorialReviewPackageV1["live_enrichment_reference"];
  provider: string;
  promptTemplateKey: string;
  promptVersion: string;
}): AiEditorialReviewPackageV1 | null {
  const findings: EditorialReviewFinding[] = [];

  if (isHonestySummary(params.honestyContext)) {
    findings.push(...findingsFromHonesty(params.honestyContext));
  }

  const rawDraft = params.draftEnrichmentPackage;
  if (rawDraft && typeof rawDraft === "object" && !Array.isArray(rawDraft)) {
    const p = rawDraft as Partial<DraftEnrichmentPackageV1>;
    if (p.schema_version === DRAFT_ENRICHMENT_SCHEMA_VERSION && Array.isArray(p.coverage_gaps)) {
      findings.push(...findingsFromCoverageGaps(p.coverage_gaps));
    }
  }

  if (findings.length === 0) {
    return null;
  }

  return {
    schema_version: AI_EDITORIAL_REVIEW_SCHEMA_VERSION,
    review_mode: "deterministic_honesty_fallback",
    status: "fallback_deterministic",
    prompt_template_key: params.promptTemplateKey,
    prompt_version: params.promptVersion,
    provider: params.provider,
    model: null,
    story_id: params.storyId,
    research_job_id: params.researchJobId,
    framing_reference: params.framingReference,
    live_enrichment_reference: params.liveEnrichmentReference,
    honesty_context: params.honestyContext,
    review_findings: findings,
    overall_editorial_posture:
      "Deterministic scaffolding: prioritize verifying thin-support areas and coverage gaps before narrative polish. Live model review did not complete for this run.",
    not_authoritative_review_note: NOTE,
    failure: {
      code: "editorial_review_used_honesty_fallback",
      message:
        "Live model path did not produce validated review output; findings below are derived from Storywall honesty and enrichment coverage signals only.",
    },
    generated_at: new Date().toISOString(),
  };
}
