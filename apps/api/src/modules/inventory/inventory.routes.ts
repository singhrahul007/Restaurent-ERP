import type { FastifyPluginAsync } from "fastify";
import type { ApiEnv } from "@niva/config";
import type { Database } from "@niva/database";
import {
  createInventoryItemBodySchema,
  createInventoryTransactionBodySchema,
  createPurchaseOrderBodySchema,
  createSupplierBodySchema,
  createTransferBodySchema,
  createUnitBodySchema,
  createUnitConversionBodySchema,
  patchInventoryItemBodySchema,
  patchSupplierBodySchema,
} from "@niva/validation";
import { requirePermission } from "../../lib/authorize.js";
import { errorEnvelope } from "../../lib/envelope.js";
import { isAppError } from "../../lib/errors.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { createAuthRepository } from "../auth/auth.repository.js";
import { createTenancyRepository } from "../tenancy/tenancy.repository.js";
import { createRequireTenant } from "../../lib/tenant-context.js";
import { createInventoryRepository } from "./inventory.repository.js";
import { createInventoryService } from "./inventory.service.js";

function readIdempotencyKey(header: string | string[] | undefined): string | null {
  if (typeof header !== "string") {
    return null;
  }
  const trimmed = header.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const inventoryRoutes: FastifyPluginAsync<{
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
  const repository = createInventoryRepository(opts.db);
  const service = createInventoryService(repository, opts.db);
  const tenantAuth = [requireAuth, requireTenant];

  app.get(
    "/restaurants/:restaurantId/units",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.view")],
    },
    async (request) => {
      const { restaurantId } = request.params as { restaurantId: string };
      return {
        success: true,
        data: { units: await service.listUnits(request.tenant!, restaurantId) },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/restaurants/:restaurantId/units",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.manage")],
    },
    async (request, reply) => {
      const parsed = createUnitBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid unit payload"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      const unit = await service.createUnit(request.tenant!, restaurantId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: unit,
        meta: { requestId: request.id },
      });
    },
  );

  app.post(
    "/restaurants/:restaurantId/unit-conversions",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.manage")],
    },
    async (request, reply) => {
      const parsed = createUnitConversionBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid conversion payload"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      const conversion = await service.createConversion(
        request.tenant!,
        restaurantId,
        parsed.data,
      );
      return reply.status(201).send({
        success: true,
        data: conversion,
        meta: { requestId: request.id },
      });
    },
  );

  app.get(
    "/restaurants/:restaurantId/inventory/items",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.view")],
    },
    async (request) => {
      const { restaurantId } = request.params as { restaurantId: string };
      const branchId = (request.query as { branchId?: string }).branchId;
      return {
        success: true,
        data: {
          items: await service.listItems(request.tenant!, restaurantId, branchId),
        },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/restaurants/:restaurantId/inventory/items",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.manage")],
    },
    async (request, reply) => {
      const parsed = createInventoryItemBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid inventory item payload"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      const item = await service.createItem(request.tenant!, restaurantId, parsed.data);
      return reply.status(201).send({
        success: true,
        data: item,
        meta: { requestId: request.id },
      });
    },
  );

  app.patch(
    "/inventory/items/:id",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.manage")],
    },
    async (request, reply) => {
      const parsed = patchInventoryItemBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid inventory item payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.patchItem(request.tenant!, id, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.get(
    "/branches/:branchId/inventory/items",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.view")],
    },
    async (request) => {
      const { branchId } = request.params as { branchId: string };
      return {
        success: true,
        data: { items: await service.listBranchItems(request.tenant!, branchId) },
        meta: { requestId: request.id },
      };
    },
  );

  app.get(
    "/branches/:branchId/inventory/transactions",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.view")],
    },
    async (request) => {
      const { branchId } = request.params as { branchId: string };
      return {
        success: true,
        data: {
          transactions: await service.listTransactions(request.tenant!, branchId),
        },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/branches/:branchId/inventory/transactions",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.manage")],
    },
    async (request, reply) => {
      const parsed = createInventoryTransactionBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid inventory transaction payload"));
      }
      const { branchId } = request.params as { branchId: string };
      const txn = await service.applyTransaction(
        request.tenant!,
        request.authUser!.id,
        branchId,
        parsed.data,
        {
          ip: request.ip,
          userAgent: request.headers["user-agent"],
          idempotencyKey: readIdempotencyKey(request.headers["idempotency-key"]),
        },
      );
      return reply.status(201).send({
        success: true,
        data: txn,
        meta: { requestId: request.id },
      });
    },
  );

  app.get(
    "/restaurants/:restaurantId/inventory/alerts",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.view")],
    },
    async (request) => {
      const { restaurantId } = request.params as { restaurantId: string };
      return {
        success: true,
        data: { alerts: await service.listAlerts(request.tenant!, restaurantId) },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/restaurants/:restaurantId/inventory/transfers",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.manage")],
    },
    async (request, reply) => {
      const parsed = createTransferBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid transfer payload"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      const transfer = await service.transfer(
        request.tenant!,
        request.authUser!.id,
        restaurantId,
        parsed.data,
      );
      return reply.status(201).send({
        success: true,
        data: transfer,
        meta: { requestId: request.id },
      });
    },
  );

  app.get(
    "/restaurants/:restaurantId/suppliers",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.view")],
    },
    async (request) => {
      const { restaurantId } = request.params as { restaurantId: string };
      return {
        success: true,
        data: { suppliers: await service.listSuppliers(request.tenant!, restaurantId) },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/restaurants/:restaurantId/suppliers",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.manage")],
    },
    async (request, reply) => {
      const parsed = createSupplierBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid supplier payload"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      const supplier = await service.createSupplier(
        request.tenant!,
        restaurantId,
        parsed.data,
      );
      return reply.status(201).send({
        success: true,
        data: supplier,
        meta: { requestId: request.id },
      });
    },
  );

  app.patch(
    "/suppliers/:id",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.manage")],
    },
    async (request, reply) => {
      const parsed = patchSupplierBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid supplier payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.patchSupplier(request.tenant!, id, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.delete(
    "/suppliers/:id",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.manage")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      await service.deleteSupplier(request.tenant!, id);
      return {
        success: true,
        data: { ok: true },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/branches/:branchId/purchase-orders",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.manage")],
    },
    async (request, reply) => {
      const parsed = createPurchaseOrderBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid purchase order payload"));
      }
      const { branchId } = request.params as { branchId: string };
      const po = await service.createPurchaseOrder(
        request.tenant!,
        request.authUser!.id,
        branchId,
        parsed.data,
      );
      return reply.status(201).send({
        success: true,
        data: po,
        meta: { requestId: request.id },
      });
    },
  );

  app.post(
    "/purchase-orders/:id/receive",
    {
      schema: { tags: ["inventory"] },
      preHandler: [...tenantAuth, requirePermission("inventory.manage")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.receivePurchaseOrder(
          request.tenant!,
          request.authUser!.id,
          id,
        ),
        meta: { requestId: request.id },
      };
    },
  );
};
