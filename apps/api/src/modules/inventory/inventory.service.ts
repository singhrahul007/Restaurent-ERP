import { withOrganizationScope, writeAudit, type Database } from "@niva/database";
import type {
  CreateInventoryItemBody,
  CreateInventoryTransactionBody,
  CreatePurchaseOrderBody,
  CreateSupplierBody,
  CreateTransferBody,
  CreateUnitBody,
  CreateUnitConversionBody,
  PatchInventoryItemBody,
  PatchSupplierBody,
} from "@niva/validation";
import { AppError, isUniqueViolation } from "../../lib/errors.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import {
  convertToBaseQty,
  type InventoryRepository,
  type MovementError,
} from "./inventory.repository.js";

function assertBranch(tenant: TenantContext, branchId: string) {
  if (tenant.allowedBranchIds && !tenant.allowedBranchIds.includes(branchId)) {
    throw new AppError("NOT_FOUND", "Not found", 404);
  }
}

function movementError(code: MovementError): never {
  if (code === "ITEM_NOT_FOUND") {
    throw new AppError("NOT_FOUND", "Not found", 404);
  }
  if (code === "INSUFFICIENT_STOCK") {
    throw new AppError("CONFLICT", "Insufficient stock", 409);
  }
  if (code === "UNIT_CONVERSION_MISSING") {
    throw new AppError("VALIDATION_ERROR", "No integer conversion between units", 400);
  }
  throw new AppError("VALIDATION_ERROR", "Conversion is not an integer quantity", 400);
}

export function createInventoryService(inventory: InventoryRepository, db: Database) {
  async function requireRestaurant(tenant: TenantContext, restaurantId: string) {
    const row = await inventory.findRestaurant(tenant.organizationId, restaurantId);
    if (!row) {
      throw new AppError("NOT_FOUND", "Not found", 404);
    }
    return row;
  }

  async function requireBranch(tenant: TenantContext, branchId: string) {
    assertBranch(tenant, branchId);
    const row = await inventory.findBranch(tenant.organizationId, branchId);
    if (!row) {
      throw new AppError("NOT_FOUND", "Not found", 404);
    }
    return row;
  }

  return {
    async listUnits(tenant: TenantContext, restaurantId: string) {
      await requireRestaurant(tenant, restaurantId);
      await inventory.ensureDefaultUnits(tenant.organizationId, restaurantId);
      return inventory.listUnits(tenant.organizationId, restaurantId);
    },

    async createUnit(tenant: TenantContext, restaurantId: string, body: CreateUnitBody) {
      await requireRestaurant(tenant, restaurantId);
      try {
        return await inventory.insertUnit({
          organizationId: tenant.organizationId,
          restaurantId,
          ...body,
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError("CONFLICT", "Unit code already exists", 409);
        }
        throw error;
      }
    },

    async createConversion(
      tenant: TenantContext,
      restaurantId: string,
      body: CreateUnitConversionBody,
    ) {
      await requireRestaurant(tenant, restaurantId);
      const from = await inventory.findUnit(tenant.organizationId, body.fromUnitId);
      const to = await inventory.findUnit(tenant.organizationId, body.toUnitId);
      if (!from || !to || from.restaurantId !== restaurantId || to.restaurantId !== restaurantId) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      if (from.dimension !== to.dimension) {
        throw new AppError("VALIDATION_ERROR", "Units must share a dimension", 400);
      }
      try {
        return await inventory.insertConversion({
          organizationId: tenant.organizationId,
          ...body,
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError("CONFLICT", "Conversion already exists", 409);
        }
        throw error;
      }
    },

    async listItems(tenant: TenantContext, restaurantId: string, branchId?: string) {
      await requireRestaurant(tenant, restaurantId);
      await inventory.ensureDefaultUnits(tenant.organizationId, restaurantId);
      if (branchId) {
        const branch = await requireBranch(tenant, branchId);
        if (branch.restaurantId !== restaurantId) {
          throw new AppError("NOT_FOUND", "Not found", 404);
        }
      }
      return inventory.listItems(tenant.organizationId, restaurantId, branchId);
    },

    async listBranchItems(tenant: TenantContext, branchId: string) {
      const branch = await requireBranch(tenant, branchId);
      await inventory.ensureDefaultUnits(tenant.organizationId, branch.restaurantId);
      return inventory.listItems(tenant.organizationId, branch.restaurantId, branchId);
    },

    async createItem(tenant: TenantContext, restaurantId: string, body: CreateInventoryItemBody) {
      await requireRestaurant(tenant, restaurantId);
      const unit = await inventory.findUnit(tenant.organizationId, body.baseUnitId);
      if (!unit || unit.restaurantId !== restaurantId) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      try {
        return await inventory.insertItem({
          organizationId: tenant.organizationId,
          restaurantId,
          ...body,
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError("CONFLICT", "SKU already exists", 409);
        }
        throw error;
      }
    },

    async patchItem(tenant: TenantContext, id: string, body: PatchInventoryItemBody) {
      const row = await inventory.updateItem(tenant.organizationId, id, body);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return row;
    },

    async listTransactions(tenant: TenantContext, branchId: string) {
      await requireBranch(tenant, branchId);
      return inventory.listTransactions(tenant.organizationId, branchId);
    },

    async applyTransaction(
      tenant: TenantContext,
      actorId: string,
      branchId: string,
      body: CreateInventoryTransactionBody,
      context: { ip?: string | null; userAgent?: string | null; idempotencyKey: string | null },
    ) {
      await requireBranch(tenant, branchId);
      if (context.idempotencyKey) {
        const existing = await inventory.findByIdempotency(
          tenant.organizationId,
          context.idempotencyKey,
        );
        if (existing) {
          return existing;
        }
      }
      try {
        const result = await inventory.applyMovement({
          organizationId: tenant.organizationId,
          inventoryItemId: body.inventoryItemId,
          branchId,
          type: body.type,
          qtyInUnit: body.qtyInUnit,
          unitId: body.unitId,
          reason: body.reason,
          actorId,
          idempotencyKey: context.idempotencyKey,
        });
        if (result.error) {
          movementError(result.error);
        }
        await writeAudit(db, {
          actorId,
          organizationId: tenant.organizationId,
          action: "INVENTORY_ADJUSTED",
          resourceType: "inventory_transaction",
          resourceId: result.transaction.id,
          ip: context.ip,
          userAgent: context.userAgent,
          metadata: {
            type: body.type,
            inventoryItemId: body.inventoryItemId,
            branchId,
            qtyInUnit: body.qtyInUnit,
            reason: body.reason,
          },
        });
        return { ...result.transaction, quantity: result.quantity };
      } catch (error) {
        if (isUniqueViolation(error) && context.idempotencyKey) {
          const existing = await inventory.findByIdempotency(
            tenant.organizationId,
            context.idempotencyKey,
          );
          if (existing) {
            return existing;
          }
          throw new AppError("IDEMPOTENCY_CONFLICT", "Idempotency key conflict", 409);
        }
        throw error;
      }
    },

    async listAlerts(tenant: TenantContext, restaurantId: string) {
      await requireRestaurant(tenant, restaurantId);
      return inventory.listLowStock(tenant.organizationId, restaurantId);
    },

    async transfer(
      tenant: TenantContext,
      actorId: string,
      restaurantId: string,
      body: CreateTransferBody,
    ) {
      await requireRestaurant(tenant, restaurantId);
      if (body.fromBranchId === body.toBranchId) {
        throw new AppError("VALIDATION_ERROR", "Transfer requires two branches", 400);
      }
      const from = await requireBranch(tenant, body.fromBranchId);
      const to = await requireBranch(tenant, body.toBranchId);
      if (from.restaurantId !== restaurantId || to.restaurantId !== restaurantId) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      const result = await inventory.applyTransfer({
        organizationId: tenant.organizationId,
        inventoryItemId: body.inventoryItemId,
        fromBranchId: body.fromBranchId,
        toBranchId: body.toBranchId,
        qtyInUnit: body.qtyInUnit,
        unitId: body.unitId,
        actorId,
      });
      if (result.error) {
        movementError(result.error);
      }
      return {
        out: result.out.transaction,
        in: result.in.transaction,
      };
    },

    async listSuppliers(tenant: TenantContext, restaurantId: string) {
      await requireRestaurant(tenant, restaurantId);
      return inventory.listSuppliers(tenant.organizationId, restaurantId);
    },

    async createSupplier(tenant: TenantContext, restaurantId: string, body: CreateSupplierBody) {
      await requireRestaurant(tenant, restaurantId);
      return inventory.insertSupplier({
        organizationId: tenant.organizationId,
        restaurantId,
        ...body,
      });
    },

    async patchSupplier(tenant: TenantContext, id: string, body: PatchSupplierBody) {
      const row = await inventory.updateSupplier(tenant.organizationId, id, body);
      if (!row) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      return row;
    },

    async deleteSupplier(tenant: TenantContext, id: string) {
      const ok = await inventory.deleteSupplier(tenant.organizationId, id);
      if (!ok) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
    },

    async createPurchaseOrder(
      tenant: TenantContext,
      actorId: string,
      branchId: string,
      body: CreatePurchaseOrderBody,
    ) {
      const branch = await requireBranch(tenant, branchId);
      const supplier = await inventory.findSupplier(tenant.organizationId, body.supplierId);
      if (!supplier || supplier.restaurantId !== branch.restaurantId) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      const lines = [];
      for (const line of body.lines) {
        const item = await inventory.findItem(tenant.organizationId, line.inventoryItemId);
        if (!item || item.restaurantId !== branch.restaurantId) {
          throw new AppError("NOT_FOUND", "Not found", 404);
        }
        const qtyBase = await withOrganizationScope(db, tenant.organizationId, (tx) =>
          convertToBaseQty(
            tx,
            tenant.organizationId,
            line.unitId,
            item.baseUnitId,
            line.qtyInUnit,
          ),
        ).catch((error: unknown) => {
          if (error instanceof Error && error.message === "UNIT_CONVERSION_MISSING") {
            throw new AppError("VALIDATION_ERROR", "No integer conversion between units", 400);
          }
          if (error instanceof Error && error.message.includes("not an integer")) {
            throw new AppError("VALIDATION_ERROR", "Conversion is not an integer quantity", 400);
          }
          throw error;
        });
        lines.push({ ...line, qtyBase });
      }
      return inventory.insertPurchaseOrder({
        organizationId: tenant.organizationId,
        restaurantId: branch.restaurantId,
        branchId,
        supplierId: body.supplierId,
        notes: body.notes,
        createdBy: actorId,
        lines,
      });
    },

    async receivePurchaseOrder(tenant: TenantContext, actorId: string, id: string) {
      const po = await inventory.findPurchaseOrder(tenant.organizationId, id);
      if (!po) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      assertBranch(tenant, po.branchId);
      const result = await inventory.receivePurchaseOrder({
        organizationId: tenant.organizationId,
        id,
        actorId,
      });
      if (result.error === "PO_NOT_FOUND") {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      if (result.error === "PO_NOT_DRAFT") {
        throw new AppError("INVALID_STATE_TRANSITION", "Purchase order is not draft", 409);
      }
      if (result.error) {
        movementError(result.error);
      }
      return { id: result.id, status: result.status };
    },
  };
}
