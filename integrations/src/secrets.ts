import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function keyFromKek(kek: string): Buffer {
  return createHash("sha256").update(kek, "utf8").digest();
}

/** AES-256-GCM. Output is base64(iv || ciphertext || tag). */
export function encryptSecret(plaintext: string, kek: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", keyFromKek(kek), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64");
}

export function decryptSecret(payload: string, kek: string): string {
  const buffer = Buffer.from(payload, "base64");
  if (buffer.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("INVALID_SECRET_PAYLOAD");
  }
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(buffer.length - TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH, buffer.length - TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", keyFromKek(kek), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function maskCredentialRecord(record: Record<string, string>): Record<string, boolean> {
  const masked: Record<string, boolean> = {};
  for (const key of Object.keys(record).sort()) {
    masked[key] = record[key]!.length > 0;
  }
  return masked;
}
