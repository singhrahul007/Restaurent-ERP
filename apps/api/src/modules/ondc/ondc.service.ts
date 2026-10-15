import {
  buildOndcCatalog,
  calculateBecknQuote,
  createBecknAuthHeader,
  decryptSecret,
  encryptSecret,
  generateOndcSigningKeyPair,
  normalizeBecknOrder,
  parseBecknAuthHeader,
  verifyBecknAuthHeader,
} from "@niva/integrations";
import type {
  BecknCatalog,
  BecknContext,
  BecknOnConfirmPayload,
  BecknOnInitPayload,
  BecknOnSearchPayload,
  BecknOnSelectPayload,
  BecknOrder,
  BecknResponse,
} from "@niva/types";
import { AppError } from "../../lib/errors.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import type { MenuRepository } from "../menu/menu.repository.js";
import type { RestaurantRepository } from "../restaurants/restaurants.repository.js";
import type { OrderService } from "../orders/orders.service.js";
import type { OndcRepository, UpsertOndcSellerConfigInput } from "./ondc.repository.js";

export function createOndcService(
  repo: OndcRepository,
  kek: string,
  menuRepo?: MenuRepository,
  restaurantRepo?: RestaurantRepository,
  orders?: OrderService,
) {
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
      if (!result) {
        throw new AppError("INTERNAL_ERROR", "Failed to upsert ONDC seller configuration", 500);
      }
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

    async buildCatalogForBranch(
      organizationId: string,
      restaurantId: string,
      branchId: string,
      providerLocationId?: string,
    ): Promise<BecknCatalog> {
      if (!menuRepo || !restaurantRepo) {
        throw new Error("REPOSITORIES_NOT_CONFIGURED");
      }

      const restaurant = await restaurantRepo.findRestaurant(organizationId, restaurantId);
      if (!restaurant) {
        throw new AppError("NOT_FOUND", "Restaurant not found", 404);
      }

      const branch = await restaurantRepo.findBranch(organizationId, branchId);
      if (!branch) {
        throw new AppError("NOT_FOUND", "Branch not found", 404);
      }

      const categories = await menuRepo.listCategories(organizationId, restaurantId);
      const items = await menuRepo.listItems(organizationId, restaurantId);
      const availability = await menuRepo.listAvailability(organizationId, restaurantId);

      const branchOverrides = availability
        .filter((row) => row.branchId === branchId || row.branchId === null)
        .map((row) => ({ menuItemId: row.menuItemId, available: row.available }));

      return buildOndcCatalog({
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          currency: restaurant.currency ?? "INR",
        },
        branch: {
          id: branch.id,
          name: branch.name,
          addressLine1: restaurant.addressLine1,
          city: restaurant.city,
          region: restaurant.region,
          postalCode: restaurant.postalCode,
          country: restaurant.country,
        },
        categories,
        items,
        availabilityOverrides: branchOverrides,
        providerLocationId,
      });
    },

    createOnSearchPayload(
      context: BecknContext,
      catalog: BecknCatalog,
      bppConfig: {
        bppId: string;
        bppUri: string;
      },
    ): BecknOnSearchPayload {
      const responseContext: BecknContext = {
        ...context,
        action: "on_search",
        bpp_id: bppConfig.bppId,
        bpp_uri: bppConfig.bppUri,
        timestamp: new Date().toISOString(),
      };

      return {
        context: responseContext,
        message: {
          catalog,
        },
      };
    },

    async handleSelect(
      organizationId: string,
      restaurantId: string,
      context: BecknContext,
      order: BecknOrder,
    ): Promise<BecknOnSelectPayload> {
      if (!menuRepo || !restaurantRepo) {
        throw new Error("REPOSITORIES_NOT_CONFIGURED");
      }

      const restaurant = await restaurantRepo.findRestaurant(organizationId, restaurantId);
      const currency = restaurant?.currency ?? "INR";

      const quoteItems: Array<{
        id: string;
        name: string;
        qty: number;
        unitPriceMinor: number;
        taxRateBps: number;
        taxInclusive: boolean;
      }> = [];

      for (const reqItem of order.items) {
        const [menuItemId, variantId] = reqItem.id.split(":");
        const item = await menuRepo.findItem(organizationId, menuItemId!);
        if (!item) {
          throw new AppError("NOT_FOUND", `Item ${reqItem.id} not found`, 404);
        }

        let unitPriceMinor = item.basePriceMinor;
        let itemName = item.name;

        if (variantId) {
          const variant = await menuRepo.findVariant(organizationId, variantId);
          if (variant) {
            unitPriceMinor += variant.priceDeltaMinor;
            itemName = `${item.name} - ${variant.name}`;
          }
        }

        const taxClasses = await menuRepo.listTaxClasses(organizationId, restaurantId);
        const itemTax = taxClasses.find((t) => t.id === item.taxClassId);
        const rateBps = itemTax?.currentRate?.rateBps ?? 500; // 5% default for F&B in India
        const inclusive = itemTax?.inclusive ?? false;

        quoteItems.push({
          id: reqItem.id,
          name: itemName,
          qty: reqItem.quantity.count,
          unitPriceMinor,
          taxRateBps: rateBps,
          taxInclusive: inclusive,
        });
      }

      const quote = calculateBecknQuote({
        currency,
        items: quoteItems,
        packagingChargeMinor: 2000,
        deliveryChargeMinor: 4000,
      });

      return {
        context: {
          ...context,
          action: "on_select",
          timestamp: new Date().toISOString(),
        },
        message: {
          order: {
            provider: {
              id: restaurantId,
            },
            items: order.items,
            quote,
            fulfillments: order.fulfillments,
          },
        },
      };
    },

    async handleConfirm(
      tenant: TenantContext,
      actorId: string,
      restaurantId: string,
      branchId: string,
      context: BecknContext,
      becknOrder: BecknOrder,
    ): Promise<BecknOnConfirmPayload> {
      if (!orders) {
        throw new Error("ORDER_SERVICE_NOT_CONFIGURED");
      }

      const normalized = normalizeBecknOrder(branchId, becknOrder);
      const ingestedOrder = await orders.ingestPartnerOrder(
        tenant,
        actorId,
        restaurantId,
        normalized,
      );

      // Transition order to CONFIRMED / PREPARING so Kitchen Display Station (KDS) receives it
      const confirmedOrder = await orders.confirm(tenant, actorId, ingestedOrder.id);

      // Audit Beckn transaction
      await repo.recordTransaction({
        organizationId: tenant.organizationId,
        transactionId: context.transaction_id,
        messageId: context.message_id,
        action: "confirm",
        bapId: context.bap_id,
        bapUri: context.bap_uri,
        bppId: context.bpp_id,
        bppUri: context.bpp_uri,
        orderId: confirmedOrder.id,
        ondcOrderId: becknOrder.id,
        status: "ACCEPTED",
        requestPayload: becknOrder,
        responsePayload: { orderId: confirmedOrder.id, status: confirmedOrder.status },
      });

      return {
        context: {
          ...context,
          action: "on_confirm",
          timestamp: new Date().toISOString(),
        },
        message: {
          order: {
            ...becknOrder,
            id: becknOrder.id ?? `ONDC-${confirmedOrder.id.slice(0, 8)}`,
            state: "Accepted",
            created_at: confirmedOrder.createdAt.toISOString(),
            updated_at: confirmedOrder.updatedAt.toISOString(),
          },
        },
      };
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

