import { and, desc, eq } from "drizzle-orm";
import {
  integrationAccounts,
  integrationEvents,
  withOrganizationScope,
  type Database,
} from "@niva/database";

const accountSelect = {
  id: integrationAccounts.id,
  organizationId: integrationAccounts.organizationId,
  provider: integrationAccounts.provider,
  label: integrationAccounts.label,
  credentialsEncrypted: integrationAccounts.credentialsEncrypted,
  enabled: integrationAccounts.enabled,
  createdAt: integrationAccounts.createdAt,
  updatedAt: integrationAccounts.updatedAt,
};

export function createIntegrationRepository(db: Database) {
  return {
    listAccounts(organizationId: string) {
      return withOrganizationScope(db, organizationId, (tx) =>
        tx
          .select(accountSelect)
          .from(integrationAccounts)
          .where(eq(integrationAccounts.organizationId, organizationId))
          .orderBy(desc(integrationAccounts.createdAt)),
      );
    },

    upsertAccount(input: {
      organizationId: string;
      provider: string;
      label?: string;
      credentialsEncrypted: string;
      enabled?: boolean;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(integrationAccounts)
          .values({
            organizationId: input.organizationId,
            provider: input.provider,
            label: input.label,
            credentialsEncrypted: input.credentialsEncrypted,
            enabled: input.enabled,
          })
          .onConflictDoUpdate({
            target: [integrationAccounts.organizationId, integrationAccounts.provider],
            set: {
              label: input.label,
              credentialsEncrypted: input.credentialsEncrypted,
              enabled: input.enabled ?? true,
            },
          })
          .returning(accountSelect);
        if (!row) {
          throw new Error("INTEGRATION_ACCOUNT_UPSERT_FAILED");
        }
        return row;
      });
    },

    async insertEvent(input: {
      organizationId: string | null;
      provider: string;
      direction: "INBOUND" | "OUTBOUND";
      payloadJson: string;
    }) {
      if (!input.organizationId) {
        const [row] = await db
          .insert(integrationEvents)
          .values({
            organizationId: null,
            provider: input.provider,
            direction: input.direction,
            payloadJson: input.payloadJson,
          })
          .returning({ id: integrationEvents.id });
        return row;
      }
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(integrationEvents)
          .values({
            organizationId: input.organizationId,
            provider: input.provider,
            direction: input.direction,
            payloadJson: input.payloadJson,
          })
          .returning({ id: integrationEvents.id });
        return row;
      });
    },

    deleteAccount(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .delete(integrationAccounts)
          .where(
            and(
              eq(integrationAccounts.id, id),
              eq(integrationAccounts.organizationId, organizationId),
            ),
          )
          .returning({ id: integrationAccounts.id });
        return row ?? null;
      });
    },
  };
}

export type IntegrationRepository = ReturnType<typeof createIntegrationRepository>;
