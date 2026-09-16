import type { FastifyPluginAsync } from "fastify";
import type { ApiEnv } from "@niva/config";
import { createPaymentGateway } from "@niva/integrations";
import type { Database } from "@niva/database";
import {
  ingestPartnerOrderBodySchema,
  upsertIntegrationAccountBodySchema,
} from "@niva/validation";
import { requirePermission } from "../../lib/authorize.js";
import { errorEnvelope } from "../../lib/envelope.js";
import { isAppError } from "../../lib/errors.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { createAuthRepository } from "../auth/auth.repository.js";
import { createTenancyRepository } from "../tenancy/tenancy.repository.js";
import { createRequireTenant } from "../../lib/tenant-context.js";
import { createKitchenRepository } from "../kitchen/kitchen.repository.js";
import { createPaymentRepository } from "../payments/payments.repository.js";
import { createOrderRepository } from "../orders/orders.repository.js";
import { createOrderService } from "../orders/orders.service.js";
import { createIntegrationRepository } from "./integrations.repository.js";
import { createIntegrationService } from "./integrations.service.js";

function kekFromEnv(env: ApiEnv): string {
  return env.INTEGRATION_KEK ?? env.JWT_ACCESS_SECRET;
}

export const integrationRoutes: FastifyPluginAsync<{
  db: Database;
  env: ApiEnv;
}> = async (app, opts) => {
  app.setErrorHandler((error, _request, reply) => {
    if (isAppError(error)) {
      return reply
        .status(error.statusCode)
        .send(errorEnvelope(error.code, error.message));
    }
    throw error;
  });

  const authRepository = createAuthRepository(opts.db);
  const tenancy = createTenancyRepository(opts.db);
  const requireAuth = createRequireAuth(opts.env, authRepository, tenancy);
  const requireTenant = createRequireTenant(opts.env, tenancy);
  const orders = createOrderService(
    createOrderRepository(opts.db),
    createPaymentRepository(opts.db),
    opts.db,
    createKitchenRepository(opts.db),
    createPaymentGateway(),
  );
  const service = createIntegrationService(
    createIntegrationRepository(opts.db),
    orders,
    opts.db,
    kekFromEnv(opts.env),
  );
  const tenantAuth = [requireAuth, requireTenant];

  app.get(
    "/integration-accounts",
    {
      schema: { tags: ["integrations"] },
      preHandler: [...tenantAuth, requirePermission("settings.manage")],
    },
    async (request) => ({
      success: true,
      data: { accounts: await service.list(request.tenant!) },
      meta: { requestId: request.id },
    }),
  );

  app.put(
    "/integration-accounts",
    {
      schema: { tags: ["integrations"] },
      preHandler: [...tenantAuth, requirePermission("settings.manage")],
    },
    async (request, reply) => {
      const parsed = upsertIntegrationAccountBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid integration payload"));
      }
      const account = await service.upsert(request.tenant!, request.authUser!.id, parsed.data, {
        ip: request.ip,
        userAgent: request.headers["user-agent"],
      });
      return reply.status(201).send({
        success: true,
        data: account,
        meta: { requestId: request.id },
      });
    },
  );

  app.delete(
    "/integration-accounts/:id",
    {
      schema: { tags: ["integrations"] },
      preHandler: [...tenantAuth, requirePermission("settings.manage")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      await service.remove(request.tenant!, id);
      return {
        success: true,
        data: { ok: true },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/webhooks/:provider",
    {
      schema: { tags: ["integrations"] },
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const { provider } = request.params as { provider: string };
      const rawBody =
        typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {});
      const result = service.handleWebhook(provider, request.headers, rawBody);
      if (result.status === 404) {
        return reply.status(404).send(errorEnvelope("NOT_FOUND", "Not found"));
      }
      await service.recordEvent(
        result.parsed.accepted ? (result.parsed.organizationId ?? null) : null,
        provider,
        "INBOUND",
        result.parsed,
      );
      return {
        success: true,
        data: { accepted: result.parsed.accepted },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/restaurants/:restaurantId/channels/mock/orders",
    {
      schema: { tags: ["integrations"] },
      preHandler: [...tenantAuth, requirePermission("orders.create")],
    },
    async (request, reply) => {
      const parsed = ingestPartnerOrderBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid partner payload"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      const order = await service.ingestMock(
        request.tenant!,
        request.authUser!.id,
        restaurantId,
        parsed.data,
      );
      return reply.status(201).send({
        success: true,
        data: order,
        meta: { requestId: request.id },
      });
    },
  );
};
