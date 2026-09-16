import type { FastifyPluginAsync } from "fastify";
import type { ApiEnv } from "@niva/config";
import type { Database } from "@niva/database";
import { inviteStaffBodySchema, patchStaffBodySchema } from "@niva/validation";
import { requirePermission } from "../../lib/authorize.js";
import { errorEnvelope } from "../../lib/envelope.js";
import { isAppError } from "../../lib/errors.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { createAuthRepository } from "../auth/auth.repository.js";
import { createTenancyRepository } from "../tenancy/tenancy.repository.js";
import { createRequireTenant } from "../../lib/tenant-context.js";
import { createStaffRepository } from "./staff.repository.js";
import { createStaffService } from "./staff.service.js";

export const staffRoutes: FastifyPluginAsync<{
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
  const service = createStaffService(
    opts.db,
    createStaffRepository(opts.db),
    authRepository,
  );
  const tenantAuth = [requireAuth, requireTenant];

  app.get(
    "/staff",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [...tenantAuth, requirePermission("staff.view")],
    },
    async (request) => ({
      success: true,
      data: { staff: await service.list(request.tenant!) },
      meta: { requestId: request.id },
    }),
  );

  app.post(
    "/staff/invites",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [...tenantAuth, requirePermission("staff.manage")],
    },
    async (request, reply) => {
      const parsed = inviteStaffBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid invite payload"));
      }
      const invited = await service.invite(
        request.tenant!,
        request.authUser!.id,
        parsed.data,
        {
          ip: request.ip,
          userAgent: request.headers["user-agent"],
        },
      );
      if (opts.env.NODE_ENV === "production") {
        invited.inviteToken = undefined;
      }
      return reply.status(201).send({
        success: true,
        data: invited,
        meta: { requestId: request.id },
      });
    },
  );

  app.patch(
    "/staff/:membershipId",
    {
      schema: { tags: ["tenancy"] },
      preHandler: [...tenantAuth, requirePermission("staff.manage")],
    },
    async (request, reply) => {
      const parsed = patchStaffBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid staff payload"));
      }
      const { membershipId } = request.params as { membershipId: string };
      const row = await service.update(
        request.tenant!,
        request.authUser!.id,
        membershipId,
        parsed.data,
        {
          ip: request.ip,
          userAgent: request.headers["user-agent"],
        },
      );
      return {
        success: true,
        data: row,
        meta: { requestId: request.id },
      };
    },
  );
};
