/**
 * M5-T25 — deterministic framing batch quality (distinctness + synthesis grounding + honest overall).
 * No speculative model scores; derived only from persisted framing_options + excerpt + honesty snapshot.
 */

import type {
  AiFramingGenerationOption,
  AiFramingGenerationPackageV1,
  FramingQualityAssessmentV1,
  FramingQualityDistinctnessRisk,
  FramingQualityGroundingTier,
  FramingQualityOverall,
} from "./types";
import { FRAMING_QUALITY_ASSESSMENT_VERSION } from "./types";

function tokenizeForDistinctness(s: string): string[] {
  const t = s.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 2);
  return t;
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) {
    if (B.has(x)) inter += 1;
  }
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function maxPairwiseJaccard(options: readonly AiFramingGenerationOption[]): number {
  const bags = options.map((o) => tokenizeForDistinctness(`${o.title}\n${o.angle_description.slice(0, 220)}`));
  let max = 0;
  for (let i = 0; i < bags.length; i += 1) {
    for (let j = i + 1; j < bags.length; j += 1) {
      max = Math.max(max, jaccard(bags[i]!, bags[j]!));
    }
  }
  return max;
}

function distinctnessRiskFromJaccard(maxJ: number): FramingQualityDistinctnessRisk {
  if (maxJ >= 0.68) return "high";
  if (maxJ >= 0.46) return "medium";
  return "low";
}

/** Collect finding + cluster ids from a JSON excerpt (truncation-safe best-effort). */
export function extractSynthesisIdsFromResearchExcerpt(excerpt: string): ReadonlySet<string> {
  const ids = new Set<string>();
  const t = excerpt.trim();
  if (!t) return ids;
  try {
    const root = JSON.parse(t) as Record<string, unknown>;
    const findings = root.findings;
    if (Array.isArray(findings)) {
      for (const f of findings) {
        if (f && typeof f === "object" && !Array.isArray(f)) {
          const id = (f as Record<string, unknown>).id;
          if (typeof id === "string" && id.trim()) ids.add(id.trim());
        }
      }
    }
    const clusters = root.clusters;
    if (Array.isArray(clusters)) {
      for (const c of clusters) {
        if (c && typeof c === "object" && !Array.isArray(c)) {
          const id = (c as Record<string, unknown>).id;
          if (typeof id === "string" && id.trim()) ids.add(id.trim());
        }
      }
    }
  } catch {
    /* truncated or non-JSON excerpt */
  }
  return ids;
}

function readHonestyUpstream(honesty: unknown): {
  retrieval_depth_tier: string | null;
  synthesis_orchestration_tier: string | null;
} {
  if (!honesty || typeof honesty !== "object" || Array.isArray(honesty)) {
    return { retrieval_depth_tier: null, synthesis_orchestration_tier: null };
  }
  const h = honesty as Record<string, unknown>;
  const rd = h.retrieval_depth;
  const so = h.synthesis_orchestration;
  const rTier = rd && typeof rd === "object" && !Array.isArray(rd) ? (rd as Record<string, unknown>).tier : null;
  const sTier = so && typeof so === "object" && !Array.isArray(so) ? (so as Record<string, unknown>).tier : null;
  return {
    retrieval_depth_tier: typeof rTier === "string" ? rTier : null,
    synthesis_orchestration_tier: typeof sTier === "string" ? sTier : null,
  };
}

/**
 * Counts options anchored to persisted synthesis ids — either explicit grounding_refs
 * or (M5-T25) models that reuse a finding/cluster id as the framing_option `id` with empty refs.
 */
function countOptionsWithValidSynthesisRefs(
  options: readonly AiFramingGenerationOption[],
  allowedIds: ReadonlySet<string>,
): number {
  if (allowedIds.size === 0) return 0;
  let n = 0;
  for (const o of options) {
    const refOk = o.grounding_refs.some(
      (r) =>
        (r.kind === "synthesis_finding" || r.kind === "synthesis_cluster") &&
        typeof r.id === "string" &&
        r.id.length > 0 &&
        allowedIds.has(r.id),
    );
    const idOk = typeof o.id === "string" && o.id.length > 0 && allowedIds.has(o.id);
    if (refOk || idOk) n += 1;
  }
  return n;
}

function groundingTier(options: readonly AiFramingGenerationOption[], withRef: number): FramingQualityGroundingTier {
  if (withRef >= options.length) return "strong";
  if (withRef >= 1) return "partial";
  return "partial";
}

function headlineFor(params: {
  overall: FramingQualityOverall;
  distinctness: FramingQualityDistinctnessRisk;
  grounding: FramingQualityGroundingTier;
  fallback: boolean;
}): string {
  if (params.fallback) {
    return "Framing quality: deterministic scaffolding — live model did not complete; treat angles as non-authoritative templates.";
  }
  if (params.overall === "weak_set") {
    return "Framing quality: weak set — options are too similar and/or poorly grounded in the persisted synthesis ids.";
  }
  if (params.overall === "usable_with_caveats") {
    return `Framing quality: usable with caveats — distinctness=${params.distinctness}, synthesis grounding=${params.grounding}; verify angles against primaries before committing.`;
  }
  return "Framing quality: production-usable batch — three differentiated angles with synthesis-backed grounding refs.";
}

function nextActionFor(params: {
  overall: FramingQualityOverall;
  distinctness: FramingQualityDistinctnessRisk;
  grounding: FramingQualityGroundingTier;
  fallback: boolean;
  upstreamThin: boolean;
}): string {
  if (params.fallback) {
    return "Re-run framing when the AI runtime is healthy, or continue with manual edits from the brief workspace.";
  }
  if (params.overall === "weak_set") {
    return "Regenerate framing (replace unselected), tighten the brief, or improve sources — do not treat near-duplicate angles as independent choices.";
  }
  if (params.distinctness === "high" || params.distinctness === "medium") {
    return "Compare titles carefully; if angles feel samey, regenerate framing after enriching the research brief.";
  }
  if (params.grounding === "partial" || params.upstreamThin) {
    return "Proceed to select a frame while treating thin upstream retrieval/synthesis as structural only — broaden research if you need stronger corroboration.";
  }
  return "Pick the angle that best matches your intent, then continue to brief refinement and draft assembly.";
}

export type AssessFramingQualityInput = {
  pkg: AiFramingGenerationPackageV1;
  researchSynthesisExcerpt: string;
  /** Creator brief for light scope touch (token presence), not semantic scoring. */
  researchBriefText: string;
};

/**
 * Deterministic assessment for persistence alongside `ai_framing_generation_package`.
 */
export function assessAiFramingGenerationQuality(input: AssessFramingQualityInput): FramingQualityAssessmentV1 {
  const opts = input.pkg.framing_options;
  const maxJ = maxPairwiseJaccard(opts);
  const distinctness = distinctnessRiskFromJaccard(maxJ);
  const allowedIds = extractSynthesisIdsFromResearchExcerpt(input.researchSynthesisExcerpt);
  const withSynthRef = countOptionsWithValidSynthesisRefs(opts, allowedIds);
  const gt: FramingQualityGroundingTier =
    allowedIds.size === 0 ? "none_applicable" : groundingTier(opts, withSynthRef);
  const upstream = readHonestyUpstream(input.pkg.honesty_context);
  const upstreamThin =
    upstream.retrieval_depth_tier === "thin" || upstream.synthesis_orchestration_tier === "thin";

  const fallback =
    input.pkg.generation_mode === "deterministic_scaffolding_fallback" || input.pkg.status === "fallback_deterministic";

  let overall: FramingQualityOverall;
  if (fallback) {
    overall = "usable_with_caveats";
  } else if (distinctness === "high") {
    overall = "weak_set";
  } else if (allowedIds.size >= 2 && withSynthRef < opts.length) {
    overall = "weak_set";
  } else if (distinctness === "medium" || gt === "partial" || upstreamThin) {
    overall = "usable_with_caveats";
  } else {
    overall = "production_usable";
  }

  const headline = headlineFor({ overall, distinctness, grounding: gt, fallback });
  const next_action = nextActionFor({
    overall,
    distinctness,
    grounding: gt,
    fallback,
    upstreamThin,
  });
  const ui_hint_line = `Framing quality (M5-T25): ${overall} — jaccard_max=${maxJ.toFixed(2)}, distinctness=${distinctness}, synth_grounding=${gt}, synthesis_ref_options=${withSynthRef}/${opts.length}, ids=${allowedIds.size}.`;

  return {
    schema_version: FRAMING_QUALITY_ASSESSMENT_VERSION,
    distinctness_risk: distinctness,
    max_pairwise_title_angle_jaccard: Math.round(maxJ * 1000) / 1000,
    synthesis_grounding: {
      extractable_synthesis_ids: allowedIds.size,
      options_with_synthesis_ref: withSynthRef,
      grounding_tier: gt,
    },
    upstream_signals: upstream,
    overall,
    headline,
    next_action,
    ui_hint_line,
  };
}
