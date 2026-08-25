import { eq } from "drizzle-orm";
import { parseApiEnv } from "@niva/config";
import { createDatabase, users } from "@niva/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { ACCESS_COOKIE, signAccessToken } from "./auth.cookies.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);

function cookieHeader(
  cookies: Array<{ name: string; value: string }>,
  names: string[],
): string {
  return cookies
    .filter((cookie) => names.includes(cookie.name))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

describe.skipIf(!hasDatabase)("GET /api/v1/auth/me", () => {
  const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const email = `me-${Date.now()}@example.com`;
  const password = "longenough1";

  beforeAll(async () => {
    const app = await buildApp({ env, sql, db });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });
    expect(created.statusCode).toBe(201);
    await app.close();
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, email));
    await sql.end();
  });

  it("returns the current user from the access cookie", async () => {
    const app = await buildApp({ env, sql, db });
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        cookie: cookieHeader(login.cookies, [ACCESS_COOKIE]),
      },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      success: true,
      data: {
        user: { email, status: "PENDING_VERIFICATION" },
        memberships: [],
        permissions: [],
      },
    });
    expect(me.json().data.user.id).toBeTruthy();
    expect(me.json().data.user.passwordHash).toBeUndefined();

    await app.close();
  });

  it("rejects a missing access cookie", async () => {
    const app = await buildApp({ env, sql, db });
    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });
    expect(me.statusCode).toBe(401);
    expect(me.json()).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
    await app.close();
  });

  it("rejects an expired access token", async () => {
    const app = await buildApp({ env, sql, db });
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const expired = await signAccessToken(
      env,
      user!.id,
      Math.floor(Date.now() / 1000) - 30,
      Math.floor(Date.now() / 1000) - 90,
    );

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        cookie: `${ACCESS_COOKIE}=${expired}`,
      },
    });
    expect(me.statusCode).toBe(401);
    expect(me.json()).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Access token expired" },
    });
    await app.close();
  });
});
