import { and, desc, eq, isNotNull, lte } from "drizzle-orm";
import {
  branches,
  inventoryBalances,
  inventoryItems,
  inventoryTransactions,
  outbox,
  purchaseOrderLines,
  purchaseOrders,
  restaurants,
  suppliers,
  unitConversions,
  units,
  wastageRecords,
  withOrganizationScope,
  type Database,
} from "@niva/database";
import { convertExact, invertRatio, reduceRatio } from "./units.js";

type OrgTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type MovementType =
  | "PURCHASE"
  | "WASTAGE"
  | "ADJUSTMENT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "SALE_CONSUMPTION"
  | "RETURN";

export type MovementError =
  | "ITEM_NOT_FOUND"
  | "UNIT_CONVERSION_MISSING"
  | "CONVERSION_NOT_INTEGER"
  | "INSUFFICIENT_STOCK";

export type MovementInput = {
  organizationId: string;
  inventoryItemId: string;
  branchId: string;
  type: MovementType;
  qtyInUnit: number;
  unitId: string;
  reason?: string;
  actorId: string;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string | null;
};

const itemSelect = {
  id: inventoryItems.id,
  organizationId: inventoryItems.organizationId,
  restaurantId: inventoryItems.restaurantId,
  sku: inventoryItems.sku,
  name: inventoryItems.name,
  baseUnitId: inventoryItems.baseUnitId,
  trackStock: inventoryItems.trackStock,
  lowStockThreshold: inventoryItems.lowStockThreshold,
  createdAt: inventoryItems.createdAt,
};

export async function convertToBaseQty(
  tx: OrgTx,
  organizationId: string,
  fromUnitId: string,
  baseUnitId: string,
  qtyInUnit: number,
): Promise<number> {
  if (fromUnitId === baseUnitId) {
    return qtyInUnit;
  }
  const [direct] = await tx
    .select({
      numerator: unitConversions.numerator,
      denominator: unitConversions.denominator,
    })
    .from(unitConversions)
    .where(
      and(
        eq(unitConversions.organizationId, organizationId),
        eq(unitConversions.fromUnitId, fromUnitId),
        eq(unitConversions.toUnitId, baseUnitId),
      ),
    )
    .limit(1);
  if (direct) {
    return convertExact(qtyInUnit, direct.numerator, direct.denominator);
  }
  const [inverse] = await tx
    .select({
      numerator: unitConversions.numerator,
      denominator: unitConversions.denominator,
    })
    .from(unitConversions)
    .where(
      and(
        eq(unitConversions.organizationId, organizationId),
        eq(unitConversions.fromUnitId, baseUnitId),
        eq(unitConversions.toUnitId, fromUnitId),
      ),
    )
    .limit(1);
  if (inverse) {
    const swapped = invertRatio(inverse.numerator, inverse.denominator);
    return convertExact(qtyInUnit, swapped.numerator, swapped.denominator);
  }
  throw new Error("UNIT_CONVERSION_MISSING");
}

export async function applyMovementInTx(tx: OrgTx, input: MovementInput) {
  const [item] = await tx
    .select(itemSelect)
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, input.inventoryItemId),
        eq(inventoryItems.organizationId, input.organizationId),
      ),
    )
    .limit(1);
  if (!item) {
    return { error: "ITEM_NOT_FOUND" as const satisfies MovementError };
  }
  let qtyBase: number;
  try {
    qtyBase = await convertToBaseQty(
      tx,
      input.organizationId,
      input.unitId,
      item.baseUnitId,
      Math.abs(input.qtyInUnit),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNIT_CONVERSION_MISSING") {
      return { error: "UNIT_CONVERSION_MISSING" as const satisfies MovementError };
    }
    if (error instanceof Error && error.message.includes("not an integer")) {
      return { error: "CONVERSION_NOT_INTEGER" as const satisfies MovementError };
    }
    throw error;
  }
  if (
    input.type === "WASTAGE" ||
    input.type === "TRANSFER_OUT" ||
    input.type === "SALE_CONSUMPTION"
  ) {
    qtyBase = -qtyBase;
  } else if (input.type === "ADJUSTMENT" && input.qtyInUnit < 0) {
    qtyBase = -qtyBase;
  }

  const [existing] = await tx
    .select({
      id: inventoryBalances.id,
      quantity: inventoryBalances.quantity,
    })
    .from(inventoryBalances)
    .where(
      and(
        eq(inventoryBalances.inventoryItemId, input.inventoryItemId),
        eq(inventoryBalances.branchId, input.branchId),
      ),
    )
    .for("update")
    .limit(1);
  const before = existing?.quantity ?? 0;
  const next = before + qtyBase;
  if (next < 0 && input.type !== "ADJUSTMENT") {
    return { error: "INSUFFICIENT_STOCK" as const satisfies MovementError };
  }

  const [txn] = await tx
    .insert(inventoryTransactions)
    .values({
      organizationId: input.organizationId,
      inventoryItemId: input.inventoryItemId,
      branchId: input.branchId,
      type: input.type,
      qtyBase,
      unitId: input.unitId,
      qtyInUnit: input.qtyInUnit,
      reason: input.reason,
      actorId: input.actorId,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      idempotencyKey: input.idempotencyKey,
    })
    .returning({
      id: inventoryTransactions.id,
      type: inventoryTransactions.type,
      qtyBase: inventoryTransactions.qtyBase,
      qtyInUnit: inventoryTransactions.qtyInUnit,
      createdAt: inventoryTransactions.createdAt,
    });
  if (!txn) {
    throw new Error("INVENTORY_TXN_INSERT_FAILED");
  }

  if (existing) {
    await tx
      .update(inventoryBalances)
      .set({ quantity: next })
      .where(eq(inventoryBalances.id, existing.id));
  } else {
    await tx.insert(inventoryBalances).values({
      organizationId: input.organizationId,
      inventoryItemId: input.inventoryItemId,
      branchId: input.branchId,
      quantity: next,
    });
  }

  if (input.type === "WASTAGE") {
    await tx.insert(wastageRecords).values({
      organizationId: input.organizationId,
      transactionId: txn.id,
      reason: input.reason ?? "Wastage",
    });
  }

  const threshold = item.lowStockThreshold;
  if (threshold != null && item.trackStock && before > threshold && next <= threshold) {
    await tx.insert(outbox).values({
      organizationId: input.organizationId,
      topic: "inventory.low_stock",
      payload: JSON.stringify({
        inventoryItemId: item.id,
        branchId: input.branchId,
        quantity: next,
        threshold,
      }),
    });
  }

  return {
    error: null,
    transaction: txn,
    quantity: next,
    item,
  };
}

export function createInventoryRepository(db: Database) {
  return {
    findRestaurant(organizationId: string, restaurantId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({ id: restaurants.id })
          .from(restaurants)
          .where(
            and(
              eq(restaurants.id, restaurantId),
              eq(restaurants.organizationId, organizationId),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    findBranch(organizationId: string, branchId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: branches.id,
            restaurantId: branches.restaurantId,
          })
          .from(branches)
          .where(and(eq(branches.id, branchId), eq(branches.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    listUnits(organizationId: string, restaurantId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            id: units.id,
            code: units.code,
            name: units.name,
            dimension: units.dimension,
          })
          .from(units)
          .where(
            and(eq(units.organizationId, organizationId), eq(units.restaurantId, restaurantId)),
          ),
      );
    },

    async ensureDefaultUnits(organizationId: string, restaurantId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const existing = await tx
          .select({ id: units.id })
          .from(units)
          .where(
            and(eq(units.organizationId, organizationId), eq(units.restaurantId, restaurantId)),
          )
          .limit(1);
        if (existing.length > 0) {
          return;
        }
        const defaults = [
          { code: "g", name: "Gram", dimension: "MASS" as const },
          { code: "kg", name: "Kilogram", dimension: "MASS" as const },
          { code: "ml", name: "Millilitre", dimension: "VOLUME" as const },
          { code: "l", name: "Litre", dimension: "VOLUME" as const },
          { code: "each", name: "Each", dimension: "COUNT" as const },
        ];
        const inserted = await tx
          .insert(units)
          .values(
            defaults.map((unit) => ({
              organizationId,
              restaurantId,
              ...unit,
            })),
          )
          .returning({ id: units.id, code: units.code });
        const byCode = new Map(inserted.map((row) => [row.code, row.id]));
        const pairs: Array<[string, string, number, number]> = [
          ["kg", "g", 1000, 1],
          ["l", "ml", 1000, 1],
        ];
        await tx.insert(unitConversions).values(
          pairs.map(([from, to, numerator, denominator]) => ({
            organizationId,
            fromUnitId: byCode.get(from)!,
            toUnitId: byCode.get(to)!,
            ...reduceRatio(numerator, denominator),
          })),
        );
      });
    },

    insertUnit(input: {
      organizationId: string;
      restaurantId: string;
      code: string;
      name: string;
      dimension: "MASS" | "VOLUME" | "COUNT";
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(units)
          .values(input)
          .returning({
            id: units.id,
            code: units.code,
            name: units.name,
            dimension: units.dimension,
          });
        if (!row) {
          throw new Error("UNIT_INSERT_FAILED");
        }
        return row;
      });
    },

    insertConversion(input: {
      organizationId: string;
      fromUnitId: string;
      toUnitId: string;
      numerator: number;
      denominator: number;
    }) {
      const ratio = reduceRatio(input.numerator, input.denominator);
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(unitConversions)
          .values({
            organizationId: input.organizationId,
            fromUnitId: input.fromUnitId,
            toUnitId: input.toUnitId,
            numerator: ratio.numerator,
            denominator: ratio.denominator,
          })
          .returning({
            id: unitConversions.id,
            fromUnitId: unitConversions.fromUnitId,
            toUnitId: unitConversions.toUnitId,
            numerator: unitConversions.numerator,
            denominator: unitConversions.denominator,
          });
        if (!row) {
          throw new Error("CONVERSION_INSERT_FAILED");
        }
        return row;
      });
    },

    findUnit(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: units.id,
            restaurantId: units.restaurantId,
            dimension: units.dimension,
          })
          .from(units)
          .where(and(eq(units.id, id), eq(units.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    insertItem(input: {
      organizationId: string;
      restaurantId: string;
      sku: string;
      name: string;
      baseUnitId: string;
      trackStock?: boolean;
      lowStockThreshold?: number | null;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(inventoryItems)
          .values({
            organizationId: input.organizationId,
            restaurantId: input.restaurantId,
            sku: input.sku,
            name: input.name,
            baseUnitId: input.baseUnitId,
            trackStock: input.trackStock,
            lowStockThreshold: input.lowStockThreshold,
          })
          .returning(itemSelect);
        if (!row) {
          throw new Error("INVENTORY_ITEM_INSERT_FAILED");
        }
        return row;
      });
    },

    updateItem(
      organizationId: string,
      id: string,
      patch: { name?: string; trackStock?: boolean; lowStockThreshold?: number | null },
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .update(inventoryItems)
          .set(patch)
          .where(and(eq(inventoryItems.id, id), eq(inventoryItems.organizationId, organizationId)))
          .returning(itemSelect);
        return row ?? null;
      });
    },

    findItem(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(itemSelect)
          .from(inventoryItems)
          .where(and(eq(inventoryItems.id, id), eq(inventoryItems.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    listItems(organizationId: string, restaurantId: string, branchId?: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const items = await tx
          .select(itemSelect)
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.organizationId, organizationId),
              eq(inventoryItems.restaurantId, restaurantId),
            ),
          );
        if (!branchId) {
          return items.map((item) => ({ ...item, quantity: null as number | null }));
        }
        const balances = await tx
          .select({
            inventoryItemId: inventoryBalances.inventoryItemId,
            quantity: inventoryBalances.quantity,
          })
          .from(inventoryBalances)
          .where(eq(inventoryBalances.branchId, branchId));
        const qty = new Map(balances.map((row) => [row.inventoryItemId, row.quantity]));
        return items.map((item) => ({ ...item, quantity: qty.get(item.id) ?? 0 }));
      });
    },

    findByIdempotency(organizationId: string, key: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: inventoryTransactions.id,
            type: inventoryTransactions.type,
            qtyBase: inventoryTransactions.qtyBase,
            qtyInUnit: inventoryTransactions.qtyInUnit,
            createdAt: inventoryTransactions.createdAt,
            inventoryItemId: inventoryTransactions.inventoryItemId,
            branchId: inventoryTransactions.branchId,
          })
          .from(inventoryTransactions)
          .where(
            and(
              eq(inventoryTransactions.organizationId, organizationId),
              eq(inventoryTransactions.idempotencyKey, key),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    applyMovement(input: MovementInput) {
      return withOrganizationScope(db, input.organizationId, (tx) => applyMovementInTx(tx, input));
    },

    applyTransfer(input: {
      organizationId: string;
      inventoryItemId: string;
      fromBranchId: string;
      toBranchId: string;
      qtyInUnit: number;
      unitId: string;
      actorId: string;
    }): Promise<
      | { error: MovementError }
      | {
          error: null;
          out: Awaited<ReturnType<typeof applyMovementInTx>> & { error: null };
          in: Awaited<ReturnType<typeof applyMovementInTx>> & { error: null };
        }
    > {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const outResult = await applyMovementInTx(tx, {
          organizationId: input.organizationId,
          inventoryItemId: input.inventoryItemId,
          branchId: input.fromBranchId,
          type: "TRANSFER_OUT",
          qtyInUnit: input.qtyInUnit,
          unitId: input.unitId,
          reason: "Branch transfer",
          actorId: input.actorId,
          referenceType: "transfer",
        });
        if (outResult.error) {
          return { error: outResult.error };
        }
        const inResult = await applyMovementInTx(tx, {
          organizationId: input.organizationId,
          inventoryItemId: input.inventoryItemId,
          branchId: input.toBranchId,
          type: "TRANSFER_IN",
          qtyInUnit: input.qtyInUnit,
          unitId: input.unitId,
          reason: "Branch transfer",
          actorId: input.actorId,
          referenceType: "transfer",
          referenceId: outResult.transaction.id,
        });
        if (inResult.error) {
          return { error: inResult.error };
        }
        return {
          error: null,
          out: outResult,
          in: inResult,
        };
      });
    },

    listTransactions(organizationId: string, branchId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            id: inventoryTransactions.id,
            inventoryItemId: inventoryTransactions.inventoryItemId,
            type: inventoryTransactions.type,
            qtyBase: inventoryTransactions.qtyBase,
            qtyInUnit: inventoryTransactions.qtyInUnit,
            unitId: inventoryTransactions.unitId,
            reason: inventoryTransactions.reason,
            createdAt: inventoryTransactions.createdAt,
          })
          .from(inventoryTransactions)
          .where(
            and(
              eq(inventoryTransactions.organizationId, organizationId),
              eq(inventoryTransactions.branchId, branchId),
            ),
          )
          .orderBy(desc(inventoryTransactions.createdAt)),
      );
    },

    listLowStock(organizationId: string, restaurantId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            inventoryItemId: inventoryItems.id,
            name: inventoryItems.name,
            sku: inventoryItems.sku,
            branchId: inventoryBalances.branchId,
            quantity: inventoryBalances.quantity,
            threshold: inventoryItems.lowStockThreshold,
          })
          .from(inventoryBalances)
          .innerJoin(inventoryItems, eq(inventoryItems.id, inventoryBalances.inventoryItemId))
          .where(
            and(
              eq(inventoryItems.organizationId, organizationId),
              eq(inventoryItems.restaurantId, restaurantId),
              isNotNull(inventoryItems.lowStockThreshold),
              lte(inventoryBalances.quantity, inventoryItems.lowStockThreshold),
            ),
          ),
      );
    },

    insertSupplier(input: {
      organizationId: string;
      restaurantId: string;
      name: string;
      phone?: string;
      email?: string;
      notes?: string;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(suppliers)
          .values(input)
          .returning({
            id: suppliers.id,
            name: suppliers.name,
            phone: suppliers.phone,
            email: suppliers.email,
            notes: suppliers.notes,
            restaurantId: suppliers.restaurantId,
          });
        if (!row) {
          throw new Error("SUPPLIER_INSERT_FAILED");
        }
        return row;
      });
    },

    listSuppliers(organizationId: string, restaurantId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            id: suppliers.id,
            name: suppliers.name,
            phone: suppliers.phone,
            email: suppliers.email,
            notes: suppliers.notes,
            restaurantId: suppliers.restaurantId,
          })
          .from(suppliers)
          .where(
            and(
              eq(suppliers.organizationId, organizationId),
              eq(suppliers.restaurantId, restaurantId),
            ),
          ),
      );
    },

    findSupplier(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: suppliers.id,
            restaurantId: suppliers.restaurantId,
            name: suppliers.name,
            phone: suppliers.phone,
            email: suppliers.email,
            notes: suppliers.notes,
          })
          .from(suppliers)
          .where(and(eq(suppliers.id, id), eq(suppliers.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    updateSupplier(
      organizationId: string,
      id: string,
      patch: { name?: string; phone?: string; email?: string; notes?: string },
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .update(suppliers)
          .set(patch)
          .where(and(eq(suppliers.id, id), eq(suppliers.organizationId, organizationId)))
          .returning({
            id: suppliers.id,
            name: suppliers.name,
            phone: suppliers.phone,
            email: suppliers.email,
            notes: suppliers.notes,
            restaurantId: suppliers.restaurantId,
          });
        return row ?? null;
      });
    },

    deleteSupplier(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const deleted = await tx
          .delete(suppliers)
          .where(and(eq(suppliers.id, id), eq(suppliers.organizationId, organizationId)))
          .returning({ id: suppliers.id });
        return deleted.length > 0;
      });
    },

    insertPurchaseOrder(input: {
      organizationId: string;
      restaurantId: string;
      branchId: string;
      supplierId: string;
      notes?: string;
      createdBy: string;
      lines: Array<{
        inventoryItemId: string;
        unitId: string;
        qtyInUnit: number;
        qtyBase: number;
      }>;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [po] = await tx
          .insert(purchaseOrders)
          .values({
            organizationId: input.organizationId,
            restaurantId: input.restaurantId,
            branchId: input.branchId,
            supplierId: input.supplierId,
            notes: input.notes,
            createdBy: input.createdBy,
            status: "DRAFT",
          })
          .returning({
            id: purchaseOrders.id,
            status: purchaseOrders.status,
            branchId: purchaseOrders.branchId,
            supplierId: purchaseOrders.supplierId,
          });
        if (!po) {
          throw new Error("PO_INSERT_FAILED");
        }
        await tx.insert(purchaseOrderLines).values(
          input.lines.map((line) => ({
            organizationId: input.organizationId,
            purchaseOrderId: po.id,
            ...line,
          })),
        );
        return po;
      });
    },

    findPurchaseOrder(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [po] = await tx
          .select({
            id: purchaseOrders.id,
            status: purchaseOrders.status,
            branchId: purchaseOrders.branchId,
            restaurantId: purchaseOrders.restaurantId,
            supplierId: purchaseOrders.supplierId,
          })
          .from(purchaseOrders)
          .where(
            and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, organizationId)),
          )
          .limit(1);
        if (!po) {
          return null;
        }
        const lines = await tx
          .select({
            id: purchaseOrderLines.id,
            inventoryItemId: purchaseOrderLines.inventoryItemId,
            unitId: purchaseOrderLines.unitId,
            qtyInUnit: purchaseOrderLines.qtyInUnit,
            qtyBase: purchaseOrderLines.qtyBase,
          })
          .from(purchaseOrderLines)
          .where(eq(purchaseOrderLines.purchaseOrderId, po.id));
        return { ...po, lines };
      });
    },

    receivePurchaseOrder(input: { organizationId: string; id: string; actorId: string }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [po] = await tx
          .select({
            id: purchaseOrders.id,
            status: purchaseOrders.status,
            branchId: purchaseOrders.branchId,
          })
          .from(purchaseOrders)
          .where(
            and(
              eq(purchaseOrders.id, input.id),
              eq(purchaseOrders.organizationId, input.organizationId),
            ),
          )
          .for("update")
          .limit(1);
        if (!po) {
          return { error: "PO_NOT_FOUND" as const };
        }
        if (po.status !== "DRAFT") {
          return { error: "PO_NOT_DRAFT" as const };
        }
        const lines = await tx
          .select({
            inventoryItemId: purchaseOrderLines.inventoryItemId,
            unitId: purchaseOrderLines.unitId,
            qtyInUnit: purchaseOrderLines.qtyInUnit,
          })
          .from(purchaseOrderLines)
          .where(eq(purchaseOrderLines.purchaseOrderId, po.id));
        const transactions = [];
        for (const line of lines) {
          const moved = await applyMovementInTx(tx, {
            organizationId: input.organizationId,
            inventoryItemId: line.inventoryItemId,
            branchId: po.branchId,
            type: "PURCHASE",
            qtyInUnit: line.qtyInUnit,
            unitId: line.unitId,
            reason: "Purchase order receive",
            actorId: input.actorId,
            referenceType: "purchase_order",
            referenceId: po.id,
          });
          if (moved.error) {
            return moved;
          }
          transactions.push(moved.transaction);
        }
        await tx
          .update(purchaseOrders)
          .set({ status: "RECEIVED" })
          .where(eq(purchaseOrders.id, po.id));
        return { error: null, id: po.id, status: "RECEIVED" as const, transactions };
      });
    },
  };
}

export type InventoryRepository = ReturnType<typeof createInventoryRepository>;
