/**
 * Background job worker (M0-T07 pattern): Redis-backed queue for AI research,
 * draft assembly, validation, and derived-field refresh per migration plan.
 */
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { API_CONTRACT_VERSION } from "@storywall/shared";

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

const queueName = "storywall-default";

const worker = new Worker(
  queueName,
  async (job) => {
    // Placeholder: job handlers implemented with M2/M3 tickets
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
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
