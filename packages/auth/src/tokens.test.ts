import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateOpaqueToken, hashOpaqueToken } from "./tokens.js";

describe("opaque tokens", () => {
  it("hashes with SHA-256 hex and does not equal the raw token", () => {
    const token = generateOpaqueToken();
    const hashed = hashOpaqueToken(token);
    expect(hashed).toHaveLength(64);
    expect(hashed).not.toBe(token);
    expect(hashed).toBe(createHash("sha256").update(token).digest("hex"));
  });
});
