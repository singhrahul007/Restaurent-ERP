import type { FastifyPluginAsync } from "fastify";
import type { ApiEnv } from "@niva/config";
import type { Database } from "@niva/database";
import {
  attachModifierGroupsBodySchema,
  createCategoryBodySchema,
  createMenuItemBodySchema,
  createModifierBodySchema,
  createModifierGroupBodySchema,
  createTaxClassBodySchema,
  createTaxRateBodySchema,
  createVariantBodySchema,
  patchCategoryBodySchema,
  patchMenuItemBodySchema,
  patchModifierBodySchema,
  patchModifierGroupBodySchema,
  patchTaxClassBodySchema,
  patchVariantBodySchema,
  upsertAvailabilityBodySchema,
} from "@niva/validation";
import { requirePermission } from "../../lib/authorize.js";
import { errorEnvelope } from "../../lib/envelope.js";
import { isAppError } from "../../lib/errors.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { createAuthRepository } from "../auth/auth.repository.js";
import { createTenancyRepository } from "../tenancy/tenancy.repository.js";
import { createRequireTenant } from "../../lib/tenant-context.js";
import { createMenuRepository } from "./menu.repository.js";
import { createMenuService } from "./menu.service.js";

export const menuRoutes: FastifyPluginAsync<{
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
  const service = createMenuService(createMenuRepository(opts.db));
  const tenantAuth = [requireAuth, requireTenant];

  app.get(
    "/restaurants/:restaurantId/menu",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.view")],
    },
    async (request) => {
      const { restaurantId } = request.params as { restaurantId: string };
      const branchId = (request.query as { branchId?: string }).branchId;
      return {
        success: true,
        data: await service.listMenu(request.tenant!, restaurantId, branchId),
        meta: { requestId: request.id },
      };
    },
  );

  app.get(
    "/restaurants/:restaurantId/tax-classes",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.view")],
    },
    async (request) => {
      const { restaurantId } = request.params as { restaurantId: string };
      return {
        success: true,
        data: { taxClasses: await service.listTaxClasses(request.tenant!, restaurantId) },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/restaurants/:restaurantId/tax-classes",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request, reply) => {
      const parsed = createTaxClassBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid tax class payload"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      const taxClass = await service.createTaxClass(
        request.tenant!,
        restaurantId,
        parsed.data,
      );
      return reply.status(201).send({
        success: true,
        data: taxClass,
        meta: { requestId: request.id },
      });
    },
  );

  app.patch(
    "/tax-classes/:id",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request, reply) => {
      const parsed = patchTaxClassBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid tax class payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.updateTaxClass(request.tenant!, id, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.delete(
    "/tax-classes/:id",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      await service.removeTaxClass(request.tenant!, id);
      return {
        success: true,
        data: { ok: true },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/tax-classes/:id/rates",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request, reply) => {
      const parsed = createTaxRateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid tax rate payload"));
      }
      const { id } = request.params as { id: string };
      const rate = await service.addTaxRate(request.tenant!, id, parsed.data);
      return reply.status(201).send({
        success: true,
        data: rate,
        meta: { requestId: request.id },
      });
    },
  );

  app.get(
    "/restaurants/:restaurantId/menu/categories",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.view")],
    },
    async (request) => {
      const { restaurantId } = request.params as { restaurantId: string };
      return {
        success: true,
        data: {
          categories: await service.listCategories(request.tenant!, restaurantId),
        },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/restaurants/:restaurantId/menu/categories",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request, reply) => {
      const parsed = createCategoryBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid category payload"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      const category = await service.createCategory(
        request.tenant!,
        restaurantId,
        parsed.data,
      );
      return reply.status(201).send({
        success: true,
        data: category,
        meta: { requestId: request.id },
      });
    },
  );

  app.patch(
    "/menu/categories/:id",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request, reply) => {
      const parsed = patchCategoryBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid category payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.updateCategory(request.tenant!, id, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.delete(
    "/menu/categories/:id",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      await service.removeCategory(request.tenant!, id);
      return {
        success: true,
        data: { ok: true },
        meta: { requestId: request.id },
      };
    },
  );

  app.get(
    "/restaurants/:restaurantId/menu/items",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.view")],
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
    "/restaurants/:restaurantId/menu/items",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request, reply) => {
      const parsed = createMenuItemBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid menu item payload"));
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

  app.get(
    "/menu/items/:id",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.view")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.getItem(request.tenant!, id),
        meta: { requestId: request.id },
      };
    },
  );

  app.patch(
    "/menu/items/:id",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request, reply) => {
      const parsed = patchMenuItemBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid menu item payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.updateItem(request.tenant!, id, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.delete(
    "/menu/items/:id",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      await service.removeItem(request.tenant!, id);
      return {
        success: true,
        data: { ok: true },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/menu/items/:id/variants",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request, reply) => {
      const parsed = createVariantBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid variant payload"));
      }
      const { id } = request.params as { id: string };
      const variant = await service.createVariant(request.tenant!, id, parsed.data);
      return reply.status(201).send({
        success: true,
        data: variant,
        meta: { requestId: request.id },
      });
    },
  );

  app.patch(
    "/menu/variants/:id",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request, reply) => {
      const parsed = patchVariantBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid variant payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.updateVariant(request.tenant!, id, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.delete(
    "/menu/variants/:id",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      await service.removeVariant(request.tenant!, id);
      return {
        success: true,
        data: { ok: true },
        meta: { requestId: request.id },
      };
    },
  );

  app.get(
    "/restaurants/:restaurantId/menu/modifier-groups",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.view")],
    },
    async (request) => {
      const { restaurantId } = request.params as { restaurantId: string };
      return {
        success: true,
        data: {
          modifierGroups: await service.listModifierGroups(
            request.tenant!,
            restaurantId,
          ),
        },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/restaurants/:restaurantId/menu/modifier-groups",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request, reply) => {
      const parsed = createModifierGroupBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid modifier group payload"));
      }
      const { restaurantId } = request.params as { restaurantId: string };
      const group = await service.createModifierGroup(
        request.tenant!,
        restaurantId,
        parsed.data,
      );
      return reply.status(201).send({
        success: true,
        data: group,
        meta: { requestId: request.id },
      });
    },
  );

  app.patch(
    "/menu/modifier-groups/:id",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request, reply) => {
      const parsed = patchModifierGroupBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid modifier group payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.updateModifierGroup(request.tenant!, id, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.delete(
    "/menu/modifier-groups/:id",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      await service.removeModifierGroup(request.tenant!, id);
      return {
        success: true,
        data: { ok: true },
        meta: { requestId: request.id },
      };
    },
  );

  app.post(
    "/menu/modifier-groups/:id/modifiers",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request, reply) => {
      const parsed = createModifierBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid modifier payload"));
      }
      const { id } = request.params as { id: string };
      const modifier = await service.createModifier(request.tenant!, id, parsed.data);
      return reply.status(201).send({
        success: true,
        data: modifier,
        meta: { requestId: request.id },
      });
    },
  );

  app.patch(
    "/menu/modifiers/:id",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request, reply) => {
      const parsed = patchModifierBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid modifier payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.updateModifier(request.tenant!, id, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.delete(
    "/menu/modifiers/:id",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      await service.removeModifier(request.tenant!, id);
      return {
        success: true,
        data: { ok: true },
        meta: { requestId: request.id },
      };
    },
  );

  app.put(
    "/menu/items/:id/modifier-groups",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request, reply) => {
      const parsed = attachModifierGroupsBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid attachment payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.attachModifierGroups(
          request.tenant!,
          id,
          parsed.data.modifierGroupIds,
        ),
        meta: { requestId: request.id },
      };
    },
  );

  app.put(
    "/menu/items/:id/availability",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request, reply) => {
      const parsed = upsertAvailabilityBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(errorEnvelope("VALIDATION_ERROR", "Invalid availability payload"));
      }
      const { id } = request.params as { id: string };
      return {
        success: true,
        data: await service.setAvailability(request.tenant!, id, parsed.data),
        meta: { requestId: request.id },
      };
    },
  );

  app.delete(
    "/menu/items/:id/availability",
    {
      schema: { tags: ["menu"] },
      preHandler: [...tenantAuth, requirePermission("menu.manage")],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const branchId = (request.query as { branchId?: string }).branchId ?? null;
      await service.clearAvailability(request.tenant!, id, branchId);
      return {
        success: true,
        data: { ok: true },
        meta: { requestId: request.id },
      };
    },
  );
};
