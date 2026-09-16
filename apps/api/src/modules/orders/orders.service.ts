import { withOrganizationScope, writeAudit, type Database } from "@niva/database";
import { AppError, isUniqueViolation } from "../../lib/errors.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import {
  assertModifierSelection,
  freezeMenuLine,
} from "../menu/menu.snapshot.js";
import { emitKitchen } from "../../realtime/hub.js";
import { toPublicKitchenTicket } from "../kitchen/kitchen.public.js";
import type { KitchenRepository } from "../kitchen/kitchen.repository.js";
import { integerMulDiv, priceOrder } from "../pricing/pricing.service.js";
import type { PaymentRepository } from "../payments/payments.repository.js";
import {
  assertOrderTransition,
  canMutateItems,
  isOpenOrderStatus,
  type OrderStatus,
} from "./order-status.js";
import type { NewOrderItemRow, OrderRepository, OrderTotals } from "./orders.repository.js";
import { consumeOrderInTx, reverseOrderInTx } from "../recipes/recipes.repository.js";
import { assertRecipeMovement } from "../recipes/recipes.service.js";

function assertBranch(tenant: TenantContext, branchId: string) {
  if (tenant.allowedBranchIds && !tenant.allowedBranchIds.includes(branchId)) {
    throw new AppError("NOT_FOUND", "Not found", 404);
  }
}

export function createOrderService(
  orders: OrderRepository,
  payments: PaymentRepository,
  db: Database,
  kitchen: KitchenRepository,
) {
  async function resolveCatalogLine(
    tenant: TenantContext,
    restaurantId: string,
    branchId: string,
    input: {
      menuItemId: string;
      variantId?: string | null;
      modifierIds: string[];
      qty: number;
    },
  ): Promise<NewOrderItemRow> {
    const item = await orders.findMenuItem(tenant.organizationId, input.menuItemId);
    if (!item || item.restaurantId !== restaurantId) {
      throw new AppError("NOT_FOUND", "Menu item not found", 404);
    }
    if (!item.available || (await orders.itemIsEightySixed(tenant.organizationId, item.id, branchId))) {
      throw new AppError("CONFLICT", "Item is not available", 409);
    }
    const variant = input.variantId
      ? await orders.findVariant(tenant.organizationId, input.variantId)
      : null;
    if (input.variantId && (!variant || variant.menuItemId !== item.id)) {
      throw new AppError("NOT_FOUND", "Variant not found", 404);
    }
    const selected = await orders.findModifiers(tenant.organizationId, input.modifierIds);
    if (selected.length !== input.modifierIds.length) {
      throw new AppError("NOT_FOUND", "Modifier not found", 404);
    }
    const groupIds = await orders.listItemGroupIds(tenant.organizationId, item.id);
    const byGroup = new Map<string, string[]>();
    for (const modifier of selected) {
      const list = byGroup.get(modifier.modifierGroupId) ?? [];
      list.push(modifier.id);
      byGroup.set(modifier.modifierGroupId, list);
      if (!groupIds.includes(modifier.modifierGroupId)) {
        throw new AppError("VALIDATION_ERROR", "Modifier is not attached to this item", 400);
      }
    }
    try {
      assertModifierSelection(
        [...byGroup.entries()].map(([id, modifierIds]) => ({
          id,
          minSelect: 0,
          maxSelect: modifierIds.length + 99,
          modifierIds,
        })),
        input.modifierIds,
      );
    } catch {
      throw new AppError("VALIDATION_ERROR", "Invalid modifier selection", 400);
    }
    const tax = await orders.currentTaxRate(tenant.organizationId, item.taxClassId);
    const frozen = freezeMenuLine({
      item: { id: item.id, name: item.name, basePriceMinor: item.basePriceMinor },
      variant,
      modifiers: selected,
    });
    return {
      menuItemId: item.id,
      variantId: frozen.variantId,
      itemName: frozen.itemName,
      variantName: frozen.variantName,
      qty: input.qty,
      unitPriceMinor: frozen.unitPriceMinor,
      taxRateBps: tax?.rateBps ?? 0,
      taxInclusive: tax?.inclusive ?? false,
      lineDiscountMinor: 0,
      taxMinor: 0,
      lineTotalMinor: 0,
      modifiers: frozen.modifiers.map((modifier) => ({
        modifierId: modifier.modifierId,
        name: modifier.name,
        priceDeltaMinor: modifier.priceDeltaMinor,
      })),
    };
  }

  async function priceLines(
    tenant: TenantContext,
    orderId: string,
    items: Array<{
      id?: string;
      qty: number;
      unitPriceMinor: number;
      taxRateBps: number;
      taxInclusive: boolean;
      lineDiscountMinor: number;
    }>,
    overrides?: {
      orderDiscount?:
        | { type: "PERCENT"; percentBps: number }
        | { type: "AMOUNT"; amountMinor: number };
      couponId?: string | null;
    },
  ) {
    const order = await orders.findOrder(tenant.organizationId, orderId);
    if (!order) {
      throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
    }
    const discounts = await orders.listDiscounts(tenant.organizationId, orderId);
    const discount = discounts[0];
    const orderDiscount =
      overrides?.orderDiscount ??
      (discount
        ? discount.type === "PERCENT"
          ? { type: "PERCENT" as const, percentBps: discount.percentBps ?? 0 }
          : { type: "AMOUNT" as const, amountMinor: discount.amountMinor ?? 0 }
        : undefined);
    const lines = items.map((item) => ({
      qty: item.qty,
      unitPriceMinor: item.unitPriceMinor,
      taxRateBps: item.taxRateBps,
      taxInclusive: item.taxInclusive,
      lineDiscountMinor: item.lineDiscountMinor,
    }));
    const base = priceOrder({ lines, orderDiscount, roundingUnitMinor: 100 });
    const couponId = overrides?.couponId !== undefined ? overrides.couponId : order.couponId;
    let couponAmountMinor = 0;
    if (couponId) {
      const couponRow = await orders.findCouponById(tenant.organizationId, couponId);
      if (couponRow) {
        const afterDiscount = base.subtotalMinor - base.discountTotalMinor;
        couponAmountMinor =
          couponRow.percentBps != null
            ? integerMulDiv(afterDiscount, couponRow.percentBps, 10_000)
            : Math.min(afterDiscount, couponRow.amountMinor ?? 0);
      }
    }
    const priced = priceOrder({
      lines,
      orderDiscount,
      couponAmountMinor,
      roundingUnitMinor: 100,
    });
    return {
      totals: {
        subtotalMinor: priced.subtotalMinor,
        discountTotalMinor: priced.discountTotalMinor,
        couponTotalMinor: priced.couponTotalMinor,
        taxTotalMinor: priced.taxTotalMinor,
        serviceChargeMinor: priced.serviceChargeMinor,
        roundingMinor: priced.roundingMinor,
        totalMinor: priced.totalMinor,
      },
      lines: priced.lines,
      lineUpdates: items
        .map((item, index) =>
          item.id
            ? {
                id: item.id,
                taxMinor: priced.lines[index]?.taxMinor ?? 0,
                lineTotalMinor: priced.lines[index]?.lineTotalMinor ?? 0,
              }
            : null,
        )
        .filter((row): row is { id: string; taxMinor: number; lineTotalMinor: number } =>
          Boolean(row),
        ),
    };
  }

  async function assemble(tenant: TenantContext, orderId: string) {
    const order = await orders.findOrder(tenant.organizationId, orderId);
    if (!order) {
      throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
    }
    assertBranch(tenant, order.branchId);
    const items = await orders.listItems(tenant.organizationId, orderId);
    const modifiers = await orders.listItemModifiers(
      tenant.organizationId,
      items.map((item) => item.id),
    );
    const discounts = await orders.listDiscounts(tenant.organizationId, orderId);
    const history = await orders.listHistory(tenant.organizationId, orderId);
    const paymentRows = await payments.listByOrder(tenant.organizationId, orderId);
    const sums = await payments.sumsForOrder(tenant.organizationId, orderId);
    return {
      ...order,
      items: items.map((item) => ({
        ...item,
        modifiers: modifiers.filter((row) => row.orderItemId === item.id),
      })),
      discounts,
      history,
      payments: paymentRows,
      balanceMinor: order.totalMinor - sums.netPaidMinor,
    };
  }

  return {
    assemble,

    async create(
      tenant: TenantContext,
      actorId: string,
      branchId: string,
      input: {
        type: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
        status?: "DRAFT" | "CREATED";
        tableId?: string | null;
        notes?: string;
        items: Array<{
          menuItemId: string;
          variantId?: string | null;
          modifierIds: string[];
          qty: number;
        }>;
      },
      idempotencyKey: string | null,
    ) {
      assertBranch(tenant, branchId);
      const branch = await orders.findBranch(tenant.organizationId, branchId);
      if (!branch) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      if (idempotencyKey) {
        const existing = await orders.findByIdempotency(
          tenant.organizationId,
          idempotencyKey,
        );
        if (existing) {
          return assemble(tenant, existing.id);
        }
      }
      if (input.type === "DINE_IN") {
        if (!input.tableId) {
          throw new AppError("VALIDATION_ERROR", "Dine-in orders require a table", 400);
        }
        const table = await orders.findTable(tenant.organizationId, input.tableId);
        if (!table || table.branchId !== branchId) {
          throw new AppError("NOT_FOUND", "Not found", 404);
        }
        const open = await orders.findOpenOrderForTable(
          tenant.organizationId,
          input.tableId,
        );
        if (open) {
          throw new AppError("CONFLICT", "Table is occupied", 409);
        }
      } else if (input.tableId) {
        throw new AppError("VALIDATION_ERROR", "Only dine-in orders can attach a table", 400);
      }

      const status = input.status ?? "CREATED";
      const catalogItems: NewOrderItemRow[] = [];
      for (const line of input.items) {
        catalogItems.push(
          await resolveCatalogLine(tenant, branch.restaurantId, branchId, line),
        );
      }
      const priced = priceOrder({
        lines: catalogItems.map((item) => ({
          qty: item.qty,
          unitPriceMinor: item.unitPriceMinor,
          taxRateBps: item.taxRateBps,
          taxInclusive: item.taxInclusive,
        })),
        roundingUnitMinor: 100,
      });
      const totals: OrderTotals = {
        subtotalMinor: priced.subtotalMinor,
        discountTotalMinor: priced.discountTotalMinor,
        couponTotalMinor: priced.couponTotalMinor,
        taxTotalMinor: priced.taxTotalMinor,
        serviceChargeMinor: priced.serviceChargeMinor,
        roundingMinor: priced.roundingMinor,
        totalMinor: priced.totalMinor,
      };
      const items = catalogItems.map((item, index) => ({
        ...item,
        taxMinor: priced.lines[index]?.taxMinor ?? 0,
        lineTotalMinor: priced.lines[index]?.lineTotalMinor ?? 0,
      }));
      try {
        const created = await orders.insertOrder({
          organizationId: tenant.organizationId,
          restaurantId: branch.restaurantId,
          branchId,
          tableId: input.tableId ?? null,
          type: input.type,
          status,
          idempotencyKey,
          notes: input.notes,
          createdBy: actorId,
          totals,
          items,
        });
        if (input.tableId && isOpenOrderStatus(status)) {
          await orders.setTableStatus(tenant.organizationId, input.tableId, "OCCUPIED");
        }
        return assemble(tenant, created.id);
      } catch (error) {
        if (isUniqueViolation(error) && idempotencyKey) {
          const existing = await orders.findByIdempotency(
            tenant.organizationId,
            idempotencyKey,
          );
          if (existing) {
            return assemble(tenant, existing.id);
          }
          throw new AppError("IDEMPOTENCY_CONFLICT", "Idempotency key conflict", 409);
        }
        throw error;
      }
    },

    list(tenant: TenantContext, branchId: string) {
      assertBranch(tenant, branchId);
      return orders.listOrders(tenant.organizationId, branchId);
    },

    get(tenant: TenantContext, id: string) {
      return assemble(tenant, id);
    },

    async addItem(
      tenant: TenantContext,
      orderId: string,
      input: {
        menuItemId: string;
        variantId?: string | null;
        modifierIds: string[];
        qty: number;
      },
    ) {
      const order = await orders.findOrder(tenant.organizationId, orderId);
      if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
      }
      assertBranch(tenant, order.branchId);
      if (!canMutateItems(order.status)) {
        throw new AppError("INVALID_STATE_TRANSITION", "Order items are locked", 409);
      }
      const existing = await orders.listItems(tenant.organizationId, orderId);
      const row = await resolveCatalogLine(
        tenant,
        order.restaurantId,
        order.branchId,
        input,
      );
      const priced = await priceLines(tenant, orderId, [
        ...existing,
        { ...row, id: undefined },
      ]);
      row.taxMinor = priced.lines[existing.length]?.taxMinor ?? 0;
      row.lineTotalMinor = priced.lines[existing.length]?.lineTotalMinor ?? 0;
      await orders.insertItemPriced(
        tenant.organizationId,
        orderId,
        row,
        existing.length,
        priced.totals,
        priced.lineUpdates,
      );
      return assemble(tenant, orderId);
    },

    async updateItemQty(tenant: TenantContext, itemId: string, qty: number) {
      const item = await orders.findOrderItem(tenant.organizationId, itemId);
      if (!item) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      const order = await orders.findOrder(tenant.organizationId, item.orderId);
      if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
      }
      assertBranch(tenant, order.branchId);
      if (!canMutateItems(order.status)) {
        throw new AppError("INVALID_STATE_TRANSITION", "Order items are locked", 409);
      }
      const items = await orders.listItems(tenant.organizationId, order.id);
      const next = items.map((row) => (row.id === itemId ? { ...row, qty } : row));
      const priced = await priceLines(tenant, order.id, next);
      await orders.updateItemQtyPriced(
        tenant.organizationId,
        order.id,
        itemId,
        qty,
        priced.totals,
        priced.lineUpdates,
      );
      return assemble(tenant, order.id);
    },

    async removeItem(tenant: TenantContext, itemId: string) {
      const item = await orders.findOrderItem(tenant.organizationId, itemId);
      if (!item) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      const order = await orders.findOrder(tenant.organizationId, item.orderId);
      if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
      }
      assertBranch(tenant, order.branchId);
      if (!canMutateItems(order.status)) {
        throw new AppError("INVALID_STATE_TRANSITION", "Order items are locked", 409);
      }
      const items = await orders.listItems(tenant.organizationId, order.id);
      const next = items.filter((row) => row.id !== itemId);
      const priced = await priceLines(tenant, order.id, next);
      await orders.deleteItemPriced(
        tenant.organizationId,
        order.id,
        itemId,
        priced.totals,
        priced.lineUpdates,
      );
      return assemble(tenant, order.id);
    },

    async applyDiscount(
      tenant: TenantContext,
      orderId: string,
      input:
        | { type: "PERCENT"; percentBps: number; reason?: string }
        | { type: "AMOUNT"; amountMinor: number; reason?: string },
    ) {
      const order = await orders.findOrder(tenant.organizationId, orderId);
      if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
      }
      assertBranch(tenant, order.branchId);
      if (!canMutateItems(order.status)) {
        throw new AppError("INVALID_STATE_TRANSITION", "Order is locked", 409);
      }
      const items = await orders.listItems(tenant.organizationId, orderId);
      const orderDiscount =
        input.type === "PERCENT"
          ? { type: "PERCENT" as const, percentBps: input.percentBps }
          : { type: "AMOUNT" as const, amountMinor: input.amountMinor };
      const priced = await priceLines(tenant, orderId, items, { orderDiscount });
      await orders.insertDiscountPriced(
        {
          organizationId: tenant.organizationId,
          orderId,
          type: input.type,
          percentBps: input.type === "PERCENT" ? input.percentBps : undefined,
          amountMinor: input.type === "AMOUNT" ? input.amountMinor : undefined,
          reason: input.reason,
        },
        priced.totals,
        priced.lineUpdates,
      );
      return assemble(tenant, orderId);
    },

    async createCoupon(
      tenant: TenantContext,
      restaurantId: string,
      input: {
        code: string;
        percentBps?: number;
        amountMinor?: number;
        maxRedemptions?: number;
      },
    ) {
      const restaurant = await orders.findRestaurant(tenant.organizationId, restaurantId);
      if (!restaurant) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      try {
        return await orders.insertCoupon({
          organizationId: tenant.organizationId,
          restaurantId,
          code: input.code.trim().toUpperCase(),
          percentBps: input.percentBps,
          amountMinor: input.amountMinor,
          maxRedemptions: input.maxRedemptions,
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError("CONFLICT", "Coupon code already exists", 409);
        }
        throw error;
      }
    },

    async applyCoupon(tenant: TenantContext, orderId: string, code: string) {
      const order = await orders.findOrder(tenant.organizationId, orderId);
      if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
      }
      assertBranch(tenant, order.branchId);
      if (!canMutateItems(order.status)) {
        throw new AppError("INVALID_STATE_TRANSITION", "Order is locked", 409);
      }
      if (order.couponId) {
        throw new AppError("CONFLICT", "Order already has a coupon", 409);
      }
      const coupon = await orders.findCouponByCode(
        tenant.organizationId,
        order.restaurantId,
        code.trim().toUpperCase(),
      );
      if (!coupon || !coupon.active) {
        throw new AppError("NOT_FOUND", "Coupon not found", 404);
      }
      const used = await orders.countRedemptions(tenant.organizationId, coupon.id);
      if (coupon.maxRedemptions != null && used >= coupon.maxRedemptions) {
        throw new AppError("CONFLICT", "Coupon has no remaining redemptions", 409);
      }
      const items = await orders.listItems(tenant.organizationId, orderId);
      const priced = await priceLines(tenant, orderId, items, { couponId: coupon.id });
      try {
        await orders.attachCouponPriced(
          tenant.organizationId,
          orderId,
          coupon.id,
          priced.totals,
          priced.lineUpdates,
        );
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError("CONFLICT", "Coupon already applied", 409);
        }
        throw error;
      }
      return assemble(tenant, orderId);
    },

    async confirm(tenant: TenantContext, actorId: string, orderId: string) {
      const order = await orders.findOrder(tenant.organizationId, orderId);
      if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
      }
      assertBranch(tenant, order.branchId);
      assertOrderTransition(order.status, "CONFIRMED");
      assertOrderTransition("CONFIRMED", "PREPARING");
      const payload = JSON.stringify({
        orderId: order.id,
        status: "PREPARING",
        branchId: order.branchId,
      });
      await orders.transitionChain({
        organizationId: tenant.organizationId,
        orderId,
        actorId,
        steps: [
          { fromStatus: order.status, toStatus: "CONFIRMED" },
          { fromStatus: "CONFIRMED", toStatus: "PREPARING" },
        ],
        outbox: { topic: "order.updated", payload },
        createKitchenTickets: true,
      });
      const ticket = await kitchen.findByOrder(tenant.organizationId, orderId);
      if (ticket) {
        const items = await kitchen.listItems(tenant.organizationId, [ticket.id]);
        emitKitchen(
          ticket.branchId,
          "kitchen.ticket.created",
          toPublicKitchenTicket(ticket, items),
        );
      }
      return assemble(tenant, orderId);
    },

    async transitionTo(
      tenant: TenantContext,
      actorId: string,
      orderId: string,
      toStatus: OrderStatus,
    ) {
      const order = await orders.findOrder(tenant.organizationId, orderId);
      if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
      }
      assertBranch(tenant, order.branchId);
      if (toStatus === "SERVED" && order.type !== "DINE_IN") {
        throw new AppError("INVALID_STATE_TRANSITION", "SERVED is dine-in only", 409);
      }
      if (toStatus === "HANDED_OVER" && order.type === "DINE_IN") {
        throw new AppError("INVALID_STATE_TRANSITION", "HANDED_OVER is not dine-in", 409);
      }
      assertOrderTransition(order.status, toStatus);
      await orders.transition({
        organizationId: tenant.organizationId,
        orderId,
        fromStatus: order.status,
        toStatus,
        actorId,
        outbox: {
          topic: "order.updated",
          payload: JSON.stringify({ orderId, status: toStatus, branchId: order.branchId }),
        },
      });
      return assemble(tenant, orderId);
    },

    async complete(tenant: TenantContext, actorId: string, orderId: string) {
      const order = await orders.findOrder(tenant.organizationId, orderId);
      if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
      }
      assertBranch(tenant, order.branchId);
      const sums = await payments.sumsForOrder(tenant.organizationId, orderId);
      if (order.totalMinor - sums.netPaidMinor > 0) {
        throw new AppError("CONFLICT", "Cannot complete an order with a remaining balance", 409);
      }
      const steps: Array<{ fromStatus: OrderStatus; toStatus: OrderStatus }> = [];
      let status = order.status;
      if (status === "PREPARING") {
        assertOrderTransition(status, "READY");
        steps.push({ fromStatus: status, toStatus: "READY" });
        status = "READY";
      }
      if (status === "READY") {
        const next = order.type === "DINE_IN" ? "SERVED" : "HANDED_OVER";
        assertOrderTransition(status, next);
        steps.push({ fromStatus: status, toStatus: next });
        status = next;
      }
      assertOrderTransition(status, "COMPLETED");
      steps.push({ fromStatus: status, toStatus: "COMPLETED" });
      await orders.transitionChain({
        organizationId: tenant.organizationId,
        orderId,
        actorId,
        steps,
        outbox: {
          topic: "order.updated",
          payload: JSON.stringify({
            orderId,
            status: "COMPLETED",
            branchId: order.branchId,
          }),
        },
        extraWork: async (tx) => {
          const consumed = await consumeOrderInTx(tx, {
            organizationId: tenant.organizationId,
            restaurantId: order.restaurantId,
            branchId: order.branchId,
            orderId,
            actorId,
          });
          assertRecipeMovement(consumed.error);
        },
      });
      if (order.tableId) {
        const stillOpen = await orders.findOpenOrderForTable(
          tenant.organizationId,
          order.tableId,
        );
        if (!stillOpen) {
          await orders.setTableStatus(tenant.organizationId, order.tableId, "AVAILABLE");
        }
      }
      return assemble(tenant, orderId);
    },

    async cancel(
      tenant: TenantContext,
      actorId: string,
      orderId: string,
      context: { ip?: string | null; userAgent?: string | null },
    ) {
      const order = await orders.findOrder(tenant.organizationId, orderId);
      if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
      }
      assertBranch(tenant, order.branchId);
      if (order.status === "COMPLETED") {
        throw new AppError(
          "INVALID_STATE_TRANSITION",
          "Completed orders cannot be cancelled without a refunds policy",
          409,
        );
      }
      assertOrderTransition(order.status, "CANCELLED");
      const sums = await payments.sumsForOrder(tenant.organizationId, orderId);
      if (sums.netPaidMinor > 0) {
        throw new AppError(
          "CONFLICT",
          "Refund captured payments before cancelling",
          409,
        );
      }
      await orders.transition({
        organizationId: tenant.organizationId,
        orderId,
        fromStatus: order.status,
        toStatus: "CANCELLED",
        actorId,
        outbox: {
          topic: "order.updated",
          payload: JSON.stringify({
            orderId,
            status: "CANCELLED",
            branchId: order.branchId,
          }),
        },
      });
      await writeAudit(db, {
        actorId,
        organizationId: tenant.organizationId,
        action: "ORDER_CANCELLED",
        resourceType: "order",
        resourceId: orderId,
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { fromStatus: order.status },
      });
      if (order.tableId) {
        const stillOpen = await orders.findOpenOrderForTable(
          tenant.organizationId,
          order.tableId,
        );
        if (!stillOpen) {
          await orders.setTableStatus(tenant.organizationId, order.tableId, "AVAILABLE");
        }
      }
      return assemble(tenant, orderId);
    },

    async createPayment(
      tenant: TenantContext,
      actorId: string,
      orderId: string,
      input: { amountMinor: number; method: "CASH" },
    ) {
      const before = await assemble(tenant, orderId);
      const payment = await payments.insertPayment({
        organizationId: tenant.organizationId,
        orderId,
        amountMinor: input.amountMinor,
        method: input.method,
        createdBy: actorId,
      });
      const after = await assemble(tenant, orderId);
      if (after.status !== before.status) {
        throw new AppError("CONFLICT", "Payment must not change order status", 409);
      }
      return { payment, order: after };
    },

    async refund(
      tenant: TenantContext,
      actorId: string,
      paymentId: string,
      input: { amountMinor: number; reason?: string },
      context: { ip?: string | null; userAgent?: string | null },
    ) {
      const payment = await payments.findPayment(tenant.organizationId, paymentId);
      if (!payment) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      const order = await orders.findOrder(tenant.organizationId, payment.orderId);
      if (!order) {
        throw new AppError("ORDER_NOT_FOUND", "Order not found", 404);
      }
      assertBranch(tenant, order.branchId);
      const existing = await payments.listRefunds(tenant.organizationId, paymentId);
      const already = existing.reduce((sum, row) => sum + row.amountMinor, 0);
      const remaining = payment.amountMinor - already;
      if (input.amountMinor > remaining) {
        throw new AppError("VALIDATION_ERROR", "Refund exceeds captured amount", 400);
      }
      const nextStatus =
        input.amountMinor === remaining ? "REFUNDED" : "PARTIALLY_REFUNDED";
      const refund = await payments.insertRefund({
        organizationId: tenant.organizationId,
        paymentId,
        amountMinor: input.amountMinor,
        reason: input.reason,
        createdBy: actorId,
        nextStatus,
      });
      const after = await payments.sumsForOrder(tenant.organizationId, order.id);
      if (order.status === "COMPLETED" && after.netPaidMinor === 0) {
        const reversed = await withOrganizationScope(db, tenant.organizationId, (tx) =>
          reverseOrderInTx(tx, {
            organizationId: tenant.organizationId,
            orderId: order.id,
            actorId,
          }),
        );
        assertRecipeMovement(reversed.error);
      }
      await writeAudit(db, {
        actorId,
        organizationId: tenant.organizationId,
        action: "PAYMENT_REFUNDED",
        resourceType: "payment",
        resourceId: paymentId,
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { amountMinor: input.amountMinor, orderId: order.id },
      });
      return refund;
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
