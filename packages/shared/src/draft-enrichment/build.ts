/**
 * M5-T07 — deterministic draft enrichment from M5-T05 synthesis + M5-T06 chronology rows.
 */

import { parseResearchSynthesisPackageV1 } from "../research-synthesis/parse";
import type { ResearchSynthesisPackageV1 } from "../research-synthesis/types";
import type {
  ChronologyEventEnrichmentInput,
  DraftEnrichmentKeyEvent,
  DraftEnrichmentMajorArc,
  DraftEnrichmentPackageV1,
  DraftEnrichmentSuggestedSection,
} from "./types";
import { DRAFT_ENRICHMENT_SCHEMA_VERSION } from "./types";

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function uniqueStrings(items: readonly string[], max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of items) {
    const t = x.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Parse `creator_note` JSON from M5-T06 chronology rows for `finding_id` linkage */
function linkedFindingIdsFromCreatorNote(creatorNote: string | null): string[] {
  if (!creatorNote) return [];
  try {
    const o = JSON.parse(creatorNote) as { m5_t06?: { finding_id?: string | null } };
    const id = o?.m5_t06?.finding_id;
    if (typeof id === "string" && id.trim().length > 0) return [id.trim()];
  } catch {
    /* ignore */
  }
  return [];
}

function majorArcsFromSynthesis(
  pkg: ResearchSynthesisPackageV1 | null,
  storyTitle: string,
): DraftEnrichmentMajorArc[] {
  if (!pkg) {
    return [
      {
        id: "arc-chronology-only",
        label: "Chronology-derived spine",
        summary: clip(
          `No M5-T05 synthesis package was available; arcs are inferred only from chronology and evidence summary for “${clip(storyTitle, 120)}”.`,
          900,
        ),
        member_finding_ids: [],
        supporting_research_candidate_source_ids: [],
        origin: "chronology_only",
      },
    ];
  }
  if (pkg.clusters.length > 0) {
    return pkg.clusters.map((c) => ({
      id: c.id,
      label: c.label,
      summary: clip(c.summary, 1500),
      member_finding_ids: [...c.member_finding_ids],
      supporting_research_candidate_source_ids: [...c.supporting_research_candidate_source_ids],
      origin: "synthesis_cluster" as const,
    }));
  }
  const sourced = pkg.findings.filter((f) => f.kind === "sourced_claim").map((f) => f.id);
  const allSourceIds = uniqueStrings(
    pkg.findings.flatMap((f) => [...f.supporting_research_candidate_source_ids]),
    64,
  );
  return [
    {
      id: "arc-sourced-bundle",
      label: "Sourced excerpt spine",
      summary: clip(
        `${sourced.length} sourced synthesis finding(s) bundle candidate claims for “${clip(storyTitle, 120)}”.`,
        900,
      ),
      member_finding_ids: sourced,
      supporting_research_candidate_source_ids: allSourceIds,
      origin: "synthesis_sourced_bundle",
    },
  ];
}

function suggestedSectionsFromSynthesis(
  pkg: ResearchSynthesisPackageV1 | null,
  events: readonly ChronologyEventEnrichmentInput[],
): DraftEnrichmentSuggestedSection[] {
  const sections: DraftEnrichmentSuggestedSection[] = [];
  if (pkg) {
    for (const f of pkg.findings) {
      if (f.kind === "synthesis_summary") {
        sections.push({
          title: "Structured overview (synthesis)",
          rationale: clip(`Grounded in synthesis finding ${f.id} (deterministic M5-T05).`, 400),
          linked_synthesis_finding_ids: [f.id],
          linked_chronology_position_indexes: events
            .filter((e) => linkedFindingIdsFromCreatorNote(e.creatorNote).includes(f.id))
            .map((e) => e.positionIndex),
        });
      }
    }
    const gapFindings = pkg.findings.filter((g) => g.kind === "gap_note").map((g) => g.id);
    if (gapFindings.length > 0) {
      sections.push({
        title: "Coverage, gaps, and follow-up research",
        rationale: "Derived from synthesis gap_note findings and package coverage notes.",
        linked_synthesis_finding_ids: gapFindings,
        linked_chronology_position_indexes: events
          .filter((e) => e.contextLabel?.includes("gap_note") || e.contextLabel?.includes("coverage"))
          .map((e) => e.positionIndex),
      });
    }
  }
  const sourcedIdx = events
    .filter((e) => e.contextLabel?.startsWith("m5_t06.candidate.sourced_claim:"))
    .map((e) => e.positionIndex);
  if (sourcedIdx.length > 0) {
    sections.push({
      title: "Timeline candidates (from research)",
      rationale: "Sections align with M5-T06 sourced_claim chronology rows for editorial ordering (not verified dates).",
      linked_synthesis_finding_ids: [],
      linked_chronology_position_indexes: sourcedIdx,
    });
  }
  if (sections.length === 0) {
    sections.push({
      title: "Opening narrative",
      rationale: "Fallback when synthesis sections are sparse; expand with additional research.",
      linked_synthesis_finding_ids: [],
      linked_chronology_position_indexes: events.filter((e) => e.positionIndex > 0).map((e) => e.positionIndex),
    });
  }
  return sections.slice(0, 12);
}

function isPreambleRow(e: ChronologyEventEnrichmentInput): boolean {
  return e.contextLabel === "m5_t06.insufficient_or_package_honesty";
}

function isOmissionRow(e: ChronologyEventEnrichmentInput): boolean {
  return Boolean(e.contextLabel?.includes("bounded_omission"));
}

function buildKeyEvents(events: readonly ChronologyEventEnrichmentInput[]): DraftEnrichmentKeyEvent[] {
  const out: DraftEnrichmentKeyEvent[] = [];
  for (const e of events) {
    if (e.positionIndex === 0 && isPreambleRow(e)) continue;
    if (isOmissionRow(e)) continue;
    out.push({
      chronology_event_id: e.id,
      position_index: e.positionIndex,
      headline: clip(e.headline, 240),
      summary_clip: clip(e.summary, 1200),
      event_type: e.eventType,
      context_label: e.contextLabel,
      supporting_research_candidate_source_ids: [...e.supportingCandidateSourceIds],
      linked_synthesis_finding_ids: linkedFindingIdsFromCreatorNote(e.creatorNote),
      claim_risk_level: e.claimRiskLevel,
      confidence_state: e.confidenceState,
      ambiguity_carryforward: e.ambiguityNote ? clip(e.ambiguityNote, 2000) : null,
    });
  }
  return out;
}

function buildCoverageGaps(
  pkg: ResearchSynthesisPackageV1 | null,
  events: readonly ChronologyEventEnrichmentInput[],
): string[] {
  const parts: string[] = [];
  if (pkg) {
    parts.push(...pkg.coverage_notes.map((x) => clip(x, 800)));
    for (const f of pkg.findings) {
      if (f.kind === "gap_note") parts.push(clip(f.text, 800));
    }
    parts.push(...pkg.open_questions.map((x) => clip(x, 500)));
  }
  for (const e of events) {
    if (e.contextLabel?.includes("coverage.gap_note") || e.contextLabel?.includes("insufficient")) {
      parts.push(clip(e.summary, 600));
    }
  }
  return uniqueStrings(parts, 24);
}

function buildAmbiguityNotes(
  pkg: ResearchSynthesisPackageV1 | null,
  events: readonly ChronologyEventEnrichmentInput[],
): string[] {
  const parts: string[] = [];
  if (pkg?.retrieval_partial && pkg.retrieval_partial_notes) {
    parts.push(clip(`Retrieval partial: ${pkg.retrieval_partial_notes}`, 800));
  }
  for (const e of events) {
    if (e.ambiguityNote && e.ambiguityNote.trim()) parts.push(clip(e.ambiguityNote, 1200));
  }
  return uniqueStrings(parts, 20);
}

function buildSummarySpine(
  pkg: ResearchSynthesisPackageV1 | null,
  events: readonly ChronologyEventEnrichmentInput[],
  storyTitle: string,
): string {
  const summaryFinding = pkg?.findings.find((f) => f.kind === "synthesis_summary");
  const preamble = events.find((e) => isPreambleRow(e));
  const sourcedHeadlines = events
    .filter((e) => e.contextLabel?.startsWith("m5_t06.candidate.sourced_claim:"))
    .slice(0, 4)
    .map((e) => clip(e.headline, 160));
  const blocks = [
    clip(`Story: “${clip(storyTitle, 160)}”`, 400),
    summaryFinding ? clip(summaryFinding.text, 900) : null,
    preamble ? clip(preamble.summary, 700) : null,
    sourcedHeadlines.length ? `Candidate spine headlines: ${sourcedHeadlines.join(" · ")}` : null,
  ].filter(Boolean);
  return clip(blocks.join("\n\n"), 4000);
}

/**
 * Deterministic enrichment: no LLM. Preserves provenance via IDs and carries forward ambiguity text.
 */
export function buildDraftEnrichmentPackageV1(params: {
  storyId: string;
  researchJobId: string;
  storyTitle: string;
  researchSynthesisPackage: unknown;
  chronologyExtractionVersion: string;
  chronologyEvents: readonly ChronologyEventEnrichmentInput[];
}): DraftEnrichmentPackageV1 {
  const pkg = parseResearchSynthesisPackageV1(params.researchSynthesisPackage);
  const generated_at = new Date().toISOString();
  const retrieval_partial = pkg?.retrieval_partial ?? false;
  const retrieval_context: DraftEnrichmentPackageV1["retrieval_context"] = pkg?.retrieval_mode ?? "unknown";

  return {
    schema_version: DRAFT_ENRICHMENT_SCHEMA_VERSION,
    story_id: params.storyId,
    research_job_id: params.researchJobId,
    generated_at,
    retrieval_context,
    retrieval_partial,
    not_publishable_narrative_note:
      "M5-T07 draft enrichment is creator-workflow scaffolding derived from bounded research synthesis and chronology candidates. It is not a publish-ready article, does not assert complete chronology, and must be edited with primary sources before publication.",
    synthesis_schema_version: pkg?.schema_version ?? null,
    chronology_extraction_version: params.chronologyExtractionVersion,
    summary_spine: buildSummarySpine(pkg, params.chronologyEvents, params.storyTitle),
    major_arcs: majorArcsFromSynthesis(pkg, params.storyTitle),
    suggested_sections: suggestedSectionsFromSynthesis(pkg, params.chronologyEvents),
    key_events: buildKeyEvents(params.chronologyEvents),
    coverage_gaps: buildCoverageGaps(pkg, params.chronologyEvents),
    ambiguity_notes: buildAmbiguityNotes(pkg, params.chronologyEvents),
  };
}
