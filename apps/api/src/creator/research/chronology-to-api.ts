import type {
  ChronologyAssembly,
  ChronologyExtractedEvent,
  ChronologyEventSourceLink,
  ResearchCandidateSource,
} from "@prisma/client";
import { researchCandidateSourceToApi } from "./research-package-to-api";

export type ChronologyExtractedEventWithLinks = ChronologyExtractedEvent & {
  sourceLinks: (ChronologyEventSourceLink & {
    researchCandidateSource: ResearchCandidateSource;
  })[];
};

export function chronologyEventSourceLinkToApi(
  link: ChronologyEventSourceLink,
  source: ResearchCandidateSource,
): Record<string, unknown> {
  return {
    id: link.id,
    chronology_extracted_event_id: link.chronologyExtractedEventId,
    research_candidate_source_id: link.researchCandidateSourceId,
    story_id: link.storyId,
    research_job_id: link.researchJobId,
    relation_kind: link.relationKind,
    counts_toward_sufficiency: link.countsTowardSufficiency,
    ordering_index: link.orderingIndex,
    rationale_note: link.rationaleNote,
    created_at: link.createdAt.toISOString(),
    candidate_source: researchCandidateSourceToApi(source),
  };
}

export function chronologyExtractedEventToApi(e: ChronologyExtractedEventWithLinks): Record<string, unknown> {
  const links = [...e.sourceLinks].sort((a, b) => a.orderingIndex - b.orderingIndex);
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
    source_relationships: links.map((sl) =>
      chronologyEventSourceLinkToApi(sl, sl.researchCandidateSource),
    ),
  };
}

export function chronologyAssemblyToApi(
  a: ChronologyAssembly,
  events: ChronologyExtractedEventWithLinks[],
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
