import type { FastifyPluginAsync } from "fastify";
import type { ApiEnv } from "@niva/config";
import type { Database } from "@niva/database";
import {
  applyCouponBodySchema,
  applyDiscountBodySchema,
  createCouponBodySchema,
  createOrderBodySchema,
  createOrderItemBodySchema,
  createPaymentBodySchema,
  createRefundBodySchema,
  patchOrderItemBodySchema,
} from "@niva/validation";
import { requirePermission } from "../../lib/authorize.js";
import { errorEnvelope } from "../../lib/envelope.js";
import { isAppError } from "../../lib/errors.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { createAuthRepository } from "../auth/auth.repository.js";
import { createTenancyRepository } from "../tenancy/tenancy.repository.js";
import { createRequireTenant } from "../../lib/tenant-context.js";
import { createPaymentRepository } from "../payments/payments.repository.js";
import { createKitchenRepository } from "../kitchen/kitchen.repository.js";
import { createOrderRepository } from "./orders.repository.js";
import { createOrderService } from "./orders.service.js";
import { createPaymentGateway } from "@niva/integrations";

function readIdempotencyKey(header: string | string[] | undefined): string | null {
  if (typeof header !== "string") {
    return null;
  }
  const trimmed = header.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const orderRoutes: FastifyPluginAsync<{
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
  const service = createOrderService(
    createOrderRepository(opts.db),
    createPaymentRepository(opts.db),
    opts.db,
    createKitchenRepository(opts.db),
    createPaymentGateway(),
  );
  const tenantAuth = [requireAuth, requireTenant];

  app.post(
    "/restaurants/:restaurantId/coupons",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("orders.update")],
    },
    async (request, reply) => {
      const parsed = createCouponBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid coupon payload"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      const coupon = await service.createCoupon(request.tenant!, restaurantId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: coupon,
        meta: { requestId: request.id },
      });
    },
  );

  app.get(
    "/branches/:branchId/orders",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("orders.view")],
    },
    async (request) => {
      const { branchId } = request.params as { branchId: string };
      return {
        success: true,
        data: { orders: await service.list(request.tenant!, branchId) },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/branches/:branchId/orders",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("orders.create")],
    },
    async (request, reply) => {
      const parsed = createOrderBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid order payload"));
      }
      const { branchId } = request.params as { branchId: string };
      const order = await service.create(
        request.tenant!,
        request.authUser!.id,
        branchId,
        parsed.data,
        readIdempotencyKey(request.headers["idempotency-key"]),
      );
      return reply.status(201).send({
        success: true,
        data: order,
        meta: { requestId: request.id },
      });
    },
  );

  app.get(
    "/orders/:id",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("orders.view")],
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

  app.post(
    "/orders/:id/items",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("orders.update")],
    },
    async (request, reply) => {
      const parsed = createOrderItemBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid item payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.addItem(request.tenant!, id, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.patch(
    "/order-items/:id",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("orders.update")],
    },
    async (request, reply) => {
      const parsed = patchOrderItemBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid item payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.updateItemQty(request.tenant!, id, parsed.data.qty),
        meta: { requestId: request.id },
      };
    },
  );

  app.delete(
    "/order-items/:id",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("orders.update")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.removeItem(request.tenant!, id),
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/orders/:id/discounts",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("orders.update")],
    },
    async (request, reply) => {
      const parsed = applyDiscountBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid discount payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.applyDiscount(request.tenant!, id, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/orders/:id/coupon",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("orders.update")],
    },
    async (request, reply) => {
      const parsed = applyCouponBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid coupon payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.applyCoupon(request.tenant!, id, parsed.data.code),
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/orders/:id/payments",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("payments.create")],
    },
    async (request, reply) => {
      const parsed = createPaymentBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid payment payload"));
      }
      const { id } = request.params as { id: string };
      const result = await service.createPayment(
        request.tenant!,
        request.authUser!.id,
        id,
        parsed.data,
      );
      return reply.status(201).send({
        success: true,
        data: result,
        meta: { requestId: request.id },
      });
    },
  );

  app.post(
    "/payments/:id/refunds",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("payments.refund")],
    },
    async (request, reply) => {
      const parsed = createRefundBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid refund payload"));
      }
      const { id } = request.params as { id: string };
      const refund = await service.refund(
        request.tenant!,
        request.authUser!.id,
        id,
        parsed.data,
        {
          ip: request.ip,
          userAgent: request.headers["user-agent"],
        },
      );
      return reply.status(201).send({
        success: true,
        data: refund,
        meta: { requestId: request.id },
      });
    },
  );

  app.post(
    "/orders/:id/confirm",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("orders.update")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.confirm(request.tenant!, request.authUser!.id, id),
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/orders/:id/ready",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("orders.update")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.transitionTo(
          request.tenant!,
          request.authUser!.id,
          id,
          "READY",
        ),
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/orders/:id/serve",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("orders.update")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.transitionTo(
          request.tenant!,
          request.authUser!.id,
          id,
          "SERVED",
        ),
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/orders/:id/hand-over",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("orders.update")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.transitionTo(
          request.tenant!,
          request.authUser!.id,
          id,
          "HANDED_OVER",
        ),
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/orders/:id/complete",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("orders.update")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.complete(request.tenant!, request.authUser!.id, id),
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/orders/:id/cancel",
    {
      schema: { tags: ["orders"] },
      preHandler: [...tenantAuth, requirePermission("orders.cancel")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.cancel(request.tenant!, request.authUser!.id, id, {
          ip: request.ip,
          userAgent: request.headers["user-agent"],
        }),
        meta: { requestId: request.id },
      };
    },
  );
};
