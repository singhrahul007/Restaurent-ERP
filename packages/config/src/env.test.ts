import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { parseApiEnv } from "./env.js";
import { createLogger } from "./logger.js";

describe("parseApiEnv", () => {
  it("fails closed when DATABASE_URL is missing", () => {
    expect(() =>
      parseApiEnv({
        REDIS_URL: "redis://localhost:6379",
        S3_ENDPOINT: "http://localhost:9000",
        S3_ACCESS_KEY: "niva",
        S3_SECRET_KEY: "nivalocalpass",
        S3_BUCKET: "niva",
        JWT_ACCESS_SECRET: "local-dev-jwt-access-secret-min-32-chars",
      }),
    ).toThrow(/DATABASE_URL/);
  });
});

describe("createLogger", () => {
  it("redacts password, authorization, and cookie", async () => {
    let output = "";
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });

    const logger = createLogger({ name: "test", destination, level: "info" });
    logger.info(
      {
        password: "super-secret",
        authorization: "Bearer secret-token",
        cookie: "refresh=secret",
      },
      "sensitive",
    );

    await new Promise((resolve) => setImmediate(resolve));

    expect(output).toContain("[Redacted]");
    expect(output).not.toContain("super-secret");
    expect(output).not.toContain("secret-token");
    expect(output).not.toContain("refresh=secret");
  });
});
