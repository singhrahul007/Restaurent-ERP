import { describe, expect, it } from "vitest";
import { parseApiEnv } from "@niva/config";
import { createDatabase } from "@niva/database";
import { buildApp } from "../../app.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("auth OpenAPI", () => {
  it("lists auth routes in the generated spec and docs UI", async () => {
    const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
    const { sql, db } = createDatabase(env.DATABASE_URL);
    const app = await buildApp({ env, sql, db });
    await app.ready();

    const spec = app.swagger();
    const paths = Object.keys(spec.paths ?? {});
    expect(spec.tags?.some((tag) => tag.name === "auth")).toBe(true);
    expect(paths.some((path) => path.includes("/auth/register"))).toBe(true);
    expect(paths.some((path) => path.includes("/auth/login"))).toBe(true);
    expect(paths.some((path) => path.includes("/auth/refresh"))).toBe(true);
    expect(paths.some((path) => path.includes("/auth/logout"))).toBe(true);
    expect(paths.some((path) => path.includes("/auth/me"))).toBe(true);

    const docs = await app.inject({ method: "GET", url: "/api/v1/docs" });
    expect(docs.statusCode).toBe(200);
    expect(docs.body).toMatch(/swagger|openapi/i);

    await app.close();
    await sql.end();
  });
});
