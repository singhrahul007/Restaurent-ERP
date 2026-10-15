import { and, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import {
  branches,
  couponRedemptions,
  coupons,
  diningTables,
  menuAvailabilityOverrides,
  menuItemModifierGroups,
  menuItems,
  menuItemVariants,
  modifiers,
  orderDiscounts,
  orderItemModifiers,
  orderItems,
  orders,
  orderStatusHistory,
  outbox,
  restaurants,
  taxClasses,
  taxRates,
  withOrganizationScope,
  type Database,
} from "@niva/database";
import { insertKitchenTicketsForOrder } from "../kitchen/kitchen.repository.js";
import type { OrderStatus } from "./order-status.js";

const orderSelect = {
  id: orders.id,
  organizationId: orders.organizationId,
  restaurantId: orders.restaurantId,
  branchId: orders.branchId,
  tableId: orders.tableId,
  tokenNumber: orders.tokenNumber,
  type: orders.type,
  source: orders.source,
  sourceExternalId: orders.sourceExternalId,
  status: orders.status,
  idempotencyKey: orders.idempotencyKey,
  notes: orders.notes,
  couponId: orders.couponId,
  subtotalMinor: orders.subtotalMinor,
  discountTotalMinor: orders.discountTotalMinor,
  couponTotalMinor: orders.couponTotalMinor,
  taxTotalMinor: orders.taxTotalMinor,
  serviceChargeMinor: orders.serviceChargeMinor,
  roundingMinor: orders.roundingMinor,
  totalMinor: orders.totalMinor,
  createdAt: orders.createdAt,
  updatedAt: orders.updatedAt,
};

export type OrderTotals = {
  subtotalMinor: number;
  discountTotalMinor: number;
  couponTotalMinor: number;
  taxTotalMinor: number;
  serviceChargeMinor: number;
  roundingMinor: number;
  totalMinor: number;
};

export type NewOrderItemRow = {
  menuItemId: string | null;
  variantId: string | null;
  itemName: string;
  variantName: string | null;
  qty: number;
  unitPriceMinor: number;
  taxRateBps: number;
  taxInclusive: boolean;
  lineDiscountMinor: number;
  taxMinor: number;
  lineTotalMinor: number;
  modifiers: Array<{ modifierId: string | null; name: string; priceDeltaMinor: number }>;
};

type OrgTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

function persistMutation(
  db: Database,
  organizationId: string,
  orderId: string,
  totals: OrderTotals,
  lines: Array<{ id: string; taxMinor: number; lineTotalMinor: number }>,
  mutate: (tx: OrgTx) => Promise<void>,
) {
  return withOrganizationScope(db, organizationId, async (tx) => {
    await mutate(tx);
    await tx
      .update(orders)
      .set(totals)
      .where(and(eq(orders.id, orderId), eq(orders.organizationId, organizationId)));
    for (const line of lines) {
      await tx
        .update(orderItems)
        .set({ taxMinor: line.taxMinor, lineTotalMinor: line.lineTotalMinor })
        .where(
          and(eq(orderItems.id, line.id), eq(orderItems.organizationId, organizationId)),
        );
    }
  });
}

export function createOrderRepository(db: Database) {
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
            organizationId: branches.organizationId,
          })
          .from(branches)
          .where(and(eq(branches.id, branchId), eq(branches.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    findTable(organizationId: string, tableId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: diningTables.id,
            branchId: diningTables.branchId,
            status: diningTables.status,
            code: diningTables.code,
          })
          .from(diningTables)
          .where(
            and(eq(diningTables.id, tableId), eq(diningTables.organizationId, organizationId)),
          )
          .limit(1);
        return row ?? null;
      });
    },

    findOpenOrderForTable(organizationId: string, tableId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({ id: orders.id, status: orders.status })
          .from(orders)
          .where(
            and(
              eq(orders.organizationId, organizationId),
              eq(orders.tableId, tableId),
              notInArray(orders.status, ["COMPLETED", "CANCELLED"]),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    setTableStatus(
      organizationId: string,
      tableId: string,
      status: "AVAILABLE" | "OCCUPIED" | "RESERVED",
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        await tx
          .update(diningTables)
          .set({ status })
          .where(
            and(eq(diningTables.id, tableId), eq(diningTables.organizationId, organizationId)),
          );
      });
    },

    findByIdempotency(organizationId: string, idempotencyKey: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(orderSelect)
          .from(orders)
          .where(
            and(
              eq(orders.organizationId, organizationId),
              eq(orders.idempotencyKey, idempotencyKey),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    findOrder(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select(orderSelect)
          .from(orders)
          .where(and(eq(orders.id, id), eq(orders.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    listOrders(organizationId: string, branchId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select(orderSelect)
          .from(orders)
          .where(
            and(eq(orders.organizationId, organizationId), eq(orders.branchId, branchId)),
          )
          .orderBy(desc(orders.createdAt)),
      );
    },

    findMenuItem(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: menuItems.id,
            restaurantId: menuItems.restaurantId,
            name: menuItems.name,
            basePriceMinor: menuItems.basePriceMinor,
            available: menuItems.available,
            taxClassId: menuItems.taxClassId,
          })
          .from(menuItems)
          .where(and(eq(menuItems.id, id), eq(menuItems.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    async itemIsEightySixed(
      organizationId: string,
      menuItemId: string,
      branchId: string,
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const rows = await tx
          .select({
            branchId: menuAvailabilityOverrides.branchId,
            available: menuAvailabilityOverrides.available,
          })
          .from(menuAvailabilityOverrides)
          .where(
            and(
              eq(menuAvailabilityOverrides.organizationId, organizationId),
              eq(menuAvailabilityOverrides.menuItemId, menuItemId),
            ),
          );
        const branch = rows.find((row) => row.branchId === branchId);
        if (branch) {
          return !branch.available;
        }
        const restaurant = rows.find((row) => row.branchId === null);
        if (restaurant) {
          return !restaurant.available;
        }
        return false;
      });
    },

    findVariant(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: menuItemVariants.id,
            menuItemId: menuItemVariants.menuItemId,
            name: menuItemVariants.name,
            priceDeltaMinor: menuItemVariants.priceDeltaMinor,
          })
          .from(menuItemVariants)
          .where(
            and(
              eq(menuItemVariants.id, id),
              eq(menuItemVariants.organizationId, organizationId),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    findModifiers(organizationId: string, ids: string[]) {
      if (ids.length === 0) {
        return Promise.resolve([]);
      }
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            id: modifiers.id,
            name: modifiers.name,
            priceDeltaMinor: modifiers.priceDeltaMinor,
            modifierGroupId: modifiers.modifierGroupId,
          })
          .from(modifiers)
          .where(and(eq(modifiers.organizationId, organizationId), inArray(modifiers.id, ids))),
      );
    },

    listItemGroupIds(organizationId: string, menuItemId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const rows = await tx
          .select({ modifierGroupId: menuItemModifierGroups.modifierGroupId })
          .from(menuItemModifierGroups)
          .where(
            and(
              eq(menuItemModifierGroups.organizationId, organizationId),
              eq(menuItemModifierGroups.menuItemId, menuItemId),
            ),
          );
        return rows.map((row) => row.modifierGroupId);
      });
    },

    currentTaxRate(organizationId: string, taxClassId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [taxClass] = await tx
          .select({ inclusive: taxClasses.inclusive, restaurantId: taxClasses.restaurantId })
          .from(taxClasses)
          .where(
            and(eq(taxClasses.id, taxClassId), eq(taxClasses.organizationId, organizationId)),
          )
          .limit(1);
        const [rate] = await tx
          .select({ rateBps: taxRates.rateBps })
          .from(taxRates)
          .where(and(eq(taxRates.taxClassId, taxClassId), isNull(taxRates.effectiveTo)))
          .orderBy(desc(taxRates.effectiveFrom))
          .limit(1);
        return taxClass
          ? { inclusive: taxClass.inclusive, rateBps: rate?.rateBps ?? 0 }
          : null;
      });
    },

    async insertOrder(input: {
      organizationId: string;
      restaurantId: string;
      branchId: string;
      tableId: string | null;
      type: "DINE_IN" | "TAKEAWAY" | "DELIVERY" | "ONLINE";
      status: "DRAFT" | "CREATED";
      source?: string;
      sourceExternalId?: string | null;
      idempotencyKey: string | null;
      notes?: string;
      createdBy: string;
      tokenNumber?: number | null;
      totals: OrderTotals;
      items: NewOrderItemRow[];
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        let assignedToken = input.tokenNumber;
        if (!assignedToken) {
          const [maxToken] = await tx
            .select({ max: sql<number>`coalesce(max(${orders.tokenNumber}), 0)` })
            .from(orders)
            .where(
              and(
                eq(orders.organizationId, input.organizationId),
                eq(orders.branchId, input.branchId),
                sql`${orders.createdAt} >= date_trunc('day', now())`,
              ),
            );
          assignedToken = ((maxToken?.max ?? 0) % 999) + 1;
        }

        const [order] = await tx
          .insert(orders)
          .values({
            organizationId: input.organizationId,
            restaurantId: input.restaurantId,
            branchId: input.branchId,
            tableId: input.tableId,
            tokenNumber: assignedToken,
            type: input.type,
            source: input.source ?? "pos",
            sourceExternalId: input.sourceExternalId,
            status: input.status,
            idempotencyKey: input.idempotencyKey,
            notes: input.notes,
            createdBy: input.createdBy,
            ...input.totals,
          })
          .returning(orderSelect);
        if (!order) {
          throw new Error("ORDER_INSERT_FAILED");
        }
        await tx.insert(orderStatusHistory).values({
          organizationId: input.organizationId,
          orderId: order.id,
          fromStatus: null,
          toStatus: input.status,
          actorId: input.createdBy,
        });
        for (const [index, item] of input.items.entries()) {
          const [row] = await tx
            .insert(orderItems)
            .values({
              organizationId: input.organizationId,
              orderId: order.id,
              menuItemId: item.menuItemId,
              variantId: item.variantId,
              itemName: item.itemName,
              variantName: item.variantName,
              qty: item.qty,
              unitPriceMinor: item.unitPriceMinor,
              taxRateBps: item.taxRateBps,
              taxInclusive: item.taxInclusive,
              lineDiscountMinor: item.lineDiscountMinor,
              taxMinor: item.taxMinor,
              lineTotalMinor: item.lineTotalMinor,
              sortOrder: index,
            })
            .returning({ id: orderItems.id });
          if (!row) {
            throw new Error("ORDER_ITEM_INSERT_FAILED");
          }
          if (item.modifiers.length > 0) {
            await tx.insert(orderItemModifiers).values(
              item.modifiers.map((modifier) => ({
                organizationId: input.organizationId,
                orderItemId: row.id,
                modifierId: modifier.modifierId,
                name: modifier.name,
                priceDeltaMinor: modifier.priceDeltaMinor,
              })),
            );
          }
        }
        return order;
      });
    },

    listItems(organizationId: string, orderId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            id: orderItems.id,
            menuItemId: orderItems.menuItemId,
            variantId: orderItems.variantId,
            itemName: orderItems.itemName,
            variantName: orderItems.variantName,
            qty: orderItems.qty,
            unitPriceMinor: orderItems.unitPriceMinor,
            taxRateBps: orderItems.taxRateBps,
            taxInclusive: orderItems.taxInclusive,
            lineDiscountMinor: orderItems.lineDiscountMinor,
            taxMinor: orderItems.taxMinor,
            lineTotalMinor: orderItems.lineTotalMinor,
            sortOrder: orderItems.sortOrder,
          })
          .from(orderItems)
          .where(
            and(
              eq(orderItems.organizationId, organizationId),
              eq(orderItems.orderId, orderId),
            ),
          ),
      );
    },

    listItemModifiers(organizationId: string, orderItemIds: string[]) {
      if (orderItemIds.length === 0) {
        return Promise.resolve([]);
      }
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            id: orderItemModifiers.id,
            orderItemId: orderItemModifiers.orderItemId,
            modifierId: orderItemModifiers.modifierId,
            name: orderItemModifiers.name,
            priceDeltaMinor: orderItemModifiers.priceDeltaMinor,
          })
          .from(orderItemModifiers)
          .where(
            and(
              eq(orderItemModifiers.organizationId, organizationId),
              inArray(orderItemModifiers.orderItemId, orderItemIds),
            ),
          ),
      );
    },

    findOrderItem(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            qty: orderItems.qty,
          })
          .from(orderItems)
          .where(and(eq(orderItems.id, id), eq(orderItems.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    insertItemPriced(
      organizationId: string,
      orderId: string,
      item: NewOrderItemRow,
      sortOrder: number,
      totals: OrderTotals,
      existingLineUpdates: Array<{ id: string; taxMinor: number; lineTotalMinor: number }>,
    ) {
      return persistMutation(db, organizationId, orderId, totals, existingLineUpdates, async (tx) => {
        const [row] = await tx
          .insert(orderItems)
          .values({
            organizationId,
            orderId,
            menuItemId: item.menuItemId,
            variantId: item.variantId,
            itemName: item.itemName,
            variantName: item.variantName,
            qty: item.qty,
            unitPriceMinor: item.unitPriceMinor,
            taxRateBps: item.taxRateBps,
            taxInclusive: item.taxInclusive,
            lineDiscountMinor: item.lineDiscountMinor,
            taxMinor: item.taxMinor,
            lineTotalMinor: item.lineTotalMinor,
            sortOrder,
          })
          .returning({ id: orderItems.id });
        if (!row) {
          throw new Error("ORDER_ITEM_INSERT_FAILED");
        }
        if (item.modifiers.length > 0) {
          await tx.insert(orderItemModifiers).values(
            item.modifiers.map((modifier) => ({
              organizationId,
              orderItemId: row.id,
              modifierId: modifier.modifierId,
              name: modifier.name,
              priceDeltaMinor: modifier.priceDeltaMinor,
            })),
          );
        }
      });
    },

    updateItemQtyPriced(
      organizationId: string,
      orderId: string,
      itemId: string,
      qty: number,
      totals: OrderTotals,
      lineUpdates: Array<{ id: string; taxMinor: number; lineTotalMinor: number }>,
    ) {
      return persistMutation(db, organizationId, orderId, totals, lineUpdates, async (tx) => {
        await tx
          .update(orderItems)
          .set({ qty })
          .where(and(eq(orderItems.id, itemId), eq(orderItems.organizationId, organizationId)));
      });
    },

    deleteItemPriced(
      organizationId: string,
      orderId: string,
      itemId: string,
      totals: OrderTotals,
      lineUpdates: Array<{ id: string; taxMinor: number; lineTotalMinor: number }>,
    ) {
      return persistMutation(db, organizationId, orderId, totals, lineUpdates, async (tx) => {
        await tx
          .delete(orderItems)
          .where(and(eq(orderItems.id, itemId), eq(orderItems.organizationId, organizationId)));
      });
    },

    applyPricedLines(
      organizationId: string,
      orderId: string,
      totals: OrderTotals,
      lines: Array<{ id: string; taxMinor: number; lineTotalMinor: number }>,
    ) {
      return persistMutation(db, organizationId, orderId, totals, lines, async () => undefined);
    },

    listDiscounts(organizationId: string, orderId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            id: orderDiscounts.id,
            type: orderDiscounts.type,
            percentBps: orderDiscounts.percentBps,
            amountMinor: orderDiscounts.amountMinor,
            reason: orderDiscounts.reason,
          })
          .from(orderDiscounts)
          .where(
            and(
              eq(orderDiscounts.organizationId, organizationId),
              eq(orderDiscounts.orderId, orderId),
            ),
          ),
      );
    },

    insertDiscountPriced(
      input: {
        organizationId: string;
        orderId: string;
        type: "PERCENT" | "AMOUNT";
        percentBps?: number;
        amountMinor?: number;
        reason?: string;
      },
      totals: OrderTotals,
      lineUpdates: Array<{ id: string; taxMinor: number; lineTotalMinor: number }>,
    ) {
      return persistMutation(
        db,
        input.organizationId,
        input.orderId,
        totals,
        lineUpdates,
        async (tx) => {
          await tx.delete(orderDiscounts).where(eq(orderDiscounts.orderId, input.orderId));
          await tx.insert(orderDiscounts).values({
            organizationId: input.organizationId,
            orderId: input.orderId,
            type: input.type,
            percentBps: input.percentBps,
            amountMinor: input.amountMinor,
            reason: input.reason,
          });
        },
      );
    },

    findCouponById(organizationId: string, id: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: coupons.id,
            code: coupons.code,
            percentBps: coupons.percentBps,
            amountMinor: coupons.amountMinor,
            maxRedemptions: coupons.maxRedemptions,
            active: coupons.active,
            restaurantId: coupons.restaurantId,
          })
          .from(coupons)
          .where(and(eq(coupons.id, id), eq(coupons.organizationId, organizationId)))
          .limit(1);
        return row ?? null;
      });
    },

    findCouponByCode(organizationId: string, restaurantId: string, code: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({
            id: coupons.id,
            code: coupons.code,
            percentBps: coupons.percentBps,
            amountMinor: coupons.amountMinor,
            maxRedemptions: coupons.maxRedemptions,
            active: coupons.active,
            restaurantId: coupons.restaurantId,
          })
          .from(coupons)
          .where(
            and(
              eq(coupons.organizationId, organizationId),
              eq(coupons.restaurantId, restaurantId),
              eq(coupons.code, code),
            ),
          )
          .limit(1);
        return row ?? null;
      });
    },

    insertCoupon(input: {
      organizationId: string;
      restaurantId: string;
      code: string;
      percentBps?: number;
      amountMinor?: number;
      maxRedemptions?: number;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx.insert(coupons).values(input).returning({
          id: coupons.id,
          code: coupons.code,
          percentBps: coupons.percentBps,
          amountMinor: coupons.amountMinor,
          maxRedemptions: coupons.maxRedemptions,
          active: coupons.active,
        });
        if (!row) {
          throw new Error("COUPON_INSERT_FAILED");
        }
        return row;
      });
    },

    countRedemptions(organizationId: string, couponId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(couponRedemptions)
          .where(
            and(
              eq(couponRedemptions.organizationId, organizationId),
              eq(couponRedemptions.couponId, couponId),
            ),
          );
        return row?.count ?? 0;
      });
    },

    attachCouponPriced(
      organizationId: string,
      orderId: string,
      couponId: string,
      totals: OrderTotals,
      lineUpdates: Array<{ id: string; taxMinor: number; lineTotalMinor: number }>,
    ) {
      return persistMutation(db, organizationId, orderId, totals, lineUpdates, async (tx) => {
        await tx
          .update(orders)
          .set({ couponId })
          .where(and(eq(orders.id, orderId), eq(orders.organizationId, organizationId)));
        await tx.insert(couponRedemptions).values({
          organizationId,
          couponId,
          orderId,
        });
      });
    },

    async transitionChain(input: {
      organizationId: string;
      orderId: string;
      steps: Array<{ fromStatus: OrderStatus; toStatus: OrderStatus }>;
      actorId: string;
      outbox?: { topic: string; payload: string };
      createKitchenTickets?: boolean;
      extraWork?: (
        tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
      ) => Promise<void>;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        let last: Awaited<ReturnType<OrderRepository["findOrder"]>> = null;
        for (const step of input.steps) {
          const [row] = await tx
            .update(orders)
            .set({ status: step.toStatus })
            .where(
              and(eq(orders.id, input.orderId), eq(orders.organizationId, input.organizationId)),
            )
            .returning(orderSelect);
          last = row ?? null;
          await tx.insert(orderStatusHistory).values({
            organizationId: input.organizationId,
            orderId: input.orderId,
            fromStatus: step.fromStatus,
            toStatus: step.toStatus,
            actorId: input.actorId,
          });
        }
        if (input.createKitchenTickets) {
          await insertKitchenTicketsForOrder(tx, {
            organizationId: input.organizationId,
            orderId: input.orderId,
          });
        }
        if (input.outbox) {
          await tx.insert(outbox).values({
            organizationId: input.organizationId,
            topic: input.outbox.topic,
            payload: input.outbox.payload,
          });
        }
        if (input.extraWork) {
          await input.extraWork(tx);
        }
        return last;
      });
    },

    transition(input: {
      organizationId: string;
      orderId: string;
      fromStatus: OrderStatus;
      toStatus: OrderStatus;
      actorId: string;
      outbox?: { topic: string; payload: string };
    }) {
      return this.transitionChain({
        organizationId: input.organizationId,
        orderId: input.orderId,
        steps: [{ fromStatus: input.fromStatus, toStatus: input.toStatus }],
        actorId: input.actorId,
        outbox: input.outbox,
      });
    },

    listHistory(organizationId: string, orderId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            fromStatus: orderStatusHistory.fromStatus,
            toStatus: orderStatusHistory.toStatus,
            createdAt: orderStatusHistory.createdAt,
          })
          .from(orderStatusHistory)
          .where(
            and(
              eq(orderStatusHistory.organizationId, organizationId),
              eq(orderStatusHistory.orderId, orderId),
            ),
          ),
      );
    },
  };
}

export type OrderRepository = ReturnType<typeof createOrderRepository>;
