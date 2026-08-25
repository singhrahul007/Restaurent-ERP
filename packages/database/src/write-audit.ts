import { auditLogs } from "./schema/audit-logs.js";
import type { Database } from "./client.js";

const SECRET_KEY_PATTERN =
  /^(password|passwordhash|authorization|cookie|token|secret|otp|totp)/i;

function normalizeKey(key: string): string {
  return key.replace(/[-_]/g, "");
}

function isSecretKey(key: string): boolean {
  const normalized = normalizeKey(key).toLowerCase();
  return (
    SECRET_KEY_PATTERN.test(normalized) ||
    normalized.includes("password") ||
    normalized.endsWith("token") ||
    normalized.endsWith("secret")
  );
}

export function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (isSecretKey(key)) {
      continue;
    }
    if (isPlainObject(value)) {
      sanitized[key] = sanitizeAuditMetadata(value);
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

export type WriteAuditInput = {
  actorId?: string | null;
  organizationId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(db: Database, input: WriteAuditInput): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: input.actorId ?? undefined,
    organizationId: input.organizationId ?? undefined,
    action: input.action,
    resourceType: input.resourceType ?? undefined,
    resourceId: input.resourceId ?? undefined,
    ip: input.ip ?? undefined,
    userAgent: input.userAgent ?? undefined,
    metadata: sanitizeAuditMetadata(input.metadata),
  });
}
