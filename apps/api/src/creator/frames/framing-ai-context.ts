import {
  buildResearchPackageHonestySummary,
  type ResearchPackageHonestySummary,
} from "@storywall/shared";
import type { PrismaService } from "../../prisma/prisma.service";

export type FramingResearchGrounding = {
  research_job_id: string | null;
  research_synthesis_excerpt: string;
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
    include: { artifact: true },
  });

  if (!job?.artifact) {
    return {
      research_job_id: null,
      research_synthesis_excerpt: "",
      honesty_summary: buildResearchPackageHonestySummary({
        draftEnrichmentPackage: null,
        researchSynthesisPackage: null,
      }),
    };
  }

  const syn = job.artifact.researchSynthesisPackage;
  const excerpt =
    syn && typeof syn === "object" ? JSON.stringify(syn).slice(0, 14_000) : "";

  return {
    research_job_id: job.id,
    research_synthesis_excerpt: excerpt,
    honesty_summary: buildResearchPackageHonestySummary({
      draftEnrichmentPackage: job.artifact.draftEnrichmentPackage ?? null,
      researchSynthesisPackage: syn ?? null,
    }),
  };
}
