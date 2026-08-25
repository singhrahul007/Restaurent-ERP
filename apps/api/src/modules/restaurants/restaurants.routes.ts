import type { FastifyPluginAsync } from "fastify";
import type { ApiEnv } from "@niva/config";
import type { Database } from "@niva/database";
import {
  assignBranchBodySchema,
  createBranchBodySchema,
  createRestaurantBodySchema,
  patchBranchBodySchema,
  patchRestaurantBodySchema,
} from "@niva/validation";
import { errorEnvelope } from "../../lib/envelope.js";
import { isAppError } from "../../lib/errors.js";
import { requirePermission } from "../../lib/authorize.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { createAuthRepository } from "../auth/auth.repository.js";
import { createTenancyRepository } from "../tenancy/tenancy.repository.js";
import { createRequireTenant } from "../../lib/tenant-context.js";
import { createRestaurantRepository } from "./restaurants.repository.js";
import { createRestaurantService } from "./restaurants.service.js";

export const restaurantRoutes: FastifyPluginAsync<{
  db: Database;
  env: ApiEnv;
}> = async (app, opts) => {
  app.setErrorHandler((error, request, reply) => {
    if (isAppError(error)) {
      return reply
        .status(error.statusCode)
        .send(errorEnvelope(error.code, error.message));
    }
    return reply.send(error);
  });

  const authRepository = createAuthRepository(opts.db);
  const tenancy = createTenancyRepository(opts.db);
  const requireAuth = createRequireAuth(opts.env, authRepository, tenancy);
  const requireTenant = createRequireTenant(opts.env, tenancy);
  const service = createRestaurantService(
    createRestaurantRepository(opts.db),
    tenancy,
  );

  const tenantAuth = [requireAuth, requireTenant];

  app.get(
    "/restaurants",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [...tenantAuth, requirePermission("restaurant.view")],
    },
    async (request) => ({
      success: true,
      data: { restaurants: await service.list(request.tenant!) },
      meta: { requestId: request.id },
    }),
  );

  app.post(
    "/restaurants",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [...tenantAuth, requirePermission("restaurant.manage")],
    },
    async (request, reply) => {
      const parsed = createRestaurantBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid restaurant payload"));
      }
      const restaurant = await service.create(request.tenant!, parsed.data);
      return reply.status(201).send({
        success: true,
        data: restaurant,
        meta: { requestId: request.id },
      });
    },
  );

  app.get(
    "/restaurants/:id",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [...tenantAuth, requirePermission("restaurant.view")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.get(request.tenant!, id),
        meta: { requestId: request.id },
      };
    },
  );

  app.patch(
    "/restaurants/:id",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [...tenantAuth, requirePermission("restaurant.manage")],
    },
    async (request, reply) => {
      const parsed = patchRestaurantBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid restaurant payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.update(request.tenant!, id, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.delete(
    "/restaurants/:id",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [...tenantAuth, requirePermission("restaurant.manage")],
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

  app.get(
    "/restaurants/:id/branches",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [...tenantAuth, requirePermission("branch.view")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: { branches: await service.listBranches(request.tenant!, id) },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/restaurants/:id/branches",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [...tenantAuth, requirePermission("branch.manage")],
    },
    async (request, reply) => {
      const parsed = createBranchBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid branch payload"));
      }
      const { id } = request.params as { id: string };
      const branch = await service.createBranch(
        request.tenant!,
        id,
        parsed.data.name,
      );
      return reply.status(201).send({
        success: true,
        data: branch,
        meta: { requestId: request.id },
      });
    },
  );

  app.get(
    "/branches/:id",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [...tenantAuth, requirePermission("branch.view")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.getBranch(request.tenant!, id),
        meta: { requestId: request.id },
      };
    },
  );

  app.patch(
    "/branches/:id",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [...tenantAuth, requirePermission("branch.manage")],
    },
    async (request, reply) => {
      const parsed = patchBranchBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid branch payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.updateBranch(request.tenant!, id, parsed.data.name),
        meta: { requestId: request.id },
      };
    },
  );

  app.delete(
    "/branches/:id",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [...tenantAuth, requirePermission("branch.manage")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      await service.removeBranch(request.tenant!, id);
      return {
        success: true,
        data: { ok: true },
        meta: { requestId: request.id },
      };
    },
  );

  app.get(
    "/branches/:id/assignments",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [...tenantAuth, requirePermission("staff.manage")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: { assignments: await service.listAssignments(request.tenant!, id) },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/branches/:id/assignments",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [...tenantAuth, requirePermission("staff.manage")],
    },
    async (request, reply) => {
      const parsed = assignBranchBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid assignment payload"));
      }
      const { id } = request.params as { id: string };
      const assignment = await service.assignBranch(
        request.tenant!,
        id,
        parsed.data.membershipId,
      );
      return reply.status(201).send({
        success: true,
        data: assignment,
        meta: { requestId: request.id },
      });
    },
  );

  app.delete(
    "/branches/:id/assignments/:membershipId",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [...tenantAuth, requirePermission("staff.manage")],
    },
    async (request) => {
      const { id, membershipId } = request.params as {
        id: string;
        membershipId: string;
      };
      await service.unassignBranch(request.tenant!, id, membershipId);
      return {
        success: true,
        data: { ok: true },
        meta: { requestId: request.id },
      };
    },
  );
};

