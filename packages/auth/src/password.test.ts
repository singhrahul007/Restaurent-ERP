import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("hashPassword / verifyPassword", () => {
  it("verifies a hash of the same password", async () => {
    const password = "correct-horse-battery";
    const passwordHash = await hashPassword(password);
    await expect(verifyPassword(passwordHash, password)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const passwordHash = await hashPassword("correct-horse-battery");
    await expect(verifyPassword(passwordHash, "wrong-password")).resolves.toBe(
      false,
    );
  });

  it("produces unique hashes for the same password (salt)", async () => {
    const password = "correct-horse-battery";
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
  });

  it("does not match a dummy hash string", async () => {
    const dummyHash =
      "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const realHash = await hashPassword("correct-horse-battery");
    expect(realHash).not.toBe(dummyHash);
    await expect(verifyPassword(dummyHash, "correct-horse-battery")).resolves.toBe(
      false,
    );
  });

  it("rejects empty passwords when hashing", async () => {
    await expect(hashPassword("")).rejects.toThrow("PASSWORD_INVALID_LENGTH");
  });
});
