import type { FastifyPluginAsync } from "fastify";
import type { ApiEnv } from "@niva/config";
import type { Database } from "@niva/database";
import { createRecipeBodySchema, patchRecipeBodySchema } from "@niva/validation";
import { requirePermission } from "../../lib/authorize.js";
import { errorEnvelope } from "../../lib/envelope.js";
import { isAppError } from "../../lib/errors.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { createAuthRepository } from "../auth/auth.repository.js";
import { createTenancyRepository } from "../tenancy/tenancy.repository.js";
import { createRequireTenant } from "../../lib/tenant-context.js";
import { createInventoryRepository } from "../inventory/inventory.repository.js";
import { createRecipeRepository } from "./recipes.repository.js";
import { createRecipeService } from "./recipes.service.js";

export const recipeRoutes: FastifyPluginAsync<{
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
  const inventory = createInventoryRepository(opts.db);
  const service = createRecipeService(createRecipeRepository(opts.db));
  const tenantAuth = [requireAuth, requireTenant];

  app.get(
    "/restaurants/:restaurantId/recipes",
    {
      schema: { tags: ["recipes"] },
      preHandler: [...tenantAuth, requirePermission("inventory.manage")],
    },
    async (request, reply) => {
      const { restaurantId } = request.params as { restaurantId: string };
      const restaurant = await inventory.findRestaurant(
        request.tenant!.organizationId,
        restaurantId,
      );
      if (!restaurant) {
        return reply.status(404).send(errorEnvelope("NOT_FOUND", "Not found"));
      }
      return {
        success: true,
        data: { recipes: await service.list(request.tenant!, restaurantId) },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/restaurants/:restaurantId/recipes",
    {
      schema: { tags: ["recipes"] },
      preHandler: [...tenantAuth, requirePermission("inventory.manage")],
    },
    async (request, reply) => {
      const parsed = createRecipeBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid recipe payload"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      const restaurant = await inventory.findRestaurant(
        request.tenant!.organizationId,
        restaurantId,
      );
      if (!restaurant) {
        return reply.status(404).send(errorEnvelope("NOT_FOUND", "Not found"));
      }
      const recipe = await service.create(request.tenant!, restaurantId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: recipe,
        meta: { requestId: request.id },
      });
    },
  );

  app.patch(
    "/recipes/:id",
    {
      schema: { tags: ["recipes"] },
      preHandler: [...tenantAuth, requirePermission("inventory.manage")],
    },
    async (request, reply) => {
      const parsed = patchRecipeBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid recipe payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.patch(request.tenant!, id, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.delete(
    "/recipes/:id",
    {
      schema: { tags: ["recipes"] },
      preHandler: [...tenantAuth, requirePermission("inventory.manage")],
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
};
