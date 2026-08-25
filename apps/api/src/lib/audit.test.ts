import { describe, expect, it } from "vitest";
import { sanitizeAuditMetadata } from "@niva/database";

describe("sanitizeAuditMetadata", () => {
  it("drops password and other secrets from metadata", () => {
    expect(
      sanitizeAuditMetadata({
        email: "owner@example.com",
        password: "longenough1",
        passwordHash: "$argon2id$v=19$...",
        token: "opaque-reset-token",
        nested: { cookie: "niva_access=abc", ip: "127.0.0.1" },
        resetToken: "should-not-persist",
      }),
    ).toEqual({
      email: "owner@example.com",
      nested: { ip: "127.0.0.1" },
    });
  });

  it("returns undefined when metadata is omitted", () => {
    expect(sanitizeAuditMetadata(undefined)).toBeUndefined();
  });
});
