import { describe, expect, it } from "vitest";
import {
  createBecknAuthHeader,
  createBlake512Digest,
  generateOndcSigningKeyPair,
  parseBecknAuthHeader,
  verifyBecknAuthHeader,
} from "./crypto.js";

describe("ONDC Beckn Cryptography", () => {
  it("generates 32-byte Ed25519 keypair in base64", () => {
    const keyPair = generateOndcSigningKeyPair();
    const pubBuf = Buffer.from(keyPair.publicKeyBase64, "base64");
    const privBuf = Buffer.from(keyPair.privateKeyBase64, "base64");

    expect(pubBuf.length).toBe(32);
    expect(privBuf.length).toBe(32);
  });

  it("calculates BLAKE-512 digest", () => {
    const payload = JSON.stringify({ test: "hello ondc" });
    const digest = createBlake512Digest(payload);
    expect(digest).toBeTypeOf("string");
    expect(Buffer.from(digest, "base64").length).toBe(64);
  });

  it("signs and verifies Beckn authorization headers", () => {
    const keyPair = generateOndcSigningKeyPair();
    const payload = JSON.stringify({
      context: {
        domain: "ONDC:RET11",
        action: "search",
        transaction_id: "tx-123",
      },
    });

    const header = createBecknAuthHeader({
      subscriberId: "seller.niva.app",
      uniqueKeyId: "key-1",
      privateKeyBase64: keyPair.privateKeyBase64,
      payload,
    });

    const parsed = parseBecknAuthHeader(header);
    expect(parsed).not.toBeNull();
    expect(parsed?.keyId).toBe("seller.niva.app|key-1|ed25519");
    expect(parsed?.algorithm).toBe("ed25519");

    const isValid = verifyBecknAuthHeader({
      authHeader: header,
      payload,
      publicKeyBase64: keyPair.publicKeyBase64,
    });
    expect(isValid).toBe(true);

    const isTampered = verifyBecknAuthHeader({
      authHeader: header,
      payload: JSON.stringify({ tampered: true }),
      publicKeyBase64: keyPair.publicKeyBase64,
    });
    expect(isTampered).toBe(false);
  });
});
