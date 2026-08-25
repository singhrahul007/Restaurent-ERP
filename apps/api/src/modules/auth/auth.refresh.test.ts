import { and, eq, isNull } from "drizzle-orm";
import { parseApiEnv } from "@niva/config";
import { createDatabase, sessions, users } from "@niva/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./auth.cookies.js";

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

describe.skipIf(!hasDatabase)("POST /api/v1/auth/refresh", () => {
  const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const email = `refresh-${Date.now()}@example.com`;
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

  it("rotates the refresh cookie and revokes the family on reuse", async () => {
    const app = await buildApp({ env, sql, db });

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);
    const firstRefresh = login.cookies.find((cookie) => cookie.name === REFRESH_COOKIE);
    expect(firstRefresh?.value).toBeTruthy();

    const rotated = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: cookieHeader(login.cookies, [REFRESH_COOKIE]),
      },
    });
    expect(rotated.statusCode).toBe(200);
    expect(rotated.json().data.ok).toBe(true);
    const secondRefresh = rotated.cookies.find((cookie) => cookie.name === REFRESH_COOKIE);
    const secondAccess = rotated.cookies.find((cookie) => cookie.name === ACCESS_COOKIE);
    expect(secondRefresh?.httpOnly).toBe(true);
    expect(secondRefresh?.value).toBeTruthy();
    expect(secondRefresh?.value).not.toBe(firstRefresh?.value);
    expect(secondAccess?.value).toBeTruthy();

    const reuse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: cookieHeader(login.cookies, [REFRESH_COOKIE]),
      },
    });
    expect(reuse.statusCode).toBe(401);
    expect(reuse.json().error.code).toBe("UNAUTHORIZED");

    const afterReuse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: cookieHeader(rotated.cookies, [REFRESH_COOKIE]),
      },
    });
    expect(afterReuse.statusCode).toBe(401);

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const active = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, user!.id), isNull(sessions.revokedAt)));
    expect(active).toHaveLength(0);

    await app.close();
  });

  it("rejects a missing refresh cookie", async () => {
    const app = await buildApp({ env, sql, db });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
