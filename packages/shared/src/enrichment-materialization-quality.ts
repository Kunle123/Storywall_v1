/**
 * M5-T26 — deterministic enrichment materialization quality (chronology + draft package + optional manuscript shell).
 * Separate from M5-T23 retrieval depth, M5-T24 synthesis orchestration, and M5-T25 framing quality.
 * No speculative model scores — counts and length floors on real payloads only.
 */

export const ENRICHMENT_MATERIALIZATION_QUALITY_VERSION = "m5-t26-v1" as const;

export type EnrichmentMaterializationTier = "production_usable" | "usable_with_caveats" | "scaffold_thin";

export type ChronologyEventLite = {
  headline: string;
  summary: string;
  context_label?: string | null;
  event_type?: string | null;
  position_index?: number | null;
};

export type ManuscriptEventLite = {
  headline?: string | null;
  summary?: string | null;
  event_type?: string | null;
};

export type ManuscriptSectionLite = {
  label?: string | null;
  summary?: string | null;
};

const PREAMBLE_HEADLINE = "Chronology coverage (M5-T06)";

function isPreambleHeadline(h: string): boolean {
  return h.trim() === PREAMBLE_HEADLINE;
}

function isSubstantiveChronologyRow(e: ChronologyEventLite): boolean {
  const h = (e.headline ?? "").trim();
  const s = (e.summary ?? "").trim();
  if (!h || isPreambleHeadline(h)) return false;
  if (h.length < 8 || s.length < 48) return false;
  const ctx = (e.context_label ?? "").toLowerCase();
  if (ctx.includes("m5_t06.candidate.sourced_claim")) return true;
  if (ctx.includes("m5_t06.non_event.synthesis_summary")) return s.length >= 140;
  if (ctx.includes("m5_t06.non_event") || ctx.includes("gap_note")) return s.length >= 90;
  return s.length >= 72;
}

function tierFromChronology(params: {
  substantiveRatio: number;
  avgSummary: number;
  sourcedClaimRows: number;
  nonPreambleCount: number;
}): EnrichmentMaterializationTier {
  if (params.nonPreambleCount === 0) return "scaffold_thin";
  if (params.substantiveRatio >= 0.55 && params.avgSummary >= 100 && params.sourcedClaimRows >= 2) {
    return "production_usable";
  }
  if (params.substantiveRatio >= 0.35 && params.avgSummary >= 64) return "usable_with_caveats";
  return "scaffold_thin";
}

function parseDraftPackage(pkg: unknown): {
  key_events: unknown[];
  suggested_sections: unknown[];
  major_arcs: unknown[];
  summary_spine: string;
  schemaOk: boolean;
} {
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
    return { key_events: [], suggested_sections: [], major_arcs: [], summary_spine: "", schemaOk: false };
  }
  const o = pkg as Record<string, unknown>;
  const schemaOk = o.schema_version === "m5-t08-v1";
  return {
    key_events: Array.isArray(o.key_events) ? o.key_events : [],
    suggested_sections: Array.isArray(o.suggested_sections) ? o.suggested_sections : [],
    major_arcs: Array.isArray(o.major_arcs) ? o.major_arcs : [],
    summary_spine: typeof o.summary_spine === "string" ? o.summary_spine : "",
    schemaOk,
  };
}

function richKeyEvent(k: unknown): boolean {
  if (!k || typeof k !== "object" || Array.isArray(k)) return false;
  const o = k as Record<string, unknown>;
  const h = String(o.headline ?? "").trim().length;
  const s = String(o.summary_clip ?? "").trim().length;
  return h >= 10 && s >= 52;
}

function richSection(s: unknown): boolean {
  if (!s || typeof s !== "object" || Array.isArray(s)) return false;
  const o = s as Record<string, unknown>;
  const title = String(o.title ?? "").trim().length;
  const rationale = String(o.rationale ?? "").trim().length;
  return title >= 8 && rationale >= 56;
}

function tierFromDraft(params: {
  schemaOk: boolean;
  spineChars: number;
  richKeyEvents: number;
  richSections: number;
  majorArcs: number;
}): EnrichmentMaterializationTier {
  if (!params.schemaOk) return "scaffold_thin";
  if (params.spineChars < 120) return "scaffold_thin";
  if (params.richKeyEvents >= 2 && params.richSections >= 2 && params.spineChars >= 220) return "production_usable";
  if (params.richKeyEvents >= 1 && params.richSections >= 1 && params.spineChars >= 160) return "usable_with_caveats";
  return "scaffold_thin";
}

function substantiveEventDraft(ev: ManuscriptEventLite): boolean {
  const h = String(ev.headline ?? "").trim();
  const s = String(ev.summary ?? "").trim();
  if (isPreambleHeadline(h)) return false;
  return h.length >= 8 && s.length >= 48;
}

function tierFromManuscript(params: {
  eventDraftCount: number;
  substantiveEvents: number;
  sectionCount: number;
  sectionsWithSummary: number;
}): EnrichmentMaterializationTier {
  if (params.eventDraftCount === 0 && params.sectionCount === 0) return "scaffold_thin";
  const eventsOk = params.substantiveEvents >= 2;
  const sectionsOk = params.sectionCount >= 1 && params.sectionsWithSummary >= 1;
  if (eventsOk && sectionsOk && params.substantiveEvents >= 3) return "production_usable";
  if ((params.substantiveEvents >= 1 && params.sectionCount >= 1) || params.substantiveEvents >= 2) {
    return "usable_with_caveats";
  }
  return "scaffold_thin";
}

function tierRank(t: EnrichmentMaterializationTier): number {
  if (t === "scaffold_thin") return 0;
  if (t === "usable_with_caveats") return 1;
  return 2;
}

function tierFromRank(r: number): EnrichmentMaterializationTier {
  if (r <= 0) return "scaffold_thin";
  if (r === 1) return "usable_with_caveats";
  return "production_usable";
}

export type EnrichmentMaterializationQualityV1 = {
  schema_version: typeof ENRICHMENT_MATERIALIZATION_QUALITY_VERSION;
  chronology_layer: {
    event_total: number;
    non_preamble_count: number;
    substantive_event_count: number;
    substantive_event_ratio: number;
    average_summary_chars_substantive: number;
    sourced_claim_row_count: number;
    overall: EnrichmentMaterializationTier;
    headline: string;
    next_action: string;
  };
  draft_enrichment_layer: {
    has_m5_t08_package: boolean;
    summary_spine_chars: number;
    rich_key_event_count: number;
    rich_suggested_section_count: number;
    major_arc_count: number;
    overall: EnrichmentMaterializationTier;
    headline: string;
    next_action: string;
  };
  manuscript_shell: {
    event_draft_count: number;
    substantive_event_draft_count: number;
    narrative_section_count: number;
    sections_with_substantive_summary: number;
    overall: EnrichmentMaterializationTier;
    headline: string;
    next_action: string;
  } | null;
  combined_overall: EnrichmentMaterializationTier;
  ui_hint_line: string;
};

export type AssessEnrichmentMaterializationInput = {
  chronologyEvents: readonly ChronologyEventLite[];
  draftEnrichmentPackage: unknown;
  manuscript?: {
    events: readonly ManuscriptEventLite[];
    sections: readonly ManuscriptSectionLite[];
  } | null;
};

export function assessEnrichmentMaterializationQuality(input: AssessEnrichmentMaterializationInput): EnrichmentMaterializationQualityV1 {
  const events = input.chronologyEvents;
  const nonPreamble = events.filter((e) => !isPreambleHeadline((e.headline ?? "").trim()));
  const substantive = nonPreamble.filter(isSubstantiveChronologyRow);
  const sourcedClaimRows = nonPreamble.filter((e) =>
    (e.context_label ?? "").includes("m5_t06.candidate.sourced_claim"),
  ).length;
  const ratio = nonPreamble.length === 0 ? 0 : substantive.length / nonPreamble.length;
  const avgSum =
    substantive.length === 0
      ? 0
      : Math.round(substantive.reduce((a, e) => a + (e.summary ?? "").trim().length, 0) / substantive.length);

  const chTier = tierFromChronology({
    substantiveRatio: ratio,
    avgSummary: avgSum,
    sourcedClaimRows,
    nonPreambleCount: nonPreamble.length,
  });
  const chHead =
    chTier === "production_usable"
      ? "Chronology layer: materially enriched — sourced rows carry excerpt-scale summaries suitable for editing."
      : chTier === "usable_with_caveats"
        ? "Chronology layer: usable with caveats — some rows are thin or non-event notes; verify beats before publishing."
        : "Chronology layer: scaffold-thin — too few substantive chronology rows for confident timeline editing.";

  const chNext =
    chTier === "scaffold_thin"
      ? "Broaden research or re-run with live retrieval, then inspect chronology rows before drafting."
      : chTier === "usable_with_caveats"
        ? "Edit thin rows manually or add sources; treat stub retrieval as structural only."
        : "Use chronology as the primary editing spine while corroborating dates externally.";

  const parsed = parseDraftPackage(input.draftEnrichmentPackage);
  const richKe = parsed.key_events.filter(richKeyEvent).length;
  const richSec = parsed.suggested_sections.filter(richSection).length;
  const spineChars = parsed.summary_spine.trim().length;
  const drTier = tierFromDraft({
    schemaOk: parsed.schemaOk,
    spineChars,
    richKeyEvents: richKe,
    richSections: richSec,
    majorArcs: parsed.major_arcs.length,
  });
  const drHead =
    drTier === "production_usable"
      ? "Draft enrichment layer: materially enriched — key events, sections, and summary spine carry editor-scale text."
      : drTier === "usable_with_caveats"
        ? "Draft enrichment layer: usable with caveats — some nodes are short or single-source; edit before treating as coverage truth."
        : "Draft enrichment layer: scaffold-thin — M5-T08 package missing or too sparse for manuscript planning.";

  const drNext =
    drTier === "scaffold_thin"
      ? "Ensure research succeeded and worker persisted draft_enrichment; re-run research if package absent."
      : drTier === "usable_with_caveats"
        ? "Expand synthesis-backed claims or add manual events, then re-assemble draft when ready."
        : "Use major arcs and suggested sections as scaffolding while writing narrative prose in the editor.";

  let manuscript: EnrichmentMaterializationQualityV1["manuscript_shell"] = null;
  if (input.manuscript) {
    const evs = input.manuscript.events;
    const secs = input.manuscript.sections;
    const subEv = evs.filter(substantiveEventDraft).length;
    const secRich = secs.filter((s) => String(s.summary ?? "").trim().length >= 24 || String(s.label ?? "").trim().length >= 6)
      .length;
    const msTier = tierFromManuscript({
      eventDraftCount: evs.length,
      substantiveEvents: subEv,
      sectionCount: secs.length,
      sectionsWithSummary: secRich,
    });
    manuscript = {
      event_draft_count: evs.length,
      substantive_event_draft_count: subEv,
      narrative_section_count: secs.length,
      sections_with_substantive_summary: secRich,
      overall: msTier,
      headline:
        msTier === "production_usable"
          ? "Manuscript shell: materially enriched — event drafts and section labels carry enough text to edit."
          : msTier === "usable_with_caveats"
            ? "Manuscript shell: usable with caveats — some events or sections are still skeletal after assembly."
            : "Manuscript shell: scaffold-thin — assembled draft lacks enough substantive rows for confident editing.",
      next_action:
        msTier === "scaffold_thin"
          ? "Run full draft assembly from ready_for_edit, or check worker logs if assembly succeeded but rows are empty."
          : msTier === "usable_with_caveats"
            ? "Flesh out key events and section summaries in the draft workspace before validation."
            : "Proceed to narrative drafting while tightening weak support nodes flagged in enrichment.",
    };
  }

  const ranks = [tierRank(chTier), tierRank(drTier)];
  if (manuscript) ranks.push(tierRank(manuscript.overall));
  const combined = tierFromRank(Math.min(...ranks));

  const ui = `Enrichment materialization (M5-T26): combined=${combined} — chronology=${chTier}, draft_package=${drTier}${manuscript ? `, manuscript_shell=${manuscript.overall}` : ""}.`;

  return {
    schema_version: ENRICHMENT_MATERIALIZATION_QUALITY_VERSION,
    chronology_layer: {
      event_total: events.length,
      non_preamble_count: nonPreamble.length,
      substantive_event_count: substantive.length,
      substantive_event_ratio: Math.round(ratio * 1000) / 1000,
      average_summary_chars_substantive: avgSum,
      sourced_claim_row_count: sourcedClaimRows,
      overall: chTier,
      headline: chHead,
      next_action: chNext,
    },
    draft_enrichment_layer: {
      has_m5_t08_package: parsed.schemaOk,
      summary_spine_chars: spineChars,
      rich_key_event_count: richKe,
      rich_suggested_section_count: richSec,
      major_arc_count: parsed.major_arcs.length,
      overall: drTier,
      headline: drHead,
      next_action: drNext,
    },
    manuscript_shell: manuscript,
    combined_overall: combined,
    ui_hint_line: ui,
  };
}
