import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from "node:crypto";
import type { BecknAuthHeaderComponents } from "@niva/types";

// Standard PKCS#8 & SPKI DER prefixes for Ed25519 raw 32-byte keys
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export interface GeneratedOndcKeyPair {
  publicKeyBase64: string;
  privateKeyBase64: string;
}

/**
 * Generate Ed25519 key pair in ONDC raw 32-byte base64 format.
 */
export function generateOndcSigningKeyPair(): GeneratedOndcKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pubDer = publicKey.export({ type: "spki", format: "der" });
  const privDer = privateKey.export({ type: "pkcs8", format: "der" });

  const rawPub = pubDer.subarray(12);
  const rawPriv = privDer.subarray(16);

  return {
    publicKeyBase64: rawPub.toString("base64"),
    privateKeyBase64: rawPriv.toString("base64"),
  };
}

/**
 * Computes BLAKE-512 digest in base64 format as required by Beckn / ONDC.
 */
export function createBlake512Digest(payload: string | Buffer): string {
  const buf = typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
  return createHash("blake2b512").update(buf).digest("base64");
}

/**
 * Constructs the canonical signing string according to Beckn protocol specification:
 * (created): {created}
 * (expires): {expires}
 * digest: BLAKE-512={digest}
 */
export function buildBecknSigningString(
  digestBase64: string,
  created: number,
  expires: number,
): string {
  return `(created): ${created}\n(expires): ${expires}\ndigest: BLAKE-512=${digestBase64}`;
}

/**
 * Parses Beckn Authorization header into keyId, algorithm, created, expires, headers, signature.
 * Format:
 * Signature keyId="...",algorithm="ed25519",created="123",expires="456",headers="(created) (expires) digest",signature="..."
 */
export function parseBecknAuthHeader(header: string): BecknAuthHeaderComponents | null {
  if (!header.startsWith("Signature ")) {
    return null;
  }
  const content = header.slice("Signature ".length);
  const regex = /([a-zA-Z0-9_]+)="([^"]*)"/g;
  const parts: Record<string, string> = {};
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    parts[match[1]!] = match[2]!;
  }

  if (
    !parts.keyId ||
    !parts.algorithm ||
    !parts.created ||
    !parts.expires ||
    !parts.headers ||
    !parts.signature
  ) {
    return null;
  }

  return {
    keyId: parts.keyId,
    algorithm: parts.algorithm,
    created: Number.parseInt(parts.created, 10),
    expires: Number.parseInt(parts.expires, 10),
    headers: parts.headers,
    signature: parts.signature,
  };
}

/**
 * Creates Beckn Authorization header string.
 */
export function createBecknAuthHeader(params: {
  subscriberId: string;
  uniqueKeyId: string;
  privateKeyBase64: string;
  payload: string | Buffer;
  ttlSeconds?: number;
}): string {
  const ttl = params.ttlSeconds ?? 300;
  const created = Math.floor(Date.now() / 1000);
  const expires = created + ttl;
  const digest = createBlake512Digest(params.payload);
  const signingString = buildBecknSigningString(digest, created, expires);

  const rawPriv = Buffer.from(params.privateKeyBase64, "base64");
  const privateKey = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, rawPriv]),
    format: "der",
    type: "pkcs8",
  });

  const signature = sign(null, Buffer.from(signingString, "utf8"), privateKey).toString("base64");
  const keyId = `${params.subscriberId}|${params.uniqueKeyId}|ed25519`;

  return `Signature keyId="${keyId}",algorithm="ed25519",created="${created}",expires="${expires}",headers="(created) (expires) digest",signature="${signature}"`;
}

/**
 * Verifies a Beckn request authorization header against payload and sender public key.
 */
export function verifyBecknAuthHeader(params: {
  authHeader: string;
  payload: string | Buffer;
  publicKeyBase64: string;
  allowedTimeDriftSeconds?: number;
}): boolean {
  const parsed = parseBecknAuthHeader(params.authHeader);
  if (!parsed) {
    return false;
  }

  if (parsed.algorithm !== "ed25519") {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const drift = params.allowedTimeDriftSeconds ?? 60;
  if (now > parsed.expires + drift || now < parsed.created - drift) {
    return false;
  }

  const digest = createBlake512Digest(params.payload);
  const expectedSigningString = buildBecknSigningString(digest, parsed.created, parsed.expires);

  try {
    const rawPub = Buffer.from(params.publicKeyBase64, "base64");
    const publicKey = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, rawPub]),
      format: "der",
      type: "spki",
    });

    const sigBuf = Buffer.from(parsed.signature, "base64");
    return verify(null, Buffer.from(expectedSigningString, "utf8"), publicKey, sigBuf);
  } catch {
    return false;
  }
}

