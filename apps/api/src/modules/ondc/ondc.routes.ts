import type { FastifyPluginAsync } from "fastify";
import type { ApiEnv } from "@niva/config";
import type { Database } from "@niva/database";
import { becknContextSchema, ondcSellerConfigSchema } from "@niva/validation";
import { z } from "zod";
import { requirePermission } from "../../lib/authorize.js";
import { errorEnvelope } from "../../lib/envelope.js";
import { isAppError } from "../../lib/errors.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { createAuthRepository } from "../auth/auth.repository.js";
import { createTenancyRepository } from "../tenancy/tenancy.repository.js";
import { createRequireTenant } from "../../lib/tenant-context.js";
import { createMenuRepository } from "../menu/menu.repository.js";
import { createRestaurantRepository } from "../restaurants/restaurants.repository.js";
import { createOndcRepository } from "./ondc.repository.js";
import { createOndcService } from "./ondc.service.js";

function kekFromEnv(env: ApiEnv): string {
  return env.INTEGRATION_KEK ?? env.JWT_ACCESS_SECRET;
}

const becknProtocolBodySchema = z.object({
  context: becknContextSchema,
  message: z.record(z.string(), z.unknown()).optional(),
});

export const ondcRoutes: FastifyPluginAsync<{
  db: Database;
  env: ApiEnv;
}> = async (app, opts) => {
  app.setErrorHandler((error, _request, reply) => {
    if (isAppError(error)) {
      return reply.status(error.statusCode).send(errorEnvelope(error.code, error.message));
    }
    throw error;
  });

  const authRepository = createAuthRepository(opts.db);
  const tenancy = createTenancyRepository(opts.db);
  const requireAuth = createRequireAuth(opts.env, authRepository, tenancy);
  const requireTenant = createRequireTenant(opts.env, tenancy);
  const tenantAuth = [requireAuth, requireTenant];

  const repo = createOndcRepository(opts.db);
  const menuRepo = createMenuRepository(opts.db);
  const restaurantRepo = createRestaurantRepository(opts.db);
  const service = createOndcService(repo, kekFromEnv(opts.env), menuRepo, restaurantRepo);

  // --- Seller configuration endpoints for Restaurant Portal ---

  // Generate a fresh Ed25519 keypair for ONDC registration
  app.post(
    "/ondc/keys/generate",
    {
      schema: { tags: ["ondc"] },
      preHandler: [...tenantAuth, requirePermission("settings.manage")],
    },
    async (_request) => {
      const keys = service.generateKeys();
      return {
        success: true,
        data: keys,
      };
    },
  );

  // Get current ONDC configuration for a branch
  app.get(
    "/branches/:branchId/ondc/config",
    {
      schema: { tags: ["ondc"] },
      preHandler: [...tenantAuth, requirePermission("settings.manage")],
    },
    async (request) => {
      const { branchId } = request.params as { branchId: string };
      const config = await service.getSellerConfig(request.tenant!, branchId);
      return {
        success: true,
        data: config,
        meta: { requestId: request.id },
      };
    },
  );

  // Save/Update ONDC seller credentials for a branch
  app.put(
    "/restaurants/:restaurantId/branches/:branchId/ondc/config",
    {
      schema: { tags: ["ondc"] },
      preHandler: [...tenantAuth, requirePermission("settings.manage")],
    },
    async (request, reply) => {
      const { restaurantId, branchId } = request.params as {
        restaurantId: string;
        branchId: string;
      };

      const parsed = ondcSellerConfigSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid ONDC configuration payload"));
      }

      const config = await service.configureSeller(request.tenant!, {
        restaurantId,
        branchId,
        subscriberId: parsed.data.subscriberId,
        subscriberUrl: parsed.data.subscriberUrl,
        uniqueKeyId: parsed.data.uniqueKeyId,
        signingPublicKey: parsed.data.signingPublicKey,
        signingPrivateKey: parsed.data.signingPrivateKey,
        encryptionPublicKey: parsed.data.encryptionPublicKey,
        encryptionPrivateKey: parsed.data.encryptionPrivateKey,
        gatewayUrl: parsed.data.gatewayUrl,
        enabled: parsed.data.enabled,
        autoAcceptOrders: parsed.data.autoAcceptOrders,
        defaultPrepTimeMinutes: parsed.data.defaultPreparationTimeMinutes,
      });

      return reply.status(201).send({
        success: true,
        data: config,
        meta: { requestId: request.id },
      });
    },
  );

  // Preview generated ONDC catalog for a branch
  app.get(
    "/restaurants/:restaurantId/branches/:branchId/ondc/catalog",
    {
      schema: { tags: ["ondc"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request) => {
      const { restaurantId, branchId } = request.params as {
        restaurantId: string;
        branchId: string;
      };
      const config = await repo.findSellerConfigByBranch(request.tenant!.organizationId, branchId);
      const catalog = await service.buildCatalogForBranch(
        request.tenant!.organizationId,
        restaurantId,
        branchId,
        config?.providerLocationId ?? undefined,
      );
      return {
        success: true,
        data: { catalog },
        meta: { requestId: request.id },
      };
    },
  );

  // --- Beckn Protocol Webhook Ingress (Buyer App / Gateway callbacks) ---

  const becknActions = [
    "search",
    "select",
    "init",
    "confirm",
    "status",
    "track",
    "cancel",
    "update",
  ] as const;

  for (const action of becknActions) {
    app.post(
      `/ondc/${action}`,
      {
        schema: { tags: ["ondc-protocol"] },
        config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
      },
      async (request, reply) => {
        const rawBody =
          typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {});
        const authHeader = request.headers.authorization;

        // Verify Beckn cryptographic signature header
        const isVerified = await service.verifyIncomingBecknRequest(authHeader, rawBody);
        if (!isVerified && process.env.NODE_ENV === "production") {
          return reply
            .status(401)
            .send(errorEnvelope("UNAUTHORIZED", "Invalid Beckn signature in Authorization header"));
        }

        const parsed = becknProtocolBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send(errorEnvelope("BAD_REQUEST", "Invalid Beckn request schema"));
        }

        const context = parsed.data.context;

        // Immediate synchronous ACK required by Beckn specification (within 1-3 seconds)
        const ackResponse = service.createAckResponse(context);

        // Audit the Beckn transaction
        const sellerConfig = await repo.findSellerConfigBySubscriber(context.bpp_id ?? "");
        if (sellerConfig) {
          await service.auditTransaction(
            sellerConfig.organizationId,
            context,
            parsed.data,
            ackResponse,
          );
        }

        // Return synchronous ACK payload
        return reply.status(200).send(ackResponse);
      },
    );
  }
};

