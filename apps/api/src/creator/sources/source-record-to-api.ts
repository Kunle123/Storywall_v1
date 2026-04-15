import type { SourceRecord } from "@prisma/client";

/** `source_record` fragment for creator API (editor §13, mutation §15). */
export function sourceRecordToApi(s: SourceRecord): Record<string, unknown> {
  return {
    id: s.id,
    event_id: s.eventDraftId,
    source_url: s.sourceUrl,
    source_title: s.sourceTitle,
    publisher_name: s.publisherName,
    source_type: s.sourceType,
    published_at: s.publishedAt?.toISOString() ?? null,
    excerpt: s.excerpt,
    relevance_note: s.relevanceNote,
    reliability_tier: s.reliabilityTier,
    verification_status: s.verificationStatus,
    is_primary: s.isPrimary,
    is_public: s.isPublic,
    duplicate_signal: s.duplicateSignal,
    source_extraction_method: s.extractionMethod,
    added_by: s.addedBy,
    status: s.status,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  };
}
