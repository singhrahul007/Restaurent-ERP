import type { FastifyPluginAsync } from "fastify";
import { createReservationBodySchema, patchReservationBodySchema } from "@niva/validation";
import { requirePermission } from "../../lib/authorize.js";
import type { ReservationService } from "./reservations.service.js";

export function createReservationRoutes(reservations: ReservationService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get<{ Querystring: { branchId: string; from?: string; to?: string } }>(
      "/",
      { preHandler: [requirePermission("reservations.view")] },
      async (req) => {
        const list = await reservations.listReservations(
          req.tenant!,
          req.query.branchId,
          req.query.from,
          req.query.to,
        );
        return { reservations: list };
      },
    );

    fastify.post(
      "/",
      { preHandler: [requirePermission("reservations.manage")] },
      async (req, reply) => {
        const body = createReservationBodySchema.parse(req.body);
        const created = await reservations.createReservation(req.tenant!, body);
        reply.code(201);
        return { reservation: created };
      },
    );

    fastify.patch<{ Params: { id: string } }>(
      "/:id",
      { preHandler: [requirePermission("reservations.manage")] },
      async (req) => {
        const body = patchReservationBodySchema.parse(req.body);
        const updated = await reservations.patchReservation(req.tenant!, req.params.id, body);
        return { reservation: updated };
      },
    );
  };
}
