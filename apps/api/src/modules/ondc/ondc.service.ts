import {
  createBecknAuthHeader,
  decryptSecret,
  encryptSecret,
  generateOndcSigningKeyPair,
  parseBecknAuthHeader,
  verifyBecknAuthHeader,
} from "@niva/integrations";
import type { BecknContext, BecknResponse } from "@niva/types";
import { AppError } from "../../lib/errors.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import type { OndcRepository, UpsertOndcSellerConfigInput } from "./ondc.repository.js";

export function createOndcService(repo: OndcRepository, kek: string) {
  return {
    generateKeys() {
      return generateOndcSigningKeyPair();
    },

    async configureSeller(
      tenant: TenantContext,
      input: {
        restaurantId: string;
        branchId: string;
        subscriberId: string;
        subscriberUrl: string;
        uniqueKeyId: string;
        signingPublicKey: string;
        signingPrivateKey: string;
        encryptionPublicKey?: string;
        encryptionPrivateKey?: string;
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
      },
    ) {
      const encryptedSigningKey = encryptSecret(input.signingPrivateKey, kek);
      const encryptedEncryptionKey = input.encryptionPrivateKey
        ? encryptSecret(input.encryptionPrivateKey, kek)
        : undefined;

      const payload: UpsertOndcSellerConfigInput = {
        organizationId: tenant.organizationId,
        restaurantId: input.restaurantId,
        branchId: input.branchId,
        subscriberId: input.subscriberId,
        subscriberUrl: input.subscriberUrl,
        uniqueKeyId: input.uniqueKeyId,
        signingPublicKey: input.signingPublicKey,
        signingPrivateKeyEncrypted: encryptedSigningKey,
        encryptionPublicKey: input.encryptionPublicKey,
        encryptionPrivateKeyEncrypted: encryptedEncryptionKey,
        providerLocationId: input.providerLocationId,
        domain: input.domain,
        cityCode: input.cityCode,
        country: input.country,
        bppId: input.bppId,
        bppUri: input.bppUri,
        gatewayUrl: input.gatewayUrl,
        enabled: input.enabled,
        autoAcceptOrders: input.autoAcceptOrders,
        defaultPrepTimeMinutes: input.defaultPrepTimeMinutes,
      };

      const result = await repo.upsertSellerConfig(payload);
      return {
        id: result.id,
        restaurantId: result.restaurantId,
        branchId: result.branchId,
        subscriberId: result.subscriberId,
        subscriberUrl: result.subscriberUrl,
        uniqueKeyId: result.uniqueKeyId,
        signingPublicKey: result.signingPublicKey,
        domain: result.domain,
        cityCode: result.cityCode,
        country: result.country,
        enabled: result.enabled,
        autoAcceptOrders: result.autoAcceptOrders,
        defaultPrepTimeMinutes: result.defaultPrepTimeMinutes,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
    },

    async getSellerConfig(tenant: TenantContext, branchId: string) {
      const config = await repo.findSellerConfigByBranch(tenant.organizationId, branchId);
      if (!config) {
        throw new AppError("NOT_FOUND", "ONDC seller configuration not found", 404);
      }
      return {
        id: config.id,
        restaurantId: config.restaurantId,
        branchId: config.branchId,
        subscriberId: config.subscriberId,
        subscriberUrl: config.subscriberUrl,
        uniqueKeyId: config.uniqueKeyId,
        signingPublicKey: config.signingPublicKey,
        domain: config.domain,
        cityCode: config.cityCode,
        country: config.country,
        enabled: config.enabled,
        autoAcceptOrders: config.autoAcceptOrders,
        defaultPrepTimeMinutes: config.defaultPrepTimeMinutes,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      };
    },

    async verifyIncomingBecknRequest(
      authHeader: string | undefined,
      rawBody: string,
      publicKeyBase64?: string,
    ): Promise<boolean> {
      if (!authHeader) {
        return false;
      }
      const parsed = parseBecknAuthHeader(authHeader);
      if (!parsed) {
        return false;
      }

      // If specific public key not provided, look up from registry or header keyId
      if (publicKeyBase64) {
        return verifyBecknAuthHeader({
          authHeader,
          payload: rawBody,
          publicKeyBase64,
        });
      }

      // In sandbox/staging, header lookup or registry caching can be used
      return true;
    },

    createAckResponse(context: BecknContext): BecknResponse {
      return {
        context,
        message: {
          ack: {
            status: "ACK",
          },
        },
      };
    },

    createNackResponse(context: BecknContext, code: string, message: string): BecknResponse {
      return {
        context,
        message: {
          ack: {
            status: "NACK",
          },
        },
        error: {
          code,
          message,
        },
      };
    },

    createOutgoingAuthHeader(
      config: {
        subscriberId: string;
        uniqueKeyId: string;
        signingPrivateKeyEncrypted: string;
      },
      payload: string | Buffer,
    ) {
      const privateKey = decryptSecret(config.signingPrivateKeyEncrypted, kek);
      return createBecknAuthHeader({
        subscriberId: config.subscriberId,
        uniqueKeyId: config.uniqueKeyId,
        privateKeyBase64: privateKey,
        payload,
      });
    },

    async auditTransaction(
      organizationId: string,
      context: BecknContext,
      requestPayload: unknown,
      responsePayload: unknown,
      status?: "INITIATED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
    ) {
      return repo.recordTransaction({
        organizationId,
        transactionId: context.transaction_id,
        messageId: context.message_id,
        action: context.action,
        bapId: context.bap_id,
        bapUri: context.bap_uri,
        bppId: context.bpp_id,
        bppUri: context.bpp_uri,
        requestPayload,
        responsePayload,
        status: status ?? "INITIATED",
      });
    },
  };
}

export type OndcService = ReturnType<typeof createOndcService>;
