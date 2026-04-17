import type { ResearchArtifact, ResearchCandidateSource } from "@prisma/client";

export function researchArtifactToApi(a: ResearchArtifact): Record<string, unknown> {
  return {
    id: a.id,
    research_job_id: a.researchJobId,
    story_id: a.storyId,
    evidence_package_summary: a.evidencePackageSummary,
    candidate_event_hints: a.candidateEventHints,
    risk_flags: a.riskFlags,
    confidence_posture: a.confidencePosture,
    research_synthesis_package: a.researchSynthesisPackage ?? null,
    created_at: a.createdAt.toISOString(),
  };
}

export function researchCandidateSourceToApi(s: ResearchCandidateSource): Record<string, unknown> {
  return {
    id: s.id,
    research_job_id: s.researchJobId,
    story_id: s.storyId,
    source_url: s.sourceUrl,
    source_title: s.sourceTitle,
    publisher_name: s.publisherName,
    source_type: s.sourceType,
    published_at: s.publishedAt?.toISOString() ?? null,
    excerpt: s.excerpt,
    relevance_note: s.relevanceNote,
    reliability_tier: s.reliabilityTier,
    position_index: s.positionIndex,
    extraction_method: s.extractionMethod,
    created_at: s.createdAt.toISOString(),
  };
}
