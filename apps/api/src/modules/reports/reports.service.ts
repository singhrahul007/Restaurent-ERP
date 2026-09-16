import type { ReportsQuery } from "@niva/validation";
import { AppError } from "../../lib/errors.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import {
  periodWindows,
  type DateRange,
  type ReportScope,
  type ReportsRepository,
} from "./reports.repository.js";

function assertBranch(tenant: TenantContext, branchId: string) {
  if (tenant.allowedBranchIds && !tenant.allowedBranchIds.includes(branchId)) {
    throw new AppError("NOT_FOUND", "Not found", 404);
  }
}

function fillTrend(
  from: Date,
  to: Date,
  rows: Array<{ date: string; orderCount: number; revenueMinor: number }>,
) {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const days: Array<{ date: string; orderCount: number; revenueMinor: number }> = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (cursor < end) {
    const date = cursor.toISOString().slice(0, 10);
    days.push(byDate.get(date) ?? { date, orderCount: 0, revenueMinor: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function createReportsService(reports: ReportsRepository) {
  async function scope(
    tenant: TenantContext,
    restaurantId: string,
    query: ReportsQuery,
  ): Promise<{ scope: ReportScope; range: DateRange; windows: ReturnType<typeof periodWindows> }> {
    const restaurant = await reports.findRestaurant(tenant.organizationId, restaurantId);
    if (!restaurant) {
      throw new AppError("NOT_FOUND", "Not found", 404);
    }
    if (query.branchId) {
      assertBranch(tenant, query.branchId);
    }
    const windows = periodWindows();
    const from = query.from ?? windows.monthStart;
    const to = query.to ?? windows.now;
    if (from >= to) {
      throw new AppError("VALIDATION_ERROR", "from must be before to", 400);
    }
    return {
      scope: {
        organizationId: tenant.organizationId,
        restaurantId,
        branchId: query.branchId,
      },
      range: { from, to },
      windows,
    };
  }

  return {
    async sales(tenant: TenantContext, restaurantId: string, query: ReportsQuery) {
      const { scope: reportScope, windows } = await scope(tenant, restaurantId, query);
      const [today, week, month, trendRows] = await Promise.all([
        reports.salesTotals(reportScope, { from: windows.todayStart, to: windows.tomorrow }),
        reports.salesTotals(reportScope, { from: windows.weekStart, to: windows.tomorrow }),
        reports.salesTotals(reportScope, { from: windows.monthStart, to: windows.tomorrow }),
        reports.salesTrend(reportScope, { from: windows.trendStart, to: windows.tomorrow }),
      ]);
      return {
        timezone: "UTC",
        today,
        week,
        month,
        trend: fillTrend(windows.trendStart, windows.tomorrow, trendRows),
      };
    },

    async items(tenant: TenantContext, restaurantId: string, query: ReportsQuery) {
      const { scope: reportScope, range, windows } = await scope(tenant, restaurantId, query);
      const window = query.from || query.to ? range : { from: windows.monthStart, to: windows.tomorrow };
      const limit = query.limit ?? 10;
      const [items, categories] = await Promise.all([
        reports.topItems(reportScope, window, limit),
        reports.categoryPerformance(reportScope, window),
      ]);
      return { items, categories };
    },

    async payments(tenant: TenantContext, restaurantId: string, query: ReportsQuery) {
      const { scope: reportScope, range, windows } = await scope(tenant, restaurantId, query);
      const window = query.from || query.to ? range : { from: windows.monthStart, to: windows.tomorrow };
      return { methods: await reports.paymentBreakdown(reportScope, window) };
    },

    async inventory(tenant: TenantContext, restaurantId: string, query: ReportsQuery) {
      const { scope: reportScope, range, windows } = await scope(tenant, restaurantId, query);
      const window = query.from || query.to ? range : { from: windows.monthStart, to: windows.tomorrow };
      const [stock, expenses] = await Promise.all([
        reports.stockValuation(reportScope),
        reports.expenseSum(reportScope, window),
      ]);
      return { stock, expenses };
    },

    async operations(tenant: TenantContext, restaurantId: string, query: ReportsQuery) {
      const { scope: reportScope } = await scope(tenant, restaurantId, query);
      return reports.operations(reportScope);
    },
  };
}
