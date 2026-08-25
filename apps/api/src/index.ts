import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { Redis } from "ioredis";
import { loadApiEnv } from "@niva/config";
import { createDatabase } from "@niva/database";
import { buildApp } from "./app.js";
import { attachSocketIo } from "./realtime/socket.js";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
loadDotenv({ path: resolve(repoRoot, ".env") });

const env = loadApiEnv();
const { sql, db } = createDatabase(env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const app = await buildApp({ env, sql, db });
let closeRealtime: (() => void) | undefined;

const close = async () => {
  closeRealtime?.();
  await app.close();
  redis.disconnect();
  await sql.end();
};

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  const realtime = await attachSocketIo(app.server, redis);
  closeRealtime = realtime.close;
  app.log.info({ port: env.PORT }, "api listening");
} catch (error) {
  app.log.error({ err: error }, "failed to start api");
  await close();
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void close().then(() => process.exit(0));
  });
}
