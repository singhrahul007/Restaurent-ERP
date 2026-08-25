import { eq } from "drizzle-orm";
import { parseApiEnv } from "@niva/config";
import { createDatabase, users } from "@niva/database";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { ACCESS_COOKIE } from "../auth/auth.cookies.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("platform admin", () => {
  const adminEmail = `platform-${Date.now()}@example.com`;
  const env = parseApiEnv({
    ...process.env,
    NODE_ENV: "test",
    PLATFORM_ADMIN_EMAIL: adminEmail,
  });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const password = "longenough1";

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, adminEmail));
    await sql.end();
  });

  it("lets is_platform_admin list organizations and rejects others", async () => {
    const app = await buildApp({ env, sql, db });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: adminEmail, password },
    });
    expect(created.statusCode).toBe(201);

    await db
      .update(users)
      .set({ isPlatformAdmin: true })
      .where(eq(users.email, adminEmail));

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: adminEmail, password },
    });
    const cookie = login.cookies
      .filter((item) => item.name === ACCESS_COOKIE)
      .map((item) => `${item.name}=${item.value}`)
      .join("; ");

    const ping = await app.inject({
      method: "GET",
      url: "/api/v1/platform/ping",
      headers: { cookie },
    });
    expect(ping.statusCode).toBe(200);

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/platform/organizations",
      headers: { cookie },
    });
    expect(list.statusCode).toBe(200);
    expect(Array.isArray(list.json().data.organizations)).toBe(true);

    await app.close();
  });
});
