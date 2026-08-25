import { describe, expect, it } from "vitest";
import { parseApiEnv } from "@niva/config";
import { MinioObjectStorage } from "./minio.adapter.js";

const hasMinioEnv = Boolean(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY);

function isUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return String(error).includes("ECONNREFUSED");
  }
  const rec = error as { code?: string; message?: string; errors?: unknown[] };
  if (rec.code === "ECONNREFUSED" || rec.code === "ENOTFOUND") {
    return true;
  }
  if (rec.message?.includes("ECONNREFUSED") || rec.message?.includes("ENOTFOUND")) {
    return true;
  }
  return rec.errors?.some(isUnavailable) ?? false;
}

describe.skipIf(!hasMinioEnv)("MinioObjectStorage", () => {
  it("uploads a single byte", async (ctx) => {
    const env = parseApiEnv(process.env);
    const storage = MinioObjectStorage.fromEnv(env);
    const key = `health/${Date.now()}.bin`;
    try {
      await storage.putObject({ key, body: Buffer.from([1]) });
    } catch (error) {
      if (isUnavailable(error)) {
        ctx.skip();
        return;
      }
      throw error;
    }
    const url = await storage.getPresignedGetUrl({
      key,
      expiresInSeconds: 60,
    });
    expect(url).toContain(env.S3_BUCKET);
  });
});
