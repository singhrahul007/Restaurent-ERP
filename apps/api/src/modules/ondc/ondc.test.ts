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
});

