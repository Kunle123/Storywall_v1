import type { StoryFrameDraft } from "@prisma/client";

/** API fragment — editor §9.1, mutation §19 framing family. */
export function storyFrameDraftToApi(f: StoryFrameDraft): Record<string, unknown> {
  return {
    id: f.id,
    story_brief_id: f.storyBriefId,
    title_candidate: f.titleCandidate,
    subtitle_candidate: f.subtitleCandidate,
    summary_candidate: f.summaryCandidate,
    lens_candidate: f.lensCandidate,
    scope_rationale: f.scopeRationale,
    coverage_implications: f.coverageImplications,
    balance_note: f.balanceNote,
    section_candidates: f.sectionCandidates,
    confidence_summary_initial: f.confidenceSummaryInitial,
    candidate_rank: f.candidateRank,
    is_selected: f.isSelected,
    selection_source: f.selectionSource,
    status: f.status,
    created_at: f.createdAt.toISOString(),
    updated_at: f.updatedAt.toISOString(),
  };
}
