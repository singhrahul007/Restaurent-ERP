import { and, desc, eq } from "drizzle-orm";
import {
  ondcSellerConfigs,
  ondcTransactions,
  type Database,
} from "@niva/database";

export interface UpsertOndcSellerConfigInput {
  organizationId: string;
  restaurantId: string;
  branchId: string;
  subscriberId: string;
  subscriberUrl: string;
  uniqueKeyId: string;
  signingPublicKey: string;
  signingPrivateKeyEncrypted: string;
  encryptionPublicKey?: string;
  encryptionPrivateKeyEncrypted?: string;
  providerLocationId?: string;
  domain?: string;
  cityCode?: string;
  country?: string;
  bppId?: string;
  bppUri?: string;
  gatewayUrl?: string;
  enabled?: boolean;
  autoAcceptOrders?: boolean;
  defaultPrepTimeMinutes?: number;
}

export interface InsertOndcTransactionInput {
  organizationId: string;
  transactionId: string;
  messageId: string;
  action: string;
  bapId: string;
  bapUri: string;
  bppId?: string;
  bppUri?: string;
  orderId?: string;
  ondcOrderId?: string;
  status?: "INITIATED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  requestPayload?: unknown;
  responsePayload?: unknown;
}

export function createOndcRepository(db: Database) {
  return {
    async findSellerConfigByBranch(organizationId: string, branchId: string) {
      const [row] = await db
        .select()
        .from(ondcSellerConfigs)
        .where(
          and(
            eq(ondcSellerConfigs.organizationId, organizationId),
            eq(ondcSellerConfigs.branchId, branchId),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async findSellerConfigBySubscriber(subscriberId: string) {
      const [row] = await db
        .select()
        .from(ondcSellerConfigs)
        .where(eq(ondcSellerConfigs.subscriberId, subscriberId))
        .limit(1);
      return row ?? null;
    },

    async upsertSellerConfig(input: UpsertOndcSellerConfigInput) {
      const [row] = await db
        .insert(ondcSellerConfigs)
        .values({
          organizationId: input.organizationId,
          restaurantId: input.restaurantId,
          branchId: input.branchId,
          subscriberId: input.subscriberId,
          subscriberUrl: input.subscriberUrl,
          uniqueKeyId: input.uniqueKeyId,
          signingPublicKey: input.signingPublicKey,
          signingPrivateKeyEncrypted: input.signingPrivateKeyEncrypted,
          encryptionPublicKey: input.encryptionPublicKey,
          encryptionPrivateKeyEncrypted: input.encryptionPrivateKeyEncrypted,
          providerLocationId: input.providerLocationId,
          domain: input.domain ?? "ONDC:RET11",
          cityCode: input.cityCode ?? "std:080",
          country: input.country ?? "IND",
          bppId: input.bppId,
          bppUri: input.bppUri,
          gatewayUrl: input.gatewayUrl,
          enabled: input.enabled ?? true,
          autoAcceptOrders: input.autoAcceptOrders ?? true,
          defaultPrepTimeMinutes: input.defaultPrepTimeMinutes ?? 30,
        })
        .onConflictDoUpdate({
          target: [ondcSellerConfigs.organizationId, ondcSellerConfigs.branchId],
          set: {
            subscriberId: input.subscriberId,
            subscriberUrl: input.subscriberUrl,
            uniqueKeyId: input.uniqueKeyId,
            signingPublicKey: input.signingPublicKey,
            signingPrivateKeyEncrypted: input.signingPrivateKeyEncrypted,
            encryptionPublicKey: input.encryptionPublicKey,
            encryptionPrivateKeyEncrypted: input.encryptionPrivateKeyEncrypted,
            providerLocationId: input.providerLocationId,
            domain: input.domain ?? "ONDC:RET11",
            cityCode: input.cityCode ?? "std:080",
            country: input.country ?? "IND",
            bppId: input.bppId,
            bppUri: input.bppUri,
            gatewayUrl: input.gatewayUrl,
            enabled: input.enabled ?? true,
            autoAcceptOrders: input.autoAcceptOrders ?? true,
            defaultPrepTimeMinutes: input.defaultPrepTimeMinutes ?? 30,
            updatedAt: new Date(),
          },
        })
        .returning();
      return row;
    },

    async recordTransaction(input: InsertOndcTransactionInput) {
      const [row] = await db
        .insert(ondcTransactions)
        .values({
          organizationId: input.organizationId,
          transactionId: input.transactionId,
          messageId: input.messageId,
          action: input.action,
          bapId: input.bapId,
          bapUri: input.bapUri,
          bppId: input.bppId,
          bppUri: input.bppUri,
          orderId: input.orderId,
          ondcOrderId: input.ondcOrderId,
          status: input.status ?? "INITIATED",
          requestPayload: input.requestPayload,
          responsePayload: input.responsePayload,
        })
        .onConflictDoUpdate({
          target: [
            ondcTransactions.transactionId,
            ondcTransactions.messageId,
            ondcTransactions.action,
          ],
          set: {
            orderId: input.orderId,
            ondcOrderId: input.ondcOrderId,
            status: input.status ?? "INITIATED",
            responsePayload: input.responsePayload,
          },
        })
        .returning();
      return row;
    },

    async findTransaction(transactionId: string, action?: string) {
      const conditions = [eq(ondcTransactions.transactionId, transactionId)];
      if (action) {
        conditions.push(eq(ondcTransactions.action, action));
      }
      return db
        .select()
        .from(ondcTransactions)
        .where(and(...conditions))
        .orderBy(desc(ondcTransactions.createdAt));
    },
  };
}

export type OndcRepository = ReturnType<typeof createOndcRepository>;

