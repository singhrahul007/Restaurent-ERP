import { describe, expect, it } from "vitest";
import type { ApiEnv } from "@niva/config";
import type { AuthRepository } from "./auth.repository.js";
import { createAuthService } from "./auth.service.js";

const env = {
  NODE_ENV: "test",
  JWT_ACCESS_SECRET: "local-dev-jwt-access-secret-min-32-chars",
} as ApiEnv;

describe("createAuthService.register", () => {
  it("maps unique email violations to 409 CONFLICT", async () => {
    const service = createAuthService(
      {
        async insertUser() {
          throw { code: "23505" };
        },
      } as AuthRepository,
      env,
    );

    await expect(
      service.register({
        email: "owner@example.com",
        password: "longenough",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      statusCode: 409,
    });
  });

  it("persists an HMAC of the email OTP, not the plaintext code", async () => {
    const storedHashes: string[] = [];
    const logs: Array<Record<string, unknown>> = [];
    const service = createAuthService(
      {
        async insertUser() {
          return {
            id: "33333333-3333-3333-3333-333333333333",
            email: "owner@example.com",
            status: "PENDING_VERIFICATION",
          };
        },
        async invalidateUnusedEmailVerifications() {},
        async insertEmailVerification(input: { codeHash: string }) {
          storedHashes.push(input.codeHash);
        },
        async insertOtpChallenge(input: { codeHash: string }) {
          storedHashes.push(input.codeHash);
        },
      } as AuthRepository,
      env,
      {
        info(bindings) {
          logs.push(bindings);
        },
      },
    );

    await service.register({
      email: "owner@example.com",
      password: "longenough",
    });

    expect(storedHashes).toHaveLength(2);
    expect(storedHashes[0]).toBe(storedHashes[1]);
    expect(storedHashes[0]).toMatch(/^[a-f0-9]{64}$/);
    const loggedOtp = logs[0]?.otp;
    expect(loggedOtp).toMatch(/^\d{6}$/);
    expect(storedHashes[0]).not.toBe(loggedOtp);
  });
});

describe("createAuthService.login", () => {
  it("uses the same error for unknown email and wrong password", async () => {
    const service = createAuthService(
      {
        async findUserByEmail() {
          return null;
        },
      } as AuthRepository,
      env,
    );

    await expect(
      service.login(
        { email: "missing@example.com", password: "longenough" },
        {},
      ),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Invalid email or password",
      statusCode: 401,
    });
  });
});

describe("createAuthService.forgotPassword", () => {
  it("does not issue a token for an unknown email", async () => {
    const service = createAuthService(
      {
        async findUserByEmail() {
          return null;
        },
      } as AuthRepository,
      env,
    );

    await expect(
      service.forgotPassword({ email: "missing@example.com" }),
    ).resolves.toEqual({ issued: false });
  });
});

describe("createAuthService.refresh", () => {
  const familyId = "11111111-1111-1111-1111-111111111111";
  const sessionId = "22222222-2222-2222-2222-222222222222";
  const userId = "33333333-3333-3333-3333-333333333333";

  it("rejects a missing refresh token", async () => {
    const service = createAuthService({} as AuthRepository, env);
    await expect(service.refresh(undefined, {})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      statusCode: 401,
    });
  });

  it("revokes the session family when a rotated token is reused", async () => {
    const revokedFamilies: string[] = [];
    const audits: string[] = [];
    const service = createAuthService(
      {
        async findSessionByTokenHash() {
          return {
            id: sessionId,
            userId,
            familyId,
            device: null,
            userAgent: null,
            ip: null,
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: new Date(),
          };
        },
        async revokeFamilySessions(id: string) {
          revokedFamilies.push(id);
        },
        async writeAudit(input: { action: string }) {
          audits.push(input.action);
        },
      } as AuthRepository,
      env,
    );

    await expect(service.refresh("old-refresh-token", {})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      statusCode: 401,
    });
    expect(revokedFamilies).toEqual([familyId]);
    expect(audits).toEqual(["REFRESH_REUSE"]);
  });

  it("does not revoke the family for an expired active session", async () => {
    let familyRevoked = false;
    const service = createAuthService(
      {
        async findSessionByTokenHash() {
          return {
            id: sessionId,
            userId,
            familyId,
            device: null,
            userAgent: null,
            ip: null,
            expiresAt: new Date(Date.now() - 1000),
            revokedAt: null,
          };
        },
        async revokeFamilySessions() {
          familyRevoked = true;
        },
      } as AuthRepository,
      env,
    );

    await expect(service.refresh("expired-refresh-token", {})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      statusCode: 401,
    });
    expect(familyRevoked).toBe(false);
  });

  it("rotates onto a new session in the same family", async () => {
    const inserted: Array<{ familyId: string; tokenHash: string }> = [];
    const service = createAuthService(
      {
        async findSessionByTokenHash() {
          return {
            id: sessionId,
            userId,
            familyId,
            device: "pos",
            userAgent: "test",
            ip: "127.0.0.1",
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
          };
        },
        async findUserById() {
          return { id: userId, email: "owner@example.com", status: "ACTIVE" };
        },
        async revokeSessionIfActive() {
          return true;
        },
        async insertSession(input: { familyId: string; tokenHash: string }) {
          inserted.push({ familyId: input.familyId, tokenHash: input.tokenHash });
          return { id: "44444444-4444-4444-4444-444444444444" };
        },
      } as AuthRepository,
      env,
    );

    const result = await service.refresh("current-refresh-token", {});
    expect(result.refreshToken).toBeTruthy();
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).not.toBe("current-refresh-token");
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.familyId).toBe(familyId);
    expect(inserted[0]?.tokenHash).not.toBe(result.refreshToken);
  });
});

describe("createAuthService.logout", () => {
  const sessionId = "22222222-2222-2222-2222-222222222222";
  const userId = "33333333-3333-3333-3333-333333333333";

  it("is a no-op without a refresh token", async () => {
    const service = createAuthService({} as AuthRepository, env);
    await expect(service.logout(undefined, {})).resolves.toEqual({
      loggedOut: false,
    });
  });

  it("revokes the current session and audits LOGOUT", async () => {
    const revoked: string[] = [];
    const audits: string[] = [];
    const service = createAuthService(
      {
        async findSessionByTokenHash() {
          return {
            id: sessionId,
            userId,
            familyId: "11111111-1111-1111-1111-111111111111",
            device: null,
            userAgent: null,
            ip: null,
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
          };
        },
        async revokeSessionIfActive(id: string) {
          revoked.push(id);
          return true;
        },
        async writeAudit(input: { action: string }) {
          audits.push(input.action);
        },
      } as AuthRepository,
      env,
    );

    await expect(service.logout("current-refresh-token", {})).resolves.toEqual({
      loggedOut: true,
    });
    expect(revoked).toEqual([sessionId]);
    expect(audits).toEqual(["LOGOUT"]);
  });
});

describe("createAuthService.logoutAll", () => {
  const userId = "33333333-3333-3333-3333-333333333333";

  it("revokes every session for the user and audits LOGOUT_ALL", async () => {
    const revokedUsers: string[] = [];
    const audits: string[] = [];
    const service = createAuthService(
      {
        async findSessionByTokenHash() {
          return {
            id: "22222222-2222-2222-2222-222222222222",
            userId,
            familyId: "11111111-1111-1111-1111-111111111111",
            device: null,
            userAgent: null,
            ip: null,
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
          };
        },
        async revokeUserSessions(id: string) {
          revokedUsers.push(id);
        },
        async writeAudit(input: { action: string }) {
          audits.push(input.action);
        },
      } as AuthRepository,
      env,
    );

    await expect(service.logoutAll("current-refresh-token", {})).resolves.toEqual({
      loggedOut: true,
    });
    expect(revokedUsers).toEqual([userId]);
    expect(audits).toEqual(["LOGOUT_ALL"]);
  });
});
