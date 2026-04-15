/**
 * Background job worker (M0-T07 / M2-T01): BullMQ consumer for research orchestration.
 * M2-T02: persist research artifact + candidate sources before marking job succeeded.
 */
import { PrismaClient } from "@prisma/client";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { API_CONTRACT_VERSION } from "@storywall/shared";
import { buildM2T02PersistPayload } from "./m2-t02-stub.js";

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
