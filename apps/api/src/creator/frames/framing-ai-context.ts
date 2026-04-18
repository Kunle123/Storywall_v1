import {
  buildResearchPackageHonestySummary,
  formatSynthesisOrchestrationBriefForPrompt,
  parseResearchSynthesisPackageV1,
  type ResearchPackageHonestySummary,
} from "@storywall/shared";
import type { PrismaService } from "../../prisma/prisma.service";

export type FramingResearchGrounding = {
  research_job_id: string | null;
  research_synthesis_excerpt: string;
  /** M5-T24 — human-readable synthesis spine for live framing (alongside JSON excerpt). */
  research_synthesis_structured_brief: string;
  honesty_summary: ResearchPackageHonestySummary;
};

/**
 * Loads latest succeeded research artifact for framing prompts + M5-T09 honesty snapshot.
 */
export async function loadFramingResearchGrounding(
  prisma: PrismaService,
  storyId: string,
): Promise<FramingResearchGrounding> {
  const job = await prisma.researchJob.findFirst({
    where: { storyId, status: "succeeded" },
    orderBy: { finishedAt: "desc" },
    include: {
      artifact: true,
      _count: { select: { candidateSources: true } },
      chronologyAssembly: { select: { _count: { select: { events: true } } } },
    },
  });

  if (!job?.artifact) {
    return {
      research_job_id: null,
      research_synthesis_excerpt: "",
      research_synthesis_structured_brief: "",
      honesty_summary: buildResearchPackageHonestySummary({
        draftEnrichmentPackage: null,
        researchSynthesisPackage: null,
      }),
    };
  }

  const syn = job.artifact.researchSynthesisPackage;
  const excerpt =
    syn && typeof syn === "object" ? JSON.stringify(syn).slice(0, 14_000) : "";
  const parsedSyn = parseResearchSynthesisPackageV1(syn ?? null);
  const research_synthesis_structured_brief = parsedSyn
    ? formatSynthesisOrchestrationBriefForPrompt(parsedSyn)
    : "";

  const chronologyEventCount = job.chronologyAssembly?._count.events ?? 0;

  return {
    research_job_id: job.id,
    research_synthesis_excerpt: excerpt,
    research_synthesis_structured_brief,
    honesty_summary: buildResearchPackageHonestySummary({
      draftEnrichmentPackage: job.artifact.draftEnrichmentPackage ?? null,
      researchSynthesisPackage: syn ?? null,
      candidateSourceCountOverride: job._count.candidateSources,
      synthesisOrchestrationSupplement: {
        chronology_event_count: chronologyEventCount,
        draft_enrichment_package_present: Boolean(job.artifact.draftEnrichmentPackage),
      },
    }),
  };
}
