import type { FastifyPluginAsync } from "fastify";
import type { ApiEnv } from "@niva/config";
import type { Database } from "@niva/database";
import { reportsQuerySchema } from "@niva/validation";
import { requirePermission } from "../../lib/authorize.js";
import { errorEnvelope } from "../../lib/envelope.js";
import { isAppError } from "../../lib/errors.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { createAuthRepository } from "../auth/auth.repository.js";
import { createTenancyRepository } from "../tenancy/tenancy.repository.js";
import { createRequireTenant } from "../../lib/tenant-context.js";
import { createReportsRepository } from "./reports.repository.js";
import { createReportsService } from "./reports.service.js";

export const reportRoutes: FastifyPluginAsync<{
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
  const service = createReportsService(createReportsRepository(opts.db));
  const tenantAuth = [requireAuth, requireTenant];
  const reportsView = [...tenantAuth, requirePermission("reports.view")];

  function parseQuery(query: unknown) {
    return reportsQuerySchema.safeParse(query);
  }

  app.get(
    "/restaurants/:restaurantId/reports/sales",
    {
      schema: { tags: ["reports"] },
      preHandler: reportsView,
    },
    async (request, reply) => {
      const parsed = parseQuery(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid report query"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      return {
        success: true,
        data: await service.sales(request.tenant!, restaurantId, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.get(
    "/restaurants/:restaurantId/reports/items",
    {
      schema: { tags: ["reports"] },
      preHandler: reportsView,
    },
    async (request, reply) => {
      const parsed = parseQuery(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid report query"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      return {
        success: true,
        data: await service.items(request.tenant!, restaurantId, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.get(
    "/restaurants/:restaurantId/reports/payments",
    {
      schema: { tags: ["reports"] },
      preHandler: reportsView,
    },
    async (request, reply) => {
      const parsed = parseQuery(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid report query"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      return {
        success: true,
        data: await service.payments(request.tenant!, restaurantId, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.get(
    "/restaurants/:restaurantId/reports/inventory",
    {
      schema: { tags: ["reports"] },
      preHandler: reportsView,
    },
    async (request, reply) => {
      const parsed = parseQuery(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid report query"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      return {
        success: true,
        data: await service.inventory(request.tenant!, restaurantId, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.get(
    "/restaurants/:restaurantId/reports/operations",
    {
      schema: { tags: ["reports"] },
      preHandler: reportsView,
    },
    async (request, reply) => {
      const parsed = parseQuery(request.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid report query"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      return {
        success: true,
        data: await service.operations(request.tenant!, restaurantId, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );
};
