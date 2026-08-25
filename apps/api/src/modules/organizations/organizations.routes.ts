import type { FastifyPluginAsync } from "fastify";
import type { ApiEnv } from "@niva/config";
import type { Database } from "@niva/database";
import {
  createOrganizationBodySchema,
  patchOrganizationBodySchema,
} from "@niva/validation";
import { errorEnvelope } from "../../lib/envelope.js";
import { AppError, isAppError } from "../../lib/errors.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { createAuthRepository } from "../auth/auth.repository.js";
import { createTenancyRepository } from "../tenancy/tenancy.repository.js";
import {
  createRequireTenant,
  setOrganizationCookie,
} from "../../lib/tenant-context.js";

export const organizationRoutes: FastifyPluginAsync<{
  db: Database;
  env: ApiEnv;
}> = async (app, opts) => {
  app.setErrorHandler((error, _request, reply) => {
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

  app.get(
    "/organizations",
    { schema: { tags: ["tenancy"] }, preHandler: requireAuth },
    async (request) => {
      const memberships = await tenancy.listMemberships(request.authUser!.id);
      return {
        success: true,
        data: { organizations: memberships },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/organizations",
    { schema: { tags: ["tenancy"] }, preHandler: requireAuth },
    async (request, reply) => {
      const parsed = createOrganizationBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid organization payload"));
      }

      const organization = await tenancy.insertOrganization(parsed.data.name);
      await tenancy.insertOwnerMembership(request.authUser!.id, organization.id);
      setOrganizationCookie(reply, opts.env, organization.id);
      return reply.status(201).send({
        success: true,
        data: organization,
        meta: { requestId: request.id },
      });
    },
  );

  app.get(
    "/organizations/:id",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [requireAuth, requireTenant],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      if (id !== request.tenant!.organizationId) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      const organization = await tenancy.findOrganization(id);
      if (!organization) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return {
        success: true,
        data: organization,
        meta: { requestId: request.id },
      };
    },
  );

  app.patch(
    "/organizations/:id",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [requireAuth, requireTenant],
    },
    async (request, reply) => {
      if (!request.tenant?.isOwner) {
        return reply.status(403).send(errorEnvelope("FORBIDDEN", "Forbidden"));
      }
      const parsed = patchOrganizationBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid organization payload"));
      }
      const { id } = request.params as { id: string };
      if (id !== request.tenant.organizationId) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      const organization = await tenancy.updateOrganizationName(id, parsed.data.name);
      if (!organization) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return {
        success: true,
        data: organization,
        meta: { requestId: request.id },
      };
    },
  );
};
