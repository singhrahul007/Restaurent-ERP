import { describe, expect, it } from "vitest";
import { hashPassword } from "./password.js";
import { verifyPasswordAgainstKnownOrDummy } from "./password-timing.js";

describe("verifyPasswordAgainstKnownOrDummy", () => {
  it("returns false for an unknown user without skipping Argon2", async () => {
    await expect(
      verifyPasswordAgainstKnownOrDummy(undefined, "longenough1"),
    ).resolves.toBe(false);
  });

  it("returns true when the stored hash matches", async () => {
    const passwordHash = await hashPassword("longenough1");
    await expect(
      verifyPasswordAgainstKnownOrDummy(passwordHash, "longenough1"),
    ).resolves.toBe(true);
  });
});
