import { createHmac, randomInt } from "node:crypto";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;

export function generateNumericOtp(length = OTP_LENGTH): string {
  const max = 10 ** length;
  return randomInt(0, max).toString().padStart(length, "0");
}

export function hashOtp(otp: string, pepper: string, context: string): string {
  return createHmac("sha256", pepper).update(`${context}:${otp}`).digest("hex");
}

export function otpMatches(
  otp: string,
  pepper: string,
  context: string,
  codeHash: string,
): boolean {
  return hashOtp(otp, pepper, context) === codeHash;
}
