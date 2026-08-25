import { describe, expect, it } from "vitest";
import {
  forgotPasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
} from "./auth.js";

describe("registerBodySchema", () => {
  it("normalizes email to lowercase", () => {
    const parsed = registerBodySchema.parse({
      email: "  Owner@Example.com ",
      password: "longenough",
    });
    expect(parsed.email).toBe("owner@example.com");
  });

  it("rejects short passwords", () => {
    const result = registerBodySchema.safeParse({
      email: "a@b.co",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(
      registerBodySchema.safeParse({
        email: "not-an-email",
        password: "longenough",
      }).success,
    ).toBe(false);
  });
});

describe("loginBodySchema", () => {
  it("accepts a valid login payload", () => {
    const parsed = loginBodySchema.parse({
      email: "Owner@Example.com",
      password: "longenough",
    });
    expect(parsed.email).toBe("owner@example.com");
  });

  it("rejects a short password", () => {
    expect(
      loginBodySchema.safeParse({
        email: "owner@example.com",
        password: "short",
      }).success,
    ).toBe(false);
  });
});

describe("forgotPasswordBodySchema", () => {
  it("accepts an email only", () => {
    expect(
      forgotPasswordBodySchema.parse({ email: "Owner@Example.com" }).email,
    ).toBe("owner@example.com");
  });
});

describe("resetPasswordBodySchema", () => {
  it("requires a token and a long enough password", () => {
    expect(
      resetPasswordBodySchema.safeParse({
        token: "abc",
        password: "short",
      }).success,
    ).toBe(false);
    expect(
      resetPasswordBodySchema.parse({
        token: "opaque-token",
        password: "longenough",
      }).token,
    ).toBe("opaque-token");
  });
});

