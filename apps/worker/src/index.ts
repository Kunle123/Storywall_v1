/**
 * Background job worker (M0-T07 / M2-T01): BullMQ consumer for research orchestration.
 * M2-T02: persist research artifact + candidate sources before marking job succeeded.
 * M2-T03: assemble chronology (extracted events) from the research package.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import {
  API_CONTRACT_VERSION,
  buildChronologyEventsFromResearchPackage,
  CHRONOLOGY_EXTRACTION_VERSION,
} from "@storywall/shared";
import { buildM2T02PersistPayload } from "./m2-t02-stub.js";
import { ensureChronologyEventSourceLinks } from "./m2-t04-persist-links.js";

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

const queueName = "storywall-default";

const prisma = new PrismaClient();

const worker = new Worker(
  queueName,
  async (job) => {
    if (job.name === "research.run") {
      const { researchJobId } = job.data as { researchJobId: string };

      await prisma.$transaction(async (tx) => {
        const rj = await tx.researchJob.findUnique({
          where: { id: researchJobId },
          include: {
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
          },
        });
        if (!rj) {
          return;
        }
        if (rj.status === "succeeded" || rj.status === "failed" || rj.status === "cancelled") {
          return;
        }

        const wfDuring = rj.story.workflowState;
        const targetState = rj.preResearchWorkflowState;

        if (rj.status === "pending") {
          await tx.researchJob.update({
            where: { id: researchJobId },
            data: { status: "running", startedAt: new Date() },
          });
        }

        const existingArtifact = await tx.researchArtifact.findUnique({
          where: { researchJobId: rj.id },
        });
        if (!existingArtifact) {
          const payload = buildM2T02PersistPayload(rj);
          await tx.researchArtifact.create({
            data: {
              researchJobId: rj.id,
              storyId: rj.storyId,
              evidencePackageSummary: payload.evidencePackageSummary,
              candidateEventHints: payload.candidateEventHints,
              riskFlags: payload.riskFlags,
              confidencePosture: payload.confidencePosture,
            },
          });
          await tx.researchCandidateSource.createMany({
            data: payload.candidateSources,
          });
        }

        const assemblyExists = await tx.chronologyAssembly.findUnique({
          where: { researchJobId: rj.id },
        });
        if (!assemblyExists) {
          const art = await tx.researchArtifact.findUniqueOrThrow({
            where: { researchJobId: rj.id },
          });
          const sources = await tx.researchCandidateSource.findMany({
            where: { researchJobId: rj.id },
            orderBy: { positionIndex: "asc" },
          });
          const rows = buildChronologyEventsFromResearchPackage(
            {
              evidencePackageSummary: art.evidencePackageSummary,
              candidateEventHints: art.candidateEventHints,
              riskFlags: art.riskFlags,
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
              researchJobId: rj.id,
              storyId: rj.storyId,
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
          researchJobId: rj.id,
          storyId: rj.storyId,
        });

        await tx.researchJob.update({
          where: { id: researchJobId },
          data: {
            status: "succeeded",
            finishedAt: new Date(),
          },
        });

        await tx.story.update({
          where: { id: rj.storyId },
          data: { workflowState: targetState },
        });

        const after = await tx.story.findUniqueOrThrow({
          where: { id: rj.storyId },
          select: { workflowState: true },
        });

        if (wfDuring !== after.workflowState) {
          await tx.storyWorkflowTransition.create({
            data: {
              storyId: rj.storyId,
              fromWorkflowState: wfDuring,
              toWorkflowState: after.workflowState,
              actorType: "system",
              actorId: null,
              trigger: "research_job_complete",
            },
          });
        }
      });

      return { processed: true, researchJobId };
    }

    return { processed: true, jobId: job.id, name: job.name };
  },
  { connection },
);

worker.on("completed", (job) => {
  // eslint-disable-next-line no-console
  console.log(`[worker] completed job ${job.id}`);
});

worker.on("failed", (job, err) => {
  // eslint-disable-next-line no-console
  console.error(`[worker] failed job ${job?.id}`, err);
});

// eslint-disable-next-line no-console
console.log(
  `[storywall-worker] listening on queue "${queueName}" (api_version ${API_CONTRACT_VERSION}, redis ${redisUrl})`,
);

async function shutdown() {
  await worker.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
