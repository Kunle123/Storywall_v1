import type { Prisma } from "@prisma/client";
import type { BoundedRetrievalRunResult } from "@storywall/shared";
import type { ResearchJobWithStoryBrief } from "../m2-t02-stub.js";

type LiveRetrievalResult = BoundedRetrievalRunResult & { outcome: "ok" | "partial" };

/** Persistable research package from bounded Wikipedia retrieval (M5-T04). */
export function buildM5T04LivePersistPayload(
  rj: ResearchJobWithStoryBrief,
  result: LiveRetrievalResult,
): {
  evidencePackageSummary: string;
  candidateEventHints: Prisma.InputJsonValue;
  riskFlags: Prisma.InputJsonValue;
  confidencePosture: string;
  candidateSources: Prisma.ResearchCandidateSourceCreateManyInput[];
} {
  const story = rj.story;
  const brief = story.storyBrief;

  const evidencePackageSummary = [
    `Live retrieval research package for job ${rj.id} (M5-T04).`,
    `Provider: ${result.provider}. Retrieved at: ${result.retrievedAt}.`,
    `Bounded query: ${result.queryUsed}`,
    `Story: ${story.title}`,
    brief
      ? `Research brief excerpt: ${brief.researchBrief.slice(0, 400)}${brief.researchBrief.length > 400 ? "…" : ""}`
      : "No story brief row present.",
  ].join("\n");

  const candidateEventHints: Prisma.InputJsonValue = [
    {
      label: "retrieval_query",
      detail: result.queryUsed,
    },
    {
      label: "retrieval_outcome",
      detail: result.outcome,
    },
    {
      label: "open_questions",
      detail: "Verify dates and claims against primary sources; Wikipedia is tertiary.",
    },
  ];

  const riskFlags: Prisma.InputJsonValue = [
    {
      code: "live_retrieval",
      severity: "low",
      detail: "Bounded Wikipedia search API (M5-T04); full article HTML is not ingested in this ticket.",
    },
    ...(result.outcome === "partial"
      ? ([
          {
            code: "partial_retrieval",
            severity: "low",
            detail: result.notes,
          },
        ] as const)
      : []),
  ];

  const candidateSources: Prisma.ResearchCandidateSourceCreateManyInput[] = result.candidates.map((c) => ({
    researchJobId: rj.id,
    storyId: rj.storyId,
    sourceUrl: c.sourceUrl,
    sourceTitle: c.sourceTitle,
    publisherName: c.publisherName,
    sourceType: c.sourceType,
    publishedAt: null,
    excerpt: c.excerpt,
    relevanceNote: c.relevanceNote,
    reliabilityTier: c.reliabilityTier,
    positionIndex: c.positionIndex,
    extractionMethod: c.extractionMethod,
  }));

  return {
    evidencePackageSummary,
    candidateEventHints,
    riskFlags,
    confidencePosture: "mixed",
    candidateSources,
  };
}
