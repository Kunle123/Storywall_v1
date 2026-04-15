import type { StoryDraft } from "@prisma/client";

/** Minimal story_draft fragment for mutation responses (editor §10.1). */
export function storyDraftToApi(d: StoryDraft): Record<string, unknown> {
  return {
    id: d.id,
    story_brief_id: d.storyBriefId,
    selected_frame_id: d.selectedFrameId,
    title: d.title,
    subtitle: d.subtitle,
    summary: d.summary,
    lens: d.lens,
    conclusion: d.conclusion,
    subject_type: d.subjectType,
    category_primary: d.categoryPrimary,
    category_secondary: d.categorySecondary,
    story_status: d.storyStatus,
    visibility_target: d.visibilityTarget,
    imagery_mode: d.imageryMode,
    generation_mode: d.generationMode,
    editorial_review_status: d.editorialReviewStatus,
    created_at: d.createdAt.toISOString(),
    last_edited_at: d.lastEditedAt.toISOString(),
  };
}
