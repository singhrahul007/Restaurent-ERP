import { and, desc, eq, gte, inArray, lt, notInArray, sql } from "drizzle-orm";
import {
  expenses,
  inventoryBalances,
  inventoryItems,
  kitchenTickets,
  menuCategories,
  menuItems,
  orderItems,
  orders,
  payments,
  refunds,
  restaurants,
  withOrganizationScope,
  type Database,
} from "@niva/database";

function asInt(value: unknown): number {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string" && value.length > 0) {
    return Number(value);
  }
  return 0;
}

export type ReportScope = {
  organizationId: string;
  restaurantId: string;
  branchId?: string;
};

export type DateRange = { from: Date; to: Date };

export function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function periodWindows(now = new Date()) {
  const todayStart = utcDayStart(now);
  const tomorrow = new Date(todayStart);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const mondayOffset = (todayStart.getUTCDay() + 6) % 7;
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(weekStart.getUTCDate() - mondayOffset);
  const monthStart = new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth(), 1));
  const trendStart = new Date(todayStart);
  trendStart.setUTCDate(trendStart.getUTCDate() - 6);
  return { now, todayStart, tomorrow, weekStart, monthStart, trendStart };
}

export function snapshot(orderCount: number, revenueMinor: number) {
  return {
    orderCount,
    revenueMinor,
    aovMinor: orderCount === 0 ? 0 : Math.trunc(revenueMinor / orderCount),
  };
}

function completedOrderFilters(scope: ReportScope, range?: DateRange) {
  const filters = [
    eq(orders.organizationId, scope.organizationId),
    eq(orders.restaurantId, scope.restaurantId),
    eq(orders.status, "COMPLETED"),
  ];
  if (scope.branchId) {
    filters.push(eq(orders.branchId, scope.branchId));
  }
  if (range) {
    filters.push(gte(orders.createdAt, range.from));
    filters.push(lt(orders.createdAt, range.to));
  }
  return and(...filters);
}

export function createReportsRepository(db: Database) {
  return {
    findRestaurant(organizationId: string, restaurantId: string) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const [row] = await tx
          .select({ id: restaurants.id })
          .from(restaurants)
          .where(
            and(eq(restaurants.id, restaurantId), eq(restaurants.organizationId, organizationId)),
          )
          .limit(1);
        return row ?? null;
      });
    },

    salesTotals(scope: ReportScope, range: DateRange) {
      return withOrganizationScope(db, scope.organizationId, async (tx) => {
        const [row] = await tx
          .select({
            orderCount: sql<number>`count(*)::int`,
            revenueMinor: sql<number>`coalesce(sum(${orders.totalMinor}), 0)`,
          })
          .from(orders)
          .where(completedOrderFilters(scope, range));
        return snapshot(asInt(row?.orderCount), asInt(row?.revenueMinor));
      });
    },

    salesTrend(scope: ReportScope, range: DateRange) {
      return withOrganizationScope(db, scope.organizationId, async (tx) => {
        const rows = await tx
          .select({
            day: sql<string>`to_char(date_trunc('day', ${orders.createdAt} at time zone 'utc'), 'YYYY-MM-DD')`,
            orderCount: sql<number>`count(*)::int`,
            revenueMinor: sql<number>`coalesce(sum(${orders.totalMinor}), 0)`,
          })
          .from(orders)
          .where(completedOrderFilters(scope, range))
          .groupBy(sql`date_trunc('day', ${orders.createdAt} at time zone 'utc')`)
          .orderBy(sql`date_trunc('day', ${orders.createdAt} at time zone 'utc')`);
        return rows.map((row) => ({
          date: row.day,
          orderCount: asInt(row.orderCount),
          revenueMinor: asInt(row.revenueMinor),
        }));
      });
    },

    topItems(scope: ReportScope, range: DateRange, limit: number) {
      return withOrganizationScope(db, scope.organizationId, async (tx) => {
        const rows = await tx
          .select({
            itemName: orderItems.itemName,
            categoryName: sql<string>`coalesce(${menuCategories.name}, 'Uncategorized')`,
            qty: sql<number>`coalesce(sum(${orderItems.qty}), 0)::int`,
            revenueMinor: sql<number>`coalesce(sum(${orderItems.lineTotalMinor}), 0)`,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .leftJoin(menuItems, eq(menuItems.id, orderItems.menuItemId))
          .leftJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
          .where(completedOrderFilters(scope, range))
          .groupBy(orderItems.itemName, menuCategories.name)
          .orderBy(desc(sql`coalesce(sum(${orderItems.qty}), 0)`))
          .limit(limit);
        return rows.map((row) => ({
          itemName: row.itemName,
          categoryName: row.categoryName,
          qty: asInt(row.qty),
          revenueMinor: asInt(row.revenueMinor),
        }));
      });
    },

    categoryPerformance(scope: ReportScope, range: DateRange) {
      return withOrganizationScope(db, scope.organizationId, async (tx) => {
        const rows = await tx
          .select({
            categoryName: sql<string>`coalesce(${menuCategories.name}, 'Uncategorized')`,
            qty: sql<number>`coalesce(sum(${orderItems.qty}), 0)::int`,
            revenueMinor: sql<number>`coalesce(sum(${orderItems.lineTotalMinor}), 0)`,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .leftJoin(menuItems, eq(menuItems.id, orderItems.menuItemId))
          .leftJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
          .where(completedOrderFilters(scope, range))
          .groupBy(sql`coalesce(${menuCategories.name}, 'Uncategorized')`)
          .orderBy(desc(sql`coalesce(sum(${orderItems.lineTotalMinor}), 0)`));
        return rows.map((row) => ({
          categoryName: row.categoryName,
          qty: asInt(row.qty),
          revenueMinor: asInt(row.revenueMinor),
        }));
      });
    },

    paymentBreakdown(scope: ReportScope, range: DateRange) {
      return withOrganizationScope(db, scope.organizationId, async (tx) => {
        const paymentFilters = [
          eq(payments.organizationId, scope.organizationId),
          eq(orders.restaurantId, scope.restaurantId),
          gte(payments.createdAt, range.from),
          lt(payments.createdAt, range.to),
          inArray(payments.status, ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"]),
        ];
        if (scope.branchId) {
          paymentFilters.push(eq(orders.branchId, scope.branchId));
        }
        const captured = await tx
          .select({
            method: payments.method,
            amountMinor: sql<number>`coalesce(sum(${payments.amountMinor}), 0)`,
          })
          .from(payments)
          .innerJoin(orders, eq(orders.id, payments.orderId))
          .where(and(...paymentFilters))
          .groupBy(payments.method);

        const refundFilters = [
          eq(refunds.organizationId, scope.organizationId),
          eq(orders.restaurantId, scope.restaurantId),
          gte(refunds.createdAt, range.from),
          lt(refunds.createdAt, range.to),
        ];
        if (scope.branchId) {
          refundFilters.push(eq(orders.branchId, scope.branchId));
        }
        const refunded = await tx
          .select({
            method: payments.method,
            amountMinor: sql<number>`coalesce(sum(${refunds.amountMinor}), 0)`,
          })
          .from(refunds)
          .innerJoin(payments, eq(payments.id, refunds.paymentId))
          .innerJoin(orders, eq(orders.id, payments.orderId))
          .where(and(...refundFilters))
          .groupBy(payments.method);

        const refundMap = new Map(
          refunded.map((row) => [row.method, asInt(row.amountMinor)] as const),
        );
        const methods = new Set([
          ...captured.map((row) => row.method),
          ...refunded.map((row) => row.method),
        ]);
        return [...methods].sort().map((method) => {
          const capturedMinor = asInt(
            captured.find((row) => row.method === method)?.amountMinor,
          );
          const refundedMinor = refundMap.get(method) ?? 0;
          return {
            method,
            capturedMinor,
            refundedMinor,
            netMinor: capturedMinor - refundedMinor,
          };
        });
      });
    },

    /**
     * Stock valuation uses last-cost: `inventory_items.unit_cost_minor` × on-hand
     * `inventory_balances.quantity` in the item base unit. Quantity below zero
     * reduces the estimate. Uncosted items (cost 0) contribute 0.
     */
    stockValuation(scope: ReportScope) {
      return withOrganizationScope(db, scope.organizationId, async (tx) => {
        const filters = [
          eq(inventoryItems.organizationId, scope.organizationId),
          eq(inventoryItems.restaurantId, scope.restaurantId),
        ];
        if (scope.branchId) {
          filters.push(eq(inventoryBalances.branchId, scope.branchId));
        }
        const [row] = await tx
          .select({
            valuationMinor: sql<number>`coalesce(sum(${inventoryBalances.quantity} * ${inventoryItems.unitCostMinor}), 0)`,
          })
          .from(inventoryBalances)
          .innerJoin(inventoryItems, eq(inventoryItems.id, inventoryBalances.inventoryItemId))
          .where(and(...filters));
        return { valuationMinor: asInt(row?.valuationMinor), method: "LAST_COST" as const };
      });
    },

    expenseSum(scope: ReportScope, range: DateRange) {
      return withOrganizationScope(db, scope.organizationId, async (tx) => {
        const filters = [
          eq(expenses.organizationId, scope.organizationId),
          eq(expenses.restaurantId, scope.restaurantId),
          gte(expenses.incurredAt, range.from),
          lt(expenses.incurredAt, range.to),
        ];
        if (scope.branchId) {
          filters.push(eq(expenses.branchId, scope.branchId));
        }
        const [row] = await tx
          .select({
            amountMinor: sql<number>`coalesce(sum(${expenses.amountMinor}), 0)`,
            count: sql<number>`count(*)::int`,
          })
          .from(expenses)
          .where(and(...filters));
        return { amountMinor: asInt(row?.amountMinor), count: asInt(row?.count) };
      });
    },

    operations(scope: ReportScope) {
      return withOrganizationScope(db, scope.organizationId, async (tx) => {
        const orderFilters = [
          eq(orders.organizationId, scope.organizationId),
          eq(orders.restaurantId, scope.restaurantId),
          notInArray(orders.status, ["COMPLETED", "CANCELLED"]),
        ];
        if (scope.branchId) {
          orderFilters.push(eq(orders.branchId, scope.branchId));
        }
        const [open] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(orders)
          .where(and(...orderFilters));

        const ticketFilters = [
          eq(kitchenTickets.organizationId, scope.organizationId),
          eq(kitchenTickets.restaurantId, scope.restaurantId),
          notInArray(kitchenTickets.status, ["CANCELLED"]),
        ];
        if (scope.branchId) {
          ticketFilters.push(eq(kitchenTickets.branchId, scope.branchId));
        }
        const tickets = await tx
          .select({
            status: kitchenTickets.status,
            count: sql<number>`count(*)::int`,
          })
          .from(kitchenTickets)
          .where(and(...ticketFilters))
          .groupBy(kitchenTickets.status);

        const kitchen = { NEW: 0, IN_PROGRESS: 0, READY: 0 };
        for (const row of tickets) {
          if (row.status === "NEW" || row.status === "IN_PROGRESS" || row.status === "READY") {
            kitchen[row.status] = asInt(row.count);
          }
        }

        return {
          openOrders: asInt(open?.count),
          kitchen,
        };
      });
    },
  };
}

export type ReportsRepository = ReturnType<typeof createReportsRepository>;
