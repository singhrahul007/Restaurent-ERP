import type { FastifyPluginAsync } from "fastify";
import type { ApiEnv } from "@niva/config";
import type { Database } from "@niva/database";
import { createExpenseBodySchema, patchExpenseBodySchema } from "@niva/validation";
import { requirePermission } from "../../lib/authorize.js";
import { errorEnvelope } from "../../lib/envelope.js";
import { isAppError } from "../../lib/errors.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { createAuthRepository } from "../auth/auth.repository.js";
import { createTenancyRepository } from "../tenancy/tenancy.repository.js";
import { createRequireTenant } from "../../lib/tenant-context.js";
import { createExpenseRepository } from "./expenses.repository.js";
import { createExpenseService } from "./expenses.service.js";

export const expenseRoutes: FastifyPluginAsync<{
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
  const service = createExpenseService(createExpenseRepository(opts.db), opts.db);
  const tenantAuth = [requireAuth, requireTenant];

  app.get(
    "/restaurants/:restaurantId/expenses",
    {
      schema: { tags: ["reports"] },
      preHandler: [...tenantAuth, requirePermission("restaurant.manage")],
    },
    async (request) => {
      const { restaurantId } = request.params as { restaurantId: string };
      const query = request.query as { branchId?: string };
      return {
        success: true,
        data: {
          expenses: await service.list(request.tenant!, restaurantId, query.branchId),
        },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/restaurants/:restaurantId/expenses",
    {
      schema: { tags: ["reports"] },
      preHandler: [...tenantAuth, requirePermission("restaurant.manage")],
    },
    async (request, reply) => {
      const parsed = createExpenseBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid expense payload"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      const expense = await service.create(
        request.tenant!,
        request.authUser!.id,
        restaurantId,
        parsed.data,
        { ip: request.ip, userAgent: request.headers["user-agent"] },
      );
      return reply.status(201).send({
        success: true,
        data: expense,
        meta: { requestId: request.id },
      });
    },
  );

  app.patch(
    "/restaurants/:restaurantId/expenses/:id",
    {
      schema: { tags: ["reports"] },
      preHandler: [...tenantAuth, requirePermission("restaurant.manage")],
    },
    async (request, reply) => {
      const parsed = patchExpenseBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid expense payload"));
      }
      const { restaurantId, id } = request.params as { restaurantId: string; id: string };
      return {
        success: true,
        data: await service.patch(request.tenant!, id, restaurantId, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.delete(
    "/restaurants/:restaurantId/expenses/:id",
    {
      schema: { tags: ["reports"] },
      preHandler: [...tenantAuth, requirePermission("restaurant.manage")],
    },
    async (request) => {
      const { restaurantId, id } = request.params as { restaurantId: string; id: string };
      await service.remove(request.tenant!, id, restaurantId);
      return {
        success: true,
        data: { ok: true },
        meta: { requestId: request.id },
      };
    },
  );
};
