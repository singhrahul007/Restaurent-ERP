import type { FastifyPluginAsync } from "fastify";
import { closeShiftBodySchema, openShiftBodySchema } from "@niva/validation";
import { requirePermission } from "../../lib/authorize.js";
import type { ShiftService } from "./shifts.service.js";

export function createShiftRoutes(shifts: ShiftService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get<{ Querystring: { branchId?: string } }>(
      "/active",
      { preHandler: [requirePermission("shifts.view")] },
      async (req) => {
        const shift = await shifts.getActiveShift(req.tenant!, req.authUser!.id, req.query.branchId);
        return { shift };
      },
    );

    fastify.get<{ Querystring: { branchId: string } }>(
      "/",
      { preHandler: [requirePermission("shifts.view")] },
      async (req) => {
        const list = await shifts.listShifts(req.tenant!, req.query.branchId);
        return { shifts: list };
      },
    );

    fastify.post(
      "/open",
      { preHandler: [requirePermission("shifts.manage")] },
      async (req, reply) => {
        const body = openShiftBodySchema.parse(req.body);
        const shift = await shifts.openShift(req.tenant!, req.authUser!.id, body);
        reply.code(201);
        return { shift };
      },
    );

    fastify.post<{ Params: { id: string } }>(
      "/:id/close",
      { preHandler: [requirePermission("shifts.manage")] },
      async (req) => {
        const body = closeShiftBodySchema.parse(req.body);
        const shift = await shifts.closeShift(
          req.tenant!,
          req.authUser!.id,
          req.params.id,
          body,
          req.permissions?.has("shifts.manage") ?? false,
        );
        return { shift };
      },
    );
  };
}
