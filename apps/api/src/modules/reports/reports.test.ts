import { eq } from "drizzle-orm";
import { parseApiEnv } from "@niva/config";
import { createDatabase, users } from "@niva/database";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { ACCESS_COOKIE } from "../auth/auth.cookies.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);

function cookieHeader(
  cookies: Array<{ name: string; value: string }>,
  names: string[],
): string {
  return cookies
    .filter((cookie) => names.includes(cookie.name))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

describe.skipIf(!hasDatabase)("analytics reports", () => {
  const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const email = `reports-${Date.now()}@example.com`;
  const password = "longenough1";

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, email));
    await sql.end();
  });

  it("aggregates completed sales, payments, last-cost stock, and expenses", async () => {
    const app = await buildApp({ env, sql, db });
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    const cookie = cookieHeader(login.cookies, [ACCESS_COOKIE]);
    const org = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      headers: { cookie },
      payload: { name: "Analytics Org" },
    });
    const orgId = org.json().data.id as string;
    const headers = { cookie, "x-organization-id": orgId };

    const restaurant = await app.inject({
      method: "POST",
      url: "/api/v1/restaurants",
      headers,
      payload: { name: "Analytics Cafe" },
    });
    const restaurantId = restaurant.json().data.id as string;
    const branch = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/branches`,
      headers,
      payload: { name: "Main" },
    });
    const branchId = branch.json().data.id as string;

    const tax = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/tax-classes`,
      headers,
      payload: { name: "GST 0", rateBps: 0, inclusive: true },
    });
    const category = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/menu/categories`,
      headers,
      payload: { name: "Mains" },
    });
    const menuItem = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/menu/items`,
      headers,
      payload: {
        name: "Dosa",
        categoryId: category.json().data.id,
        taxClassId: tax.json().data.id,
        basePriceMinor: 10000,
      },
    });
    const menuItemId = menuItem.json().data.id as string;

    const created = await app.inject({
      method: "POST",
      url: `/api/v1/branches/${branchId}/orders`,
      headers,
      payload: {
        type: "TAKEAWAY",
        items: [{ menuItemId, qty: 2, modifierIds: [] }],
      },
    });
    expect(created.statusCode).toBe(201);
    const orderId = created.json().data.id as string;
    const totalMinor = created.json().data.totalMinor as number;

    await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/payments`,
      headers,
      payload: { amountMinor: totalMinor, method: "CASH" },
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/confirm`,
      headers,
    });
    const complete = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/complete`,
      headers,
    });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().data.status).toBe("COMPLETED");

    const sales = await app.inject({
      method: "GET",
      url: `/api/v1/restaurants/${restaurantId}/reports/sales?branchId=${branchId}`,
      headers,
    });
    expect(sales.statusCode).toBe(200);
    expect(sales.json().data.today.revenueMinor).toBe(totalMinor);
    expect(sales.json().data.today.orderCount).toBe(1);
    expect(sales.json().data.today.aovMinor).toBe(totalMinor);
    expect(sales.json().data.week.revenueMinor).toBe(totalMinor);
    expect(sales.json().data.month.revenueMinor).toBe(totalMinor);
    expect(Number.isInteger(sales.json().data.today.revenueMinor)).toBe(true);

    const items = await app.inject({
      method: "GET",
      url: `/api/v1/restaurants/${restaurantId}/reports/items?branchId=${branchId}`,
      headers,
    });
    expect(items.statusCode).toBe(200);
    expect(items.json().data.items[0]).toMatchObject({
      itemName: "Dosa",
      categoryName: "Mains",
      qty: 2,
      revenueMinor: totalMinor,
    });
    expect(items.json().data.categories[0].categoryName).toBe("Mains");

    const payReport = await app.inject({
      method: "GET",
      url: `/api/v1/restaurants/${restaurantId}/reports/payments?branchId=${branchId}`,
      headers,
    });
    expect(payReport.statusCode).toBe(200);
    expect(payReport.json().data.methods).toEqual([
      { method: "CASH", capturedMinor: totalMinor, refundedMinor: 0, netMinor: totalMinor },
    ]);

    const units = await app.inject({
      method: "GET",
      url: `/api/v1/restaurants/${restaurantId}/units`,
      headers,
    });
    const each = (units.json().data.units as Array<{ id: string; code: string }>).find(
      (unit) => unit.code === "each",
    )!;
    const stockItem = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/inventory/items`,
      headers,
      payload: {
        sku: "OIL",
        name: "Oil",
        baseUnitId: each.id,
        unitCostMinor: 250,
        lowStockThreshold: 10,
      },
    });
    const inventoryItemId = stockItem.json().data.id as string;
    await app.inject({
      method: "POST",
      url: `/api/v1/branches/${branchId}/inventory/transactions`,
      headers,
      payload: {
        type: "ADJUSTMENT",
        inventoryItemId,
        unitId: each.id,
        qtyInUnit: 4,
        reason: "Opening",
      },
    });

    const expense = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/expenses`,
      headers,
      payload: { category: "Rent", amountMinor: 50000, branchId },
    });
    expect(expense.statusCode).toBe(201);
    expect(expense.json().data.amountMinor).toBe(50000);

    const inventoryReport = await app.inject({
      method: "GET",
      url: `/api/v1/restaurants/${restaurantId}/reports/inventory?branchId=${branchId}`,
      headers,
    });
    expect(inventoryReport.statusCode).toBe(200);
    expect(inventoryReport.json().data.stock).toEqual({
      valuationMinor: 1000,
      method: "LAST_COST",
    });
    expect(inventoryReport.json().data.expenses.amountMinor).toBe(50000);

    const ops = await app.inject({
      method: "GET",
      url: `/api/v1/restaurants/${restaurantId}/reports/operations?branchId=${branchId}`,
      headers,
    });
    expect(ops.statusCode).toBe(200);
    expect(ops.json().data.openOrders).toBe(0);

    const missing = await app.inject({
      method: "GET",
      url: `/api/v1/restaurants/00000000-0000-4000-8000-000000000000/reports/sales`,
      headers,
    });
    expect(missing.statusCode).toBe(404);
  });
});
