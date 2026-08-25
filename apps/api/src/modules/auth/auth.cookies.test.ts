import { describe, expect, it } from "vitest";
import type { ApiEnv } from "@niva/config";
import { signAccessToken, verifyAccessToken } from "./auth.cookies.js";

const env = {
  JWT_ACCESS_SECRET: "local-dev-jwt-access-secret-min-32-chars",
} as ApiEnv;

const userId = "33333333-3333-3333-3333-333333333333";

describe("verifyAccessToken", () => {
  it("returns missing when the cookie is absent", async () => {
    await expect(verifyAccessToken(env, undefined)).resolves.toEqual({
      ok: false,
      reason: "missing",
    });
  });

  it("returns the subject for a valid token", async () => {
    const token = await signAccessToken(env, userId);
    await expect(verifyAccessToken(env, token)).resolves.toEqual({
      ok: true,
      userId,
    });
  });

  it("returns expired for a past exp", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signAccessToken(env, userId, now - 30, now - 90);
    await expect(verifyAccessToken(env, token)).resolves.toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("returns invalid for a forged token", async () => {
    await expect(verifyAccessToken(env, "not-a-jwt")).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});
