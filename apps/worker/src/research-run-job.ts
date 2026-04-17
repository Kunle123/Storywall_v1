import type { Prisma, PrismaClient } from "@prisma/client";
import {
  buildChronologyEventsFromResearchPackage,
  buildDraftEnrichmentPackageV1,
  CHRONOLOGY_EXTRACTION_VERSION,
  formatBoundedRetrievalBootstrapLine,
  parseBoundedRetrievalPolicyFromEnv,
  synthesizeResearchPackageV1,
} from "@storywall/shared";
import { buildM5T04LivePersistPayload } from "./bounded-retrieval/m5-t04-payload.js";
import { liveRetrievalFailureMessage, runBoundedWikipediaRetrieval } from "./bounded-retrieval/wikipedia-adapter.js";
import { buildM2T02PersistPayload, type ResearchJobWithStoryBrief } from "./m2-t02-stub.js";
import { ensureChronologyEventSourceLinks } from "./m2-t04-persist-links.js";
import { failResearchJobInTx } from "./research-job-failure.js";

const researchJobInclude = {
  story: {
    include: {
      storyBrief: {
        select: {
          subject: true,
          normalizedSubject: true,
          researchBrief: true,
          desiredAngle: true,
        },
      },
    },
  },
} as const;

export function logRetrievalBootstrap(env: NodeJS.ProcessEnv): void {
  const policy = parseBoundedRetrievalPolicyFromEnv(env as Record<string, string | undefined>);
  // eslint-disable-next-line no-console
  console.log(`[storywall-worker] ${formatBoundedRetrievalBootstrapLine(policy)}`);
}

export async function executeResearchRun(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv,
  researchJobId: string,
): Promise<void> {
  const retrievalPolicy = parseBoundedRetrievalPolicyFromEnv(env as Record<string, string | undefined>);

  const rj = await prisma.researchJob.findUnique({
    where: { id: researchJobId },
    include: researchJobInclude,
  });

  if (!rj) {
    return;
  }
  if (rj.status === "succeeded" || rj.status === "failed" || rj.status === "cancelled") {
    return;
  }

  if (retrievalPolicy.mode === "invalid_live") {
    const msg = `Retrieval policy misconfigured: ${retrievalPolicy.reasons.join(" | ")}`;
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.researchJob.findUnique({
        where: { id: researchJobId },
        include: researchJobInclude,
      });
      if (!fresh || fresh.status === "succeeded" || fresh.status === "failed" || fresh.status === "cancelled") {
        return;
      }
      await failResearchJobInTx(tx, {
        researchJobId: fresh.id,
        storyId: fresh.storyId,
        wfDuring: fresh.story.workflowState,
        restoreWorkflowState: fresh.preResearchWorkflowState,
        errorMessage: msg,
      });
    });
    return;
  }

  let liveResult: import("@storywall/shared").BoundedRetrievalRunResult | undefined;
  if (retrievalPolicy.mode === "live") {
    liveResult = await runBoundedWikipediaRetrieval({
      rj: rj as unknown as ResearchJobWithStoryBrief,
      policy: retrievalPolicy,
    });
  }

  const failMsg = liveRetrievalFailureMessage(retrievalPolicy, liveResult);
  if (failMsg) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.researchJob.findUnique({
        where: { id: researchJobId },
        include: researchJobInclude,
      });
      if (!fresh || fresh.status === "succeeded" || fresh.status === "failed" || fresh.status === "cancelled") {
        return;
      }
      await failResearchJobInTx(tx, {
        researchJobId: fresh.id,
        storyId: fresh.storyId,
        wfDuring: fresh.story.workflowState,
        restoreWorkflowState: fresh.preResearchWorkflowState,
        errorMessage: failMsg,
      });
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    const rj2 = await tx.researchJob.findUnique({
      where: { id: researchJobId },
      include: researchJobInclude,
    });
    if (!rj2) {
      return;
    }
    if (rj2.status === "succeeded" || rj2.status === "failed" || rj2.status === "cancelled") {
      return;
    }

    const wfDuring = rj2.story.workflowState;
    const targetState = rj2.preResearchWorkflowState;

    if (rj2.status === "pending") {
      await tx.researchJob.update({
        where: { id: researchJobId },
        data: { status: "running", startedAt: new Date() },
      });
    }

    const existingArtifact = await tx.researchArtifact.findUnique({
      where: { researchJobId: rj2.id },
    });
    if (!existingArtifact) {
      const asBrief = rj2 as unknown as ResearchJobWithStoryBrief;
      const payload =
        retrievalPolicy.mode === "live" && liveResult && (liveResult.outcome === "ok" || liveResult.outcome === "partial")
          ? buildM5T04LivePersistPayload(asBrief, liveResult)
          : buildM2T02PersistPayload(asBrief);

      await tx.researchArtifact.create({
        data: {
          researchJobId: rj2.id,
          storyId: rj2.storyId,
          evidencePackageSummary: payload.evidencePackageSummary,
          candidateEventHints: payload.candidateEventHints,
          riskFlags: payload.riskFlags,
          confidencePosture: payload.confidencePosture,
        },
      });
      await tx.researchCandidateSource.createMany({
        data: payload.candidateSources,
      });

      const sourcesForSynthesis = await tx.researchCandidateSource.findMany({
        where: { researchJobId: rj2.id },
        orderBy: { positionIndex: "asc" },
      });

      const retrievalPartial = Boolean(liveResult && liveResult.outcome === "partial");
      const retrievalPartialNotes =
        liveResult && liveResult.outcome === "partial" ? liveResult.notes : undefined;

      const synthesisPackage = synthesizeResearchPackageV1({
        retrievalMode: retrievalPolicy.mode === "live" ? "live" : "stub",
        retrievalPartial,
        retrievalPartialNotes,
        storyTitle: rj2.story.title,
        sources: sourcesForSynthesis.map((s) => ({
          id: s.id,
          positionIndex: s.positionIndex,
          sourceUrl: s.sourceUrl,
          sourceTitle: s.sourceTitle,
          excerpt: s.excerpt,
          relevanceNote: s.relevanceNote,
          reliabilityTier: s.reliabilityTier,
        })),
      });

      await tx.researchArtifact.update({
        where: { researchJobId: rj2.id },
        data: { researchSynthesisPackage: synthesisPackage as unknown as Prisma.InputJsonValue },
      });
    }

    const assemblyExists = await tx.chronologyAssembly.findUnique({
      where: { researchJobId: rj2.id },
    });
    if (!assemblyExists) {
      const art = await tx.researchArtifact.findUniqueOrThrow({
        where: { researchJobId: rj2.id },
      });
      const sources = await tx.researchCandidateSource.findMany({
        where: { researchJobId: rj2.id },
        orderBy: { positionIndex: "asc" },
      });
      const rows = buildChronologyEventsFromResearchPackage(
        {
          evidencePackageSummary: art.evidencePackageSummary,
          candidateEventHints: art.candidateEventHints,
          riskFlags: art.riskFlags,
          researchSynthesisPackage: art.researchSynthesisPackage,
        },
        sources.map((s) => ({
          id: s.id,
          positionIndex: s.positionIndex,
          sourceTitle: s.sourceTitle,
          excerpt: s.excerpt,
          relevanceNote: s.relevanceNote,
          reliabilityTier: s.reliabilityTier,
        })),
      );
      await tx.chronologyAssembly.create({
        data: {
          researchJobId: rj2.id,
          storyId: rj2.storyId,
          extractionVersion: CHRONOLOGY_EXTRACTION_VERSION,
          events: {
            create: rows.map((row, idx) => ({
              positionIndex: idx,
              headline: row.headline,
              summary: row.summary,
              creatorNote: row.creatorNote,
              eventType: row.eventType,
              contextLabel: row.contextLabel,
              significanceLevel: row.significanceLevel,
              eventDateStart: row.eventDateStart,
              eventDateEnd: row.eventDateEnd,
              eventDatePrecision: row.eventDatePrecision,
              displayDate: row.displayDate,
              yearAnchor: row.yearAnchor,
              intervalNote: row.intervalNote,
              locationName: row.locationName,
              mediaKind: row.mediaKind,
              sourceDensity: row.sourceDensity,
              confidenceState: row.confidenceState,
              claimRiskLevel: row.claimRiskLevel,
              supportingCandidateSourceIds: row.supportingCandidateSourceIds as unknown as Prisma.InputJsonValue,
              ambiguityNote: row.ambiguityNote,
            })),
          },
        },
      });
    }

    await ensureChronologyEventSourceLinks(tx, {
      researchJobId: rj2.id,
      storyId: rj2.storyId,
    });

    const assemblyWithEvents = await tx.chronologyAssembly.findUnique({
      where: { researchJobId: rj2.id },
      include: { events: { orderBy: { positionIndex: "asc" } } },
    });
    if (!assemblyWithEvents) {
      throw new Error(`invariant: chronology assembly missing for research job ${rj2.id}`);
    }

    const artForEnrichment = await tx.researchArtifact.findUniqueOrThrow({
      where: { researchJobId: rj2.id },
    });

    const toStringIds = (raw: unknown): string[] => {
      if (!Array.isArray(raw)) return [];
      return raw.filter((x): x is string => typeof x === "string");
    };

    const draftEnrichment = buildDraftEnrichmentPackageV1({
      storyId: rj2.storyId,
      researchJobId: rj2.id,
      storyTitle: rj2.story.title,
      researchSynthesisPackage: artForEnrichment.researchSynthesisPackage,
      chronologyExtractionVersion: CHRONOLOGY_EXTRACTION_VERSION,
      chronologyEvents: assemblyWithEvents.events.map((e) => ({
        id: e.id,
        positionIndex: e.positionIndex,
        headline: e.headline,
        summary: e.summary,
        contextLabel: e.contextLabel,
        eventType: e.eventType,
        supportingCandidateSourceIds: toStringIds(e.supportingCandidateSourceIds),
        ambiguityNote: e.ambiguityNote,
        creatorNote: e.creatorNote,
        claimRiskLevel: e.claimRiskLevel,
        confidenceState: e.confidenceState,
      })),
    });

    await tx.researchArtifact.update({
      where: { researchJobId: rj2.id },
      data: { draftEnrichmentPackage: draftEnrichment as unknown as Prisma.InputJsonValue },
    });

    await tx.researchJob.update({
      where: { id: researchJobId },
      data: {
        status: "succeeded",
        finishedAt: new Date(),
      },
    });

    await tx.story.update({
      where: { id: rj2.storyId },
      data: { workflowState: targetState },
    });

    const after = await tx.story.findUniqueOrThrow({
      where: { id: rj2.storyId },
      select: { workflowState: true },
    });

    if (wfDuring !== after.workflowState) {
      await tx.storyWorkflowTransition.create({
        data: {
          storyId: rj2.storyId,
          fromWorkflowState: wfDuring,
          toWorkflowState: after.workflowState,
          actorType: "system",
          actorId: null,
          trigger: "research_job_complete",
        },
      });
    }
  });
}
