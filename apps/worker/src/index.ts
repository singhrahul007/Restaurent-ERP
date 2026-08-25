import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { createLogger, loadWorkerEnv } from "@niva/config";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
loadDotenv({ path: resolve(repoRoot, ".env") });

const env = loadWorkerEnv();
const logger = createLogger({ name: "worker", level: env.LOG_LEVEL });
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const queue = new Queue("health", { connection });
const worker = new Worker(
  "health",
  async (job) => {
    logger.info({ jobId: job.id, name: job.name }, "health ping");
    return { ok: true, at: new Date().toISOString() };
  },
  { connection },
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "health ping completed");
});

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, err: error }, "health ping failed");
});

await queue.add("ping", {}, { jobId: `startup-ping-${Date.now()}` });
logger.info("worker started");

const shutdown = async () => {
  await worker.close();
  await queue.close();
  connection.disconnect();
};

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown().then(() => process.exit(0));
  });
}
