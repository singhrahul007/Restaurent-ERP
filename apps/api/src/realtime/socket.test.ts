import { describe, expect, it } from "vitest";
import { authorizeSocketHandshake } from "./socket.js";
import { parseApiEnv } from "@niva/config";
import { signAccessToken } from "../modules/auth/auth.cookies.js";

describe("authorizeSocketHandshake", () => {
  it("rejects missing tokens", async () => {
    await expect(authorizeSocketHandshake({ auth: {}, headers: {} }, parseApiEnv({
      ...process.env,
      NODE_ENV: "test",
    }))).rejects.toThrow("UNAUTHORIZED");
  });

  it("accepts a signed access token", async () => {
    const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
    const token = await signAccessToken(env, "11111111-1111-4111-8111-111111111111");
    const result = await authorizeSocketHandshake({ auth: { token }, headers: {} }, env);
    expect(result.userId).toBe("11111111-1111-4111-8111-111111111111");
  });
});
