import { describe, expect, it } from "vitest";
import { generateOndcSigningKeyPair } from "@niva/integrations";
import { createOndcService } from "./ondc.service.js";

describe("ONDC Service Unit Tests", () => {
  const dummyKek = "secret-encryption-kek-key-32bytes!";

  const mockRepo = {
    configs: new Map<string, any>(),
    transactions: [] as any[],

    async findSellerConfigByBranch(orgId: string, branchId: string) {
      return this.configs.get(`${orgId}:${branchId}`) ?? null;
    },

    async findSellerConfigBySubscriber(subscriberId: string) {
      for (const config of this.configs.values()) {
        if (config.subscriberId === subscriberId) return config;
      }
      return null;
    },

    async upsertSellerConfig(input: any) {
      const key = `${input.organizationId}:${input.branchId}`;
      const record = {
        id: "conf-123",
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.configs.set(key, record);
      return record;
    },

    async recordTransaction(input: any) {
      this.transactions.push(input);
      return { id: "tx-rec-1", ...input };
    },

    async findTransaction(transactionId: string) {
      return this.transactions.filter((t) => t.transactionId === transactionId);
    },
  };

  const service = createOndcService(mockRepo as any, dummyKek);

  it("generates ONDC signing key pairs", () => {
    const keys = service.generateKeys();
    expect(keys.publicKeyBase64).toBeTypeOf("string");
    expect(keys.privateKeyBase64).toBeTypeOf("string");
  });

  it("configures and retrieves seller config with encrypted private keys", async () => {
    const keys = generateOndcSigningKeyPair();
    const tenant = { organizationId: "org-1", restaurantId: "rest-1" } as any;

    const saved = await service.configureSeller(tenant, {
      restaurantId: "rest-1",
      branchId: "branch-1",
      subscriberId: "seller.niva.app",
      subscriberUrl: "https://seller.niva.app/ondc",
      uniqueKeyId: "key-1",
      signingPublicKey: keys.publicKeyBase64,
      signingPrivateKey: keys.privateKeyBase64,
      domain: "ONDC:RET11",
      cityCode: "std:080",
      country: "IND",
    });

    expect(saved.subscriberId).toBe("seller.niva.app");
    expect(saved.signingPublicKey).toBe(keys.publicKeyBase64);

    const retrieved = await service.getSellerConfig(tenant, "branch-1");
    expect(retrieved.subscriberId).toBe("seller.niva.app");
  });

  it("creates compliant Beckn ACK and NACK responses", () => {
    const context = {
      domain: "ONDC:RET11",
      country: "IND",
      city: "std:080",
      action: "search" as const,
      core_version: "1.2.0",
      bap_id: "buyer.app",
      bap_uri: "https://buyer.app/ondc",
      transaction_id: "tx-001",
      message_id: "msg-001",
      timestamp: new Date().toISOString(),
    };

    const ack = service.createAckResponse(context);
    expect(ack.context.transaction_id).toBe("tx-001");
    expect(ack.message?.ack.status).toBe("ACK");

    const nack = service.createNackResponse(context, "30000", "Generic error");
    expect(nack.message?.ack.status).toBe("NACK");
    expect(nack.error?.code).toBe("30000");
  });

  it("builds branch catalog and formats on_search payload", async () => {
    const mockMenuRepo = {
      async listCategories() {
        return [{ id: "c-1", name: "Beverages" }];
      },
      async listItems() {
        return [
          {
            id: "i-1",
            name: "Masala Chai",
            categoryId: "c-1",
            basePriceMinor: 4000,
            available: true,
          },
        ];
      },
      async listAvailability() {
        return [];
      },
    };

    const mockRestaurantRepo = {
      async findRestaurant() {
        return { id: "r-1", name: "Chai Point", currency: "INR" };
      },
      async findBranch() {
        return { id: "b-1", name: "Koramangala", city: "Bengaluru" };
      },
    };

    const fullService = createOndcService(
      mockRepo as any,
      dummyKek,
      mockMenuRepo as any,
      mockRestaurantRepo as any,
    );

    const catalog = await fullService.buildCatalogForBranch("org-1", "r-1", "b-1");
    expect(catalog["bpp/providers"]?.length).toBe(1);
    expect(catalog["bpp/providers"]![0]!.items?.length).toBe(1);
    expect(catalog["bpp/providers"]![0]!.items![0]!.descriptor.name).toBe("Masala Chai");

    const context = {
      domain: "ONDC:RET11",
      country: "IND",
      city: "std:080",
      action: "search" as const,
      core_version: "1.2.0",
      bap_id: "bap.app",
      bap_uri: "https://bap.app/ondc",
      transaction_id: "tx-catalog-1",
      message_id: "msg-catalog-1",
      timestamp: new Date().toISOString(),
    };

    const onSearchPayload = fullService.createOnSearchPayload(context, catalog, {
      bppId: "seller.niva.app",
      bppUri: "https://seller.niva.app/ondc",
    });

    expect(onSearchPayload.context.action).toBe("on_search");
    expect(onSearchPayload.context.bpp_id).toBe("seller.niva.app");
    expect(onSearchPayload.message.catalog).toBe(catalog);
  });

  it("handles quotation generation on handleSelect", async () => {
    const mockMenuRepo = {
      async findItem() {
        return {
          id: "item-101",
          name: "Paneer Butter Masala",
          basePriceMinor: 28000,
          taxClassId: "tax-1",
        };
      },
      async findVariant() {
        return null;
      },
      async listTaxClasses() {
        return [{ id: "tax-1", inclusive: false, currentRate: { rateBps: 500 } }];
      },
    };

    const mockRestaurantRepo = {
      async findRestaurant() {
        return { id: "r-1", currency: "INR" };
      },
    };

    const service = createOndcService(
      mockRepo as any,
      dummyKek,
      mockMenuRepo as any,
      mockRestaurantRepo as any,
    );

    const context = {
      domain: "ONDC:RET11",
      country: "IND",
      city: "std:080",
      action: "select" as const,
      core_version: "1.2.0",
      bap_id: "bap.app",
      bap_uri: "https://bap.app/ondc",
      transaction_id: "tx-select-1",
      message_id: "msg-select-1",
      timestamp: new Date().toISOString(),
    };

    const orderReq = {
      items: [{ id: "item-101", quantity: { count: 2 } }],
    };

    const onSelect = await service.handleSelect("org-1", "r-1", context, orderReq as any);
    expect(onSelect.context.action).toBe("on_select");
    expect(onSelect.message.order.quote.breakup.length).toBeGreaterThanOrEqual(1);
    expect(onSelect.message.order.quote.price.value).toBeTypeOf("string");
  });

  it("ingests and confirms order on handleConfirm triggering KDS dispatch", async () => {
    let ingestedPartnerOrder: any = null;
    let confirmedOrderId: string | null = null;

    const mockOrderService = {
      async ingestPartnerOrder(_tenant: any, _actor: string, _restId: string, normalized: any) {
        ingestedPartnerOrder = normalized;
        return {
          id: "niva-ord-1234",
          status: "CREATED",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
      async confirm(_tenant: any, _actor: string, orderId: string) {
        confirmedOrderId = orderId;
        return {
          id: orderId,
          status: "PREPARING",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    };

    const service = createOndcService(
      mockRepo as any,
      dummyKek,
      undefined,
      undefined,
      mockOrderService as any,
    );

    const context = {
      domain: "ONDC:RET11",
      country: "IND",
      city: "std:080",
      action: "confirm" as const,
      core_version: "1.2.0",
      bap_id: "bap.app",
      bap_uri: "https://bap.app/ondc",
      transaction_id: "tx-confirm-1",
      message_id: "msg-confirm-1",
      timestamp: new Date().toISOString(),
    };

    const becknOrder = {
      id: "ONDC-ORD-777",
      billing: { name: "Ananya", phone: "9876543210" },
      items: [{ id: "menu-item-55", quantity: { count: 1 } }],
    };

    const tenant = { organizationId: "org-1", restaurantId: "r-1" } as any;

    const onConfirm = await service.handleConfirm(
      tenant,
      "ondc-actor",
      "r-1",
      "b-1",
      context,
      becknOrder as any,
    );

    expect(onConfirm.context.action).toBe("on_confirm");
    expect(onConfirm.message.order.state).toBe("Accepted");
    expect(ingestedPartnerOrder?.externalId).toBe("ONDC-ORD-777");
    expect(confirmedOrderId).toBe("niva-ord-1234");
  });
});

