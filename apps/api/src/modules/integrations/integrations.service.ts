import {
  decryptSecret,
  encryptSecret,
  maskCredentialRecord,
  MockFoodDeliveryChannel,
  MockPaymentGateway,
} from "@niva/integrations";
import { writeAudit, type Database } from "@niva/database";
import type { UpsertIntegrationAccountBody } from "@niva/validation";
import { AppError } from "../../lib/errors.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import type { OrderService } from "../orders/orders.service.js";
import type { IntegrationRepository } from "./integrations.repository.js";

type AccountRow = {
  id: string;
  provider: string;
  label: string | null;
  credentialsEncrypted: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toPublic(row: AccountRow, kek: string) {
  let credentialsMasked: Record<string, boolean> = { configured: true };
  try {
    const parsed = JSON.parse(decryptSecret(row.credentialsEncrypted, kek)) as Record<
      string,
      string
    >;
    credentialsMasked = maskCredentialRecord(parsed);
  } catch {
    credentialsMasked = { configured: true };
  }
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    enabled: row.enabled,
    credentialsMasked,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createIntegrationService(
  integrations: IntegrationRepository,
  orders: OrderService,
  db: Database,
  kek: string,
) {
  const gateway = new MockPaymentGateway();
  const food = new MockFoodDeliveryChannel();

  return {
    async list(tenant: TenantContext) {
      const rows = await integrations.listAccounts(tenant.organizationId);
      return rows.map((row) => toPublic(row, kek));
    },

    async upsert(
      tenant: TenantContext,
      actorId: string,
      body: UpsertIntegrationAccountBody,
      context: { ip?: string; userAgent?: string },
    ) {
      const credentialsEncrypted = encryptSecret(JSON.stringify(body.credentials), kek);
      const row = await integrations.upsertAccount({
        organizationId: tenant.organizationId,
        provider: body.provider,
        label: body.label,
        credentialsEncrypted,
        enabled: body.enabled,
      });
      await writeAudit(db, {
        actorId,
        organizationId: tenant.organizationId,
        action: "INTEGRATION_CHANGED",
        resourceType: "integration_account",
        resourceId: row.id,
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { provider: body.provider },
      });
      return toPublic(row, kek);
    },

    async remove(tenant: TenantContext, id: string) {
      const row = await integrations.deleteAccount(tenant.organizationId, id);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
    },

    handleWebhook(
      provider: string,
      headers: Record<string, string | string[] | undefined>,
      rawBody: string,
    ) {
      if (provider !== "mock") {
        return { status: 404 as const, parsed: { accepted: false as const, reason: "unknown provider" } };
      }
      return { status: 200 as const, parsed: gateway.parseWebhook(headers, rawBody) };
    },

    ingestMock(tenant: TenantContext, actorId: string, restaurantId: string, raw: unknown) {
      try {
        const normalized = food.ingestOrder(raw);
        return orders.ingestPartnerOrder(tenant, actorId, restaurantId, normalized);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError("VALIDATION_ERROR", "Invalid partner payload", 400);
      }
    },

    recordEvent(
      organizationId: string | null,
      provider: string,
      direction: "INBOUND" | "OUTBOUND",
      payload: unknown,
    ) {
      return integrations.insertEvent({
        organizationId,
        provider,
        direction,
        payloadJson: JSON.stringify(payload),
      });
    },
  };
}
