/**
 * Background job worker (M0-T07 / M2-T01): BullMQ consumer for research orchestration.
 * M2-T02: persist research artifact + candidate sources before marking job succeeded.
 * M2-T03: assemble chronology (extracted events) from the research package.
 * M2-T05: full draft assembly from chronology into `event_draft` / `source_record`.
 */
import { PrismaClient } from "@prisma/client";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import {
  API_CONTRACT_VERSION,
  formatAiRuntimeBootstrapLogLine,
  formatPromptTemplateRegistryBootstrapLine,
  parseAiRuntimeConfigFromEnv,
} from "@storywall/shared";
import { runDraftAssemblyJob } from "./m2-t05-draft-assemble.js";
import { executeResearchRun, logRetrievalBootstrap } from "./research-run-job.js";

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

const queueName = "storywall-default";

const prisma = new PrismaClient();

const aiRuntimeSnapshot = parseAiRuntimeConfigFromEnv(process.env);
// eslint-disable-next-line no-console
console.log(`[storywall-worker] ${formatAiRuntimeBootstrapLogLine(aiRuntimeSnapshot)}`);
// eslint-disable-next-line no-console
console.log(`[storywall-worker] ${formatPromptTemplateRegistryBootstrapLine()}`);
logRetrievalBootstrap(process.env);

const worker = new Worker(
  queueName,
  async (job) => {
    if (job.name === "research.run") {
      const { researchJobId } = job.data as { researchJobId: string };
      await executeResearchRun(prisma, process.env, researchJobId);
      return { processed: true, researchJobId };
    }

    if (job.name === "draft.assemble") {
      const { draftAssemblyJobId } = job.data as { draftAssemblyJobId: string };

      await prisma.$transaction(async (tx) => {
        await runDraftAssemblyJob(tx, draftAssemblyJobId);
      });

      return { processed: true, draftAssemblyJobId };
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
