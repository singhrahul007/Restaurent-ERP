import { and, eq, isNull } from "drizzle-orm";
import { parseApiEnv } from "@niva/config";
import { auditLogs, createDatabase, sessions, users } from "@niva/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { REFRESH_COOKIE } from "./auth.cookies.js";

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

describe.skipIf(!hasDatabase)("POST /api/v1/auth/logout", () => {
  const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const email = `logout-${Date.now()}@example.com`;
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

  it("revokes the current session so refresh fails, leaving other devices signed in", async () => {
    const app = await buildApp({ env, sql, db });

    const firstLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    const secondLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(firstLogin.statusCode).toBe(200);
    expect(secondLogin.statusCode).toBe(200);

    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie: cookieHeader(firstLogin.cookies, [REFRESH_COOKIE]),
      },
    });
    expect(logout.statusCode).toBe(200);
    expect(logout.json().data.ok).toBe(true);

    const refreshAfterLogout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: cookieHeader(firstLogin.cookies, [REFRESH_COOKIE]),
      },
    });
    expect(refreshAfterLogout.statusCode).toBe(401);

    const otherDevice = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: cookieHeader(secondLogin.cookies, [REFRESH_COOKIE]),
      },
    });
    expect(otherDevice.statusCode).toBe(200);

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const [logoutAudit] = await db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(and(eq(auditLogs.actorId, user!.id), eq(auditLogs.action, "LOGOUT")));
    expect(logoutAudit?.action).toBe("LOGOUT");

    await app.close();
  });

  it("succeeds without a session cookie", async () => {
    const app = await buildApp({ env, sql, db });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });
});

describe.skipIf(!hasDatabase)("POST /api/v1/auth/logout-all", () => {
  const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const email = `logout-all-${Date.now()}@example.com`;
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

  it("revokes every session so refresh fails on all devices", async () => {
    const app = await buildApp({ env, sql, db });

    const firstLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    const secondLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(firstLogin.statusCode).toBe(200);
    expect(secondLogin.statusCode).toBe(200);

    const logoutAll = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout-all",
      headers: {
        cookie: cookieHeader(firstLogin.cookies, [REFRESH_COOKIE]),
      },
    });
    expect(logoutAll.statusCode).toBe(200);

    const firstRefresh = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: cookieHeader(firstLogin.cookies, [REFRESH_COOKIE]),
      },
    });
    const secondRefresh = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: cookieHeader(secondLogin.cookies, [REFRESH_COOKIE]),
      },
    });
    expect(firstRefresh.statusCode).toBe(401);
    expect(secondRefresh.statusCode).toBe(401);

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
});
