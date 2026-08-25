import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateNumericOtp, hashOtp, otpMatches } from "./otp.js";

describe("numeric OTP", () => {
  it("generates a 6-digit code", () => {
    const otp = generateNumericOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("stores an HMAC hash, not the plaintext code", () => {
    const otp = "123456";
    const pepper = "otp-pepper-min-32-characters-long!!";
    const hashed = hashOtp(otp, pepper, "user-1");
    expect(hashed).toHaveLength(64);
    expect(hashed).not.toBe(otp);
    expect(hashed).not.toContain(otp);
    expect(hashed).toBe(
      createHmac("sha256", pepper).update("user-1:123456").digest("hex"),
    );
    expect(otpMatches(otp, pepper, "user-1", hashed)).toBe(true);
    expect(otpMatches("000000", pepper, "user-1", hashed)).toBe(false);
  });
});
