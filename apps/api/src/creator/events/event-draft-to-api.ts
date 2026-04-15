import type { EventDraft } from "@prisma/client";

/** `event_draft` fragment for creator API (editor §12, mutation §14). */
export function eventDraftToApi(e: EventDraft): Record<string, unknown> {
  return {
    id: e.id,
    story_draft_id: e.storyDraftId,
    section_id: e.sectionDraftId,
    headline: e.headline,
    dek: e.dek,
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
    position_index: e.positionIndex,
    interval_note: e.intervalNote,
    location_name: e.locationName,
    media_kind: e.mediaKind,
    source_count: e.sourceCount,
    source_density: e.sourceDensity,
    confidence_state: e.confidenceState,
    claim_risk_level: e.claimRiskLevel,
    moderation_status: e.moderationStatus,
    is_shareable: e.isShareable,
    is_pinned: e.isPinned,
    is_featured_in_summary: e.isFeaturedInSummary,
    generation_mode: e.generationMode,
    editorial_review_status: e.editorialReviewStatus,
    status: e.status,
    created_at: e.createdAt.toISOString(),
    updated_at: e.updatedAt.toISOString(),
  };
}
