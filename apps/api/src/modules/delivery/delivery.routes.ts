import type { FastifyPluginAsync } from "fastify";
import type { ApiEnv } from "@niva/config";
import { hasPermission, emptyPermissionSet } from "@niva/auth";
import type { Database } from "@niva/database";
import {
  assignDeliveryBodySchema,
  confirmDeliveryBodySchema,
  deliveryShiftBodySchema,
} from "@niva/validation";
import { requireAnyPermission, requirePermission } from "../../lib/authorize.js";
import { errorEnvelope } from "../../lib/envelope.js";
import { isAppError } from "../../lib/errors.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { createAuthRepository } from "../auth/auth.repository.js";
import { createTenancyRepository } from "../tenancy/tenancy.repository.js";
import { createRequireTenant } from "../../lib/tenant-context.js";
import { createDeliveryRepository } from "./delivery.repository.js";
import { createDeliveryService } from "./delivery.service.js";

export const deliveryRoutes: FastifyPluginAsync<{
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
  const service = createDeliveryService(
    createDeliveryRepository(opts.db),
    opts.db,
    opts.env,
  );
  const tenantAuth = [requireAuth, requireTenant];

  app.get(
    "/delivery/me",
    {
      schema: { tags: ["delivery"] },
      preHandler: [...tenantAuth, requirePermission("delivery.self")],
    },
    async (request) => ({
      success: true,
      data: await service.me(request.tenant!, request.authUser!.id),
      meta: { requestId: request.id },
    }),
  );

  app.post(
    "/delivery/me/shift",
    {
      schema: { tags: ["delivery"] },
      preHandler: [...tenantAuth, requirePermission("delivery.self")],
    },
    async (request, reply) => {
      const parsed = deliveryShiftBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid shift payload"));
      }
      const agent = await service.setOnline(
        request.tenant!,
        request.authUser!.id,
        parsed.data.online,
        { ip: request.ip, userAgent: request.headers["user-agent"] },
      );
      return {
        success: true,
        data: agent,
        meta: { requestId: request.id },
      };
    },
  );

  app.get(
    "/delivery/me/jobs",
    {
      schema: { tags: ["delivery"] },
      preHandler: [...tenantAuth, requirePermission("delivery.self")],
    },
    async (request) => ({
      success: true,
      data: { deliveries: await service.listMine(request.tenant!, request.authUser!.id) },
      meta: { requestId: request.id },
    }),
  );

  app.get(
    "/delivery/me/earnings",
    {
      schema: { tags: ["delivery"] },
      preHandler: [...tenantAuth, requirePermission("delivery.self")],
    },
    async (request) => {
      const date = (request.query as { date?: string }).date;
      return {
        success: true,
        data: await service.myEarnings(request.tenant!, request.authUser!.id, date),
        meta: { requestId: request.id },
      };
    },
  );

  app.get(
    "/delivery/agents",
    {
      schema: { tags: ["delivery"] },
      preHandler: [...tenantAuth, requirePermission("delivery.manage")],
    },
    async (request) => ({
      success: true,
      data: { agents: await service.listAgents(request.tenant!) },
      meta: { requestId: request.id },
    }),
  );

  app.post(
    "/deliveries",
    {
      schema: { tags: ["delivery"] },
      preHandler: [...tenantAuth, requirePermission("delivery.manage")],
    },
    async (request, reply) => {
      const parsed = assignDeliveryBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid assign payload"));
      }
      const assigned = await service.assign(
        request.tenant!,
        request.authUser!.id,
        parsed.data,
      );
      return reply.status(201).send({
        success: true,
        data: assigned,
        meta: { requestId: request.id },
      });
    },
  );

  app.get(
    "/deliveries/:id",
    {
      schema: { tags: ["delivery"] },
      preHandler: [...tenantAuth, requireAnyPermission("delivery.self", "delivery.manage")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const canManage = hasPermission(request.permissions ?? emptyPermissionSet(), "delivery.manage");
      return {
        success: true,
        data: await service.get(request.tenant!, request.authUser!.id, id, canManage),
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/deliveries/:id/pickup",
    {
      schema: { tags: ["delivery"] },
      preHandler: [...tenantAuth, requireAnyPermission("delivery.self", "delivery.manage")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const canManage = hasPermission(request.permissions ?? emptyPermissionSet(), "delivery.manage");
      return {
        success: true,
        data: await service.pickup(request.tenant!, request.authUser!.id, id, canManage),
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/deliveries/:id/confirm",
    {
      schema: { tags: ["delivery"] },
      preHandler: [...tenantAuth, requireAnyPermission("delivery.self", "delivery.manage")],
    },
    async (request, reply) => {
      const parsed = confirmDeliveryBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid confirm payload"));
      }
      const { id } = request.params as { id: string };
      const canManage = hasPermission(request.permissions ?? emptyPermissionSet(), "delivery.manage");
      return {
        success: true,
        data: await service.confirm(
          request.tenant!,
          request.authUser!.id,
          id,
          parsed.data,
          canManage,
        ),
        meta: { requestId: request.id },
      };
    },
  );
};
