import { eq } from "drizzle-orm";
import { parseApiEnv } from "@niva/config";
import { auditLogs, createDatabase, users } from "@niva/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./auth.cookies.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("auth login and password reset", () => {
  const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const email = `login-${Date.now()}@example.com`;
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

  it("sets httpOnly cookies on login and rejects unknown credentials uniformly", async () => {
    const app = await buildApp({ env, sql, db });

    const unknown = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "nobody@example.com", password },
    });
    const wrong = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: "wrong-password-1" },
    });
    expect(unknown.statusCode).toBe(401);
    expect(wrong.statusCode).toBe(401);
    expect(unknown.json().error).toEqual(wrong.json().error);

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().data.user.email).toBe(email);
    const cookieNames = login.cookies.map((cookie) => cookie.name);
    expect(cookieNames).toContain(ACCESS_COOKIE);
    expect(cookieNames).toContain(REFRESH_COOKIE);
    const access = login.cookies.find((cookie) => cookie.name === ACCESS_COOKIE);
    expect(access?.httpOnly).toBe(true);

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const [loginAudit] = await db
      .select({
        action: auditLogs.action,
        metadata: auditLogs.metadata,
      })
      .from(auditLogs)
      .where(eq(auditLogs.actorId, user!.id))
      .limit(1);
    expect(loginAudit?.action).toBe("LOGIN");
    expect(loginAudit?.metadata).toEqual({ email });
    expect(JSON.stringify(loginAudit?.metadata)).not.toContain("password");
    expect(JSON.stringify(loginAudit?.metadata)).not.toContain(password);

    await app.close();
  });

  it("issues a reset token in non-production and accepts a new password", async () => {
    const app = await buildApp({ env, sql, db });

    const forgotUnknown = await app.inject({
      method: "POST",
      url: "/api/v1/auth/forgot-password",
      payload: { email: "nobody@example.com" },
    });
    expect(forgotUnknown.statusCode).toBe(200);
    expect(forgotUnknown.json().data.ok).toBe(true);
    expect(forgotUnknown.json().data.resetToken).toBeUndefined();

    const forgot = await app.inject({
      method: "POST",
      url: "/api/v1/auth/forgot-password",
      payload: { email },
    });
    expect(forgot.statusCode).toBe(200);
    const resetToken = forgot.json().data.resetToken as string;
    expect(resetToken).toBeTruthy();

    const reset = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: { token: resetToken, password: "newpassword9" },
    });
    expect(reset.statusCode).toBe(200);

    const oldLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(oldLogin.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: "newpassword9" },
    });
    expect(newLogin.statusCode).toBe(200);

    await app.close();
  });
});
