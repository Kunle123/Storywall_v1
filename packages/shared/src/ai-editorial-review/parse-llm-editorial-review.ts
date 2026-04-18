import type {
  EditorialReviewFinding,
  EditorialReviewFindingCategory,
  EditorialReviewFindingSeverity,
  EditorialReviewGroundingRef,
  EditorialReviewGroundingRefKind,
} from "./types";

const GROUNDING_KINDS = new Set<string>([
  "synthesis_finding",
  "chronology_event",
  "research_candidate_source",
  "framing_option",
  "honesty_signal",
  "live_enrichment_event",
  "live_enrichment_section",
]);

const CATEGORIES = new Set<string>([
  "thin_support",
  "overclaim_risk",
  "duplication_or_repetition",
  "missing_context",
  "chronology_emphasis",
  "follow_up_research",
  "other",
]);

const SEVERITIES = new Set<string>(["info", "low", "medium", "high"]);

function parseGroundingRefs(raw: unknown): EditorialReviewGroundingRef[] {
  if (!Array.isArray(raw)) return [];
  const out: EditorialReviewGroundingRef[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue;
    const o = x as Record<string, unknown>;
    const kind = o.kind;
    if (typeof kind !== "string" || !GROUNDING_KINDS.has(kind)) continue;
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : undefined;
    const label = typeof o.label === "string" && o.label.trim() ? o.label.trim() : undefined;
    out.push({ kind: kind as EditorialReviewGroundingRefKind, id, label });
  }
  return out;
}

function parseCategory(raw: unknown): EditorialReviewFindingCategory {
  if (typeof raw !== "string" || !CATEGORIES.has(raw)) return "other";
  return raw as EditorialReviewFindingCategory;
}

function parseSeverity(raw: unknown): EditorialReviewFindingSeverity {
  if (typeof raw !== "string" || !SEVERITIES.has(raw)) return "medium";
  return raw as EditorialReviewFindingSeverity;
}

export type ParseEditorialReviewResult =
  | { ok: true; review_findings: EditorialReviewFinding[]; overall_editorial_posture: string }
  | { ok: false; error: string };

export function parseEditorialReviewFromLlmJson(rawText: string): ParseEditorialReviewResult {
  let root: unknown;
  try {
    root = JSON.parse(rawText) as unknown;
  } catch {
    return { ok: false, error: "llm_output_not_valid_json" };
  }
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    return { ok: false, error: "llm_output_not_object" };
  }
  const o = root as Record<string, unknown>;
  const findingsRaw = o.review_findings;
  if (!Array.isArray(findingsRaw)) {
    return { ok: false, error: "llm_missing_review_findings" };
  }
  if (findingsRaw.length > 48) {
    return { ok: false, error: "llm_findings_too_large" };
  }
  const posture =
    typeof o.overall_editorial_posture === "string" && o.overall_editorial_posture.trim()
      ? o.overall_editorial_posture.trim().slice(0, 2000)
      : "";

  const review_findings: EditorialReviewFinding[] = [];
  let i = 0;
  for (const item of findingsRaw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "llm_invalid_finding_shape" };
    }
    const row = item as Record<string, unknown>;
    const explanation =
      typeof row.explanation === "string" ? row.explanation.trim() : "";
    if (!explanation) {
      return { ok: false, error: "llm_finding_missing_explanation" };
    }
    const idRaw = typeof row.id === "string" ? row.id.trim() : "";
    const id = idRaw || `finding:${i}`;
    const suggested =
      typeof row.suggested_action === "string" && row.suggested_action.trim()
        ? row.suggested_action.trim().slice(0, 2000)
        : null;
    review_findings.push({
      id,
      category: parseCategory(row.category),
      severity: parseSeverity(row.severity),
      explanation: explanation.slice(0, 4000),
      suggested_action: suggested,
      grounding_refs: parseGroundingRefs(row.grounding_refs),
    });
    i += 1;
  }

  return {
    ok: true,
    review_findings,
    overall_editorial_posture: posture || "Review the flagged items against primary sources before treating material as publish-ready.",
  };
}
