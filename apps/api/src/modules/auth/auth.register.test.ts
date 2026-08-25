import { eq } from "drizzle-orm";
import { parseApiEnv } from "@niva/config";
import { createDatabase, users } from "@niva/database";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("POST /api/v1/auth/register", () => {
  const env = parseApiEnv(process.env);
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const email = `reg-${Date.now()}@example.com`;

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, email));
    await sql.end();
  });

  it("creates a user and rejects duplicate email with 409", async () => {
    const app = await buildApp({ env, sql, db });

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password: "longenough1" },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body.success).toBe(true);
    expect(body.data.email).toBe(email);
    expect(body.data.password).toBeUndefined();
    expect(body.data.passwordHash).toBeUndefined();

    const duplicate = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password: "longenough1" },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({
      success: false,
      error: { code: "CONFLICT" },
    });

    await app.close();
  });
});
