import type { FastifyPluginAsync } from "fastify";
import type { ApiEnv } from "@niva/config";
import type { Database } from "@niva/database";
import { patchKitchenItemBodySchema } from "@niva/validation";
import { requirePermission } from "../../lib/authorize.js";
import { errorEnvelope } from "../../lib/envelope.js";
import { isAppError } from "../../lib/errors.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { createAuthRepository } from "../auth/auth.repository.js";
import { createTenancyRepository } from "../tenancy/tenancy.repository.js";
import { createRequireTenant } from "../../lib/tenant-context.js";
import { createOrderRepository } from "../orders/orders.repository.js";
import { createKitchenRepository } from "./kitchen.repository.js";
import { createKitchenService } from "./kitchen.service.js";

export const kitchenRoutes: FastifyPluginAsync<{
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
  const service = createKitchenService(
    createKitchenRepository(opts.db),
    createOrderRepository(opts.db),
  );
  const tenantAuth = [requireAuth, requireTenant];

  app.get(
    "/branches/:branchId/kitchen/tickets",
    {
      schema: { tags: ["kitchen"] },
      preHandler: [...tenantAuth, requirePermission("kitchen.view")],
    },
    async (request) => {
      const { branchId } = request.params as { branchId: string };
      return {
        success: true,
        data: await service.listByColumn(request.tenant!, branchId),
        meta: { requestId: request.id },
      };
    },
  );

  app.patch(
    "/kitchen/ticket-items/:id",
    {
      schema: { tags: ["kitchen"] },
      preHandler: [...tenantAuth, requirePermission("kitchen.update")],
    },
    async (request, reply) => {
      const parsed = patchKitchenItemBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid kitchen item payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.updateItemStatus(
          request.tenant!,
          request.authUser!.id,
          id,
          parsed.data.status,
        ),
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/kitchen/tickets/:id/ready",
    {
      schema: { tags: ["kitchen"] },
      preHandler: [...tenantAuth, requirePermission("kitchen.update")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.bumpTicket(request.tenant!, request.authUser!.id, id),
        meta: { requestId: request.id },
      };
    },
  );
};
