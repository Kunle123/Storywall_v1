import type { SectionDraft } from "@prisma/client";

/** `section_draft` fragment for creator API (editor §11, mutation §13). */
export function sectionDraftToApi(s: SectionDraft): Record<string, unknown> {
  return {
    id: s.id,
    story_draft_id: s.storyDraftId,
    label: s.label,
    summary: s.summary,
    position_index: s.positionIndex,
    status: s.status,
    section_origin: s.sectionOrigin,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  };
}
