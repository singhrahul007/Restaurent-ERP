import { writeAudit, type Database } from "@niva/database";
import type { CreateExpenseBody, PatchExpenseBody } from "@niva/validation";
import { AppError } from "../../lib/errors.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import type { ExpenseRepository } from "./expenses.repository.js";

function assertBranch(tenant: TenantContext, branchId: string) {
  if (tenant.allowedBranchIds && !tenant.allowedBranchIds.includes(branchId)) {
    throw new AppError("NOT_FOUND", "Not found", 404);
  }
}

export function createExpenseService(expenses: ExpenseRepository, db: Database) {
  async function requireRestaurant(tenant: TenantContext, restaurantId: string) {
    const row = await expenses.findRestaurant(tenant.organizationId, restaurantId);
    if (!row) {
      throw new AppError("NOT_FOUND", "Not found", 404);
    }
    return row;
  }

  async function resolveBranch(
    tenant: TenantContext,
    restaurantId: string,
    branchId: string | null | undefined,
  ) {
    if (!branchId) {
      return null;
    }
    assertBranch(tenant, branchId);
    const branch = await expenses.findBranch(tenant.organizationId, branchId);
    if (!branch || branch.restaurantId !== restaurantId) {
      throw new AppError("NOT_FOUND", "Not found", 404);
    }
    return branchId;
  }

  return {
    async list(tenant: TenantContext, restaurantId: string, branchId?: string) {
      await requireRestaurant(tenant, restaurantId);
      if (branchId) {
        await resolveBranch(tenant, restaurantId, branchId);
      }
      return expenses.list(tenant.organizationId, restaurantId, branchId);
    },

    async create(
      tenant: TenantContext,
      actorId: string,
      restaurantId: string,
      body: CreateExpenseBody,
      context: { ip?: string; userAgent?: string },
    ) {
      await requireRestaurant(tenant, restaurantId);
      const branchId = await resolveBranch(tenant, restaurantId, body.branchId);
      const row = await expenses.insert({
        organizationId: tenant.organizationId,
        restaurantId,
        branchId,
        category: body.category,
        amountMinor: body.amountMinor,
        incurredAt: body.incurredAt,
        notes: body.notes,
        createdBy: actorId,
      });
      await writeAudit(db, {
        actorId,
        organizationId: tenant.organizationId,
        action: "SETTINGS_CHANGED",
        resourceType: "expense",
        resourceId: row.id,
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { category: row.category, amountMinor: row.amountMinor },
      });
      return row;
    },

    async patch(
      tenant: TenantContext,
      id: string,
      restaurantId: string,
      body: PatchExpenseBody,
    ) {
      await requireRestaurant(tenant, restaurantId);
      if (body.branchId !== undefined) {
        await resolveBranch(tenant, restaurantId, body.branchId);
      }
      const existing = await expenses.findById(tenant.organizationId, id);
      if (!existing || existing.restaurantId !== restaurantId) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      const row = await expenses.update(tenant.organizationId, id, body);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return row;
    },

    async remove(tenant: TenantContext, id: string, restaurantId: string) {
      await requireRestaurant(tenant, restaurantId);
      const existing = await expenses.findById(tenant.organizationId, id);
      if (!existing || existing.restaurantId !== restaurantId) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      await expenses.remove(tenant.organizationId, id);
    },
  };
}
