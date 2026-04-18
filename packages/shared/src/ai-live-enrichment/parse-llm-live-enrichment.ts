import type {
  LiveEnrichmentEnrichedEvent,
  LiveEnrichmentGroundingRef,
  LiveEnrichmentGroundingRefKind,
  LiveEnrichmentSuggestedSection,
} from "./types";

const GROUNDING_KINDS = new Set<string>([
  "synthesis_finding",
  "chronology_event",
  "research_candidate_source",
  "framing_option",
  "honesty_signal",
]);

function parseGroundingRefs(raw: unknown): LiveEnrichmentGroundingRef[] {
  if (!Array.isArray(raw)) return [];
  const out: LiveEnrichmentGroundingRef[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue;
    const o = x as Record<string, unknown>;
    const kind = o.kind;
    if (typeof kind !== "string" || !GROUNDING_KINDS.has(kind)) continue;
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : undefined;
    const label = typeof o.label === "string" && o.label.trim() ? o.label.trim() : undefined;
    out.push({ kind: kind as LiveEnrichmentGroundingRefKind, id, label });
  }
  return out;
}

export type ParseLiveEnrichmentResult =
  | { ok: true; enriched_events: LiveEnrichmentEnrichedEvent[]; suggested_sections: LiveEnrichmentSuggestedSection[] }
  | { ok: false; error: string };

export function parseLiveEnrichmentFromLlmJson(rawText: string): ParseLiveEnrichmentResult {
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
  const ev = o.enriched_events;
  const sec = o.suggested_sections;
  if (!Array.isArray(ev) || !Array.isArray(sec)) {
    return { ok: false, error: "llm_missing_arrays" };
  }
  if (ev.length > 80 || sec.length > 40) {
    return { ok: false, error: "llm_arrays_too_large" };
  }

  const enriched_events: LiveEnrichmentEnrichedEvent[] = [];
  let i = 0;
  for (const item of ev) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "llm_invalid_event_shape" };
    }
    const row = item as Record<string, unknown>;
    const chronology_event_id =
      typeof row.chronology_event_id === "string" ? row.chronology_event_id.trim() : "";
    const narrative_expansion =
      typeof row.narrative_expansion === "string" ? row.narrative_expansion.trim() : "";
    if (!chronology_event_id || !narrative_expansion) {
      return { ok: false, error: "llm_event_missing_ids_or_expansion" };
    }
    const idRaw = typeof row.id === "string" ? row.id.trim() : "";
    const id = idRaw || `live_ev:${i}`;
    const emphasis =
      typeof row.emphasis_note === "string" && row.emphasis_note.trim() ? row.emphasis_note.trim() : null;
    const caution =
      typeof row.caution_note === "string" && row.caution_note.trim() ? row.caution_note.trim() : null;
    enriched_events.push({
      id,
      chronology_event_id,
      narrative_expansion: narrative_expansion.slice(0, 12_000),
      emphasis_note: emphasis,
      caution_note: caution,
      grounding_refs: parseGroundingRefs(row.grounding_refs),
    });
    i += 1;
  }

  const suggested_sections: LiveEnrichmentSuggestedSection[] = [];
  let j = 0;
  for (const item of sec) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "llm_invalid_section_shape" };
    }
    const row = item as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const purpose = typeof row.purpose === "string" ? row.purpose.trim() : "";
    if (!title || !purpose) {
      return { ok: false, error: "llm_section_missing_title_or_purpose" };
    }
    const idRaw = typeof row.id === "string" ? row.id.trim() : "";
    const id = idRaw || `live_sec:${j}`;
    const evIds = Array.isArray(row.supporting_chronology_event_ids)
      ? row.supporting_chronology_event_ids.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];
    const findIds = Array.isArray(row.supporting_synthesis_finding_ids)
      ? row.supporting_synthesis_finding_ids.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];
    const caution =
      typeof row.caution_note === "string" && row.caution_note.trim() ? row.caution_note.trim() : null;
    suggested_sections.push({
      id,
      title: title.slice(0, 500),
      purpose: purpose.slice(0, 8000),
      supporting_chronology_event_ids: evIds,
      supporting_synthesis_finding_ids: findIds,
      caution_note: caution,
      grounding_refs: parseGroundingRefs(row.grounding_refs),
    });
    j += 1;
  }

  return { ok: true, enriched_events, suggested_sections };
}
