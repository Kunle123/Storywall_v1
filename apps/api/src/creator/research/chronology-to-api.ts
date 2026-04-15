import type { ChronologyAssembly, ChronologyExtractedEvent } from "@prisma/client";

export function chronologyExtractedEventToApi(e: ChronologyExtractedEvent): Record<string, unknown> {
  return {
    id: e.id,
    chronology_assembly_id: e.chronologyAssemblyId,
    position_index: e.positionIndex,
    headline: e.headline,
    summary: e.summary,
    creator_note: e.creatorNote,
    event_type: e.eventType,
    context_label: e.contextLabel,
    significance_level: e.significanceLevel,
    event_date_start: e.eventDateStart?.toISOString() ?? null,
    event_date_end: e.eventDateEnd?.toISOString() ?? null,
    event_date_precision: e.eventDatePrecision,
    display_date: e.displayDate,
    year_anchor: e.yearAnchor,
    interval_note: e.intervalNote,
    location_name: e.locationName,
    media_kind: e.mediaKind,
    source_density: e.sourceDensity,
    confidence_state: e.confidenceState,
    claim_risk_level: e.claimRiskLevel,
    supporting_candidate_source_ids: e.supportingCandidateSourceIds,
    ambiguity_note: e.ambiguityNote,
    created_at: e.createdAt.toISOString(),
  };
}

export function chronologyAssemblyToApi(
  a: ChronologyAssembly,
  events: ChronologyExtractedEvent[],
): Record<string, unknown> {
  const ordered = [...events].sort((x, y) => x.positionIndex - y.positionIndex);
  return {
    id: a.id,
    research_job_id: a.researchJobId,
    story_id: a.storyId,
    extraction_version: a.extractionVersion,
    created_at: a.createdAt.toISOString(),
    events: ordered.map((e) => chronologyExtractedEventToApi(e)),
  };
}
