import type { AiFramingGenerationOption, AiFramingGroundingRefKind, AiFramingOptionGroundingRef } from "./types";

const GROUNDING_KINDS = new Set<string>(["synthesis_finding", "synthesis_cluster", "honesty_signal"]);

function parseGroundingRefs(raw: unknown): AiFramingOptionGroundingRef[] {
  if (!Array.isArray(raw)) return [];
  const out: AiFramingOptionGroundingRef[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue;
    const o = x as Record<string, unknown>;
    const kind = o.kind;
    if (typeof kind !== "string" || !GROUNDING_KINDS.has(kind)) continue;
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : undefined;
    const label = typeof o.label === "string" && o.label.trim() ? o.label.trim() : undefined;
    out.push({ kind: kind as AiFramingGroundingRefKind, id, label });
  }
  return out;
}

export type ParseLlmFramingResult =
  | { ok: true; options: AiFramingGenerationOption[] }
  | { ok: false; error: string };

/**
 * Parse model JSON (object or raw string) into framing options. Strict enough for audit; tolerant on extras.
 */
export function parseFramingOptionsFromLlmJson(rawText: string): ParseLlmFramingResult {
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
  const arr = o.framing_options;
  if (!Array.isArray(arr) || arr.length === 0) {
    return { ok: false, error: "llm_missing_framing_options" };
  }
  if (arr.length > 6) {
    return { ok: false, error: "llm_too_many_framing_options" };
  }

  const options: AiFramingGenerationOption[] = [];
  let i = 0;
  for (const item of arr) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "llm_invalid_option_shape" };
    }
    const row = item as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const angle = typeof row.angle_description === "string" ? row.angle_description.trim() : "";
    const emphasis = typeof row.narrative_emphasis === "string" ? row.narrative_emphasis.trim() : "";
    if (!title || !angle) {
      return { ok: false, error: "llm_option_missing_title_or_angle" };
    }
    const idRaw = typeof row.id === "string" ? row.id.trim() : "";
    const id = idRaw || `frame_opt_${i + 1}`;
    const caution =
      typeof row.caution_note === "string" && row.caution_note.trim().length > 0 ? row.caution_note.trim() : null;
    options.push({
      id,
      title: title.slice(0, 500),
      angle_description: angle.slice(0, 4000),
      narrative_emphasis: emphasis.slice(0, 4000) || angle.slice(0, 4000),
      caution_note: caution,
      grounding_refs: parseGroundingRefs(row.grounding_refs),
    });
    i += 1;
  }
  return { ok: true, options };
}
