import { eq } from "drizzle-orm";
import { parseApiEnv } from "@niva/config";
import { createDatabase, outbox, users, withOrganizationScope } from "@niva/database";
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

describe.skipIf(!hasDatabase)("orders and payments", () => {
  const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const email = `pos-${Date.now()}@example.com`;
  const password = "longenough1";

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, email));
    await sql.end();
  });

  it("prices lines, occupies tables, pays without status change, and completes when settled", async () => {
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
      payload: { name: "POS Org" },
    });
    const orgId = org.json().data.id as string;
    const headers = { cookie, "x-organization-id": orgId };

    const restaurant = await app.inject({
      method: "POST",
      url: "/api/v1/restaurants",
      headers,
      payload: { name: "POS Cafe" },
    });
    const restaurantId = restaurant.json().data.id as string;
    const branch = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/branches`,
      headers,
      payload: { name: "Main" },
    });
    const branchId = branch.json().data.id as string;
    const table = await app.inject({
      method: "POST",
      url: `/api/v1/branches/${branchId}/tables`,
      headers,
      payload: { code: "T1" },
    });
    const tableId = table.json().data.id as string;

    const tax = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/tax-classes`,
      headers,
      payload: { name: "GST 18", rateBps: 1800, cgstBps: 900, sgstBps: 900 },
    });
    const category = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/menu/categories`,
      headers,
      payload: { name: "Mains" },
    });
    const item = await app.inject({
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
    const itemId = item.json().data.id as string;

    const key = `idem-${Date.now()}`;
    const created = await app.inject({
      method: "POST",
      url: `/api/v1/branches/${branchId}/orders`,
      headers: { ...headers, "idempotency-key": key },
      payload: {
        type: "DINE_IN",
        tableId,
        items: [{ menuItemId: itemId, qty: 1, modifierIds: [] }],
      },
    });
    expect(created.statusCode).toBe(201);
    const orderId = created.json().data.id as string;
    expect(created.json().data.status).toBe("CREATED");
    expect(Number.isInteger(created.json().data.totalMinor)).toBe(true);
    expect(created.json().data.items[0].unitPriceMinor).toBe(10000);

    const added = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/items`,
      headers,
      payload: { menuItemId: itemId, qty: 1, modifierIds: [] },
    });
    expect(added.statusCode).toBe(200);
    expect(added.json().data.items).toHaveLength(2);

    const lineId = added.json().data.items[0].id as string;
    const patched = await app.inject({
      method: "PATCH",
      url: `/api/v1/order-items/${lineId}`,
      headers,
      payload: { qty: 2 },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().data.items.find((row: { id: string }) => row.id === lineId)?.qty).toBe(2);
    expect(patched.json().data.totalMinor).toBeGreaterThan(created.json().data.totalMinor);

    const replay = await app.inject({
      method: "POST",
      url: `/api/v1/branches/${branchId}/orders`,
      headers: { ...headers, "idempotency-key": key },
      payload: {
        type: "DINE_IN",
        tableId,
        items: [{ menuItemId: itemId, qty: 1, modifierIds: [] }],
      },
    });
    expect(replay.statusCode).toBe(201);
    expect(replay.json().data.id).toBe(orderId);

    const occupied = await app.inject({
      method: "POST",
      url: `/api/v1/branches/${branchId}/orders`,
      headers,
      payload: {
        type: "DINE_IN",
        tableId,
        items: [{ menuItemId: itemId, qty: 1, modifierIds: [] }],
      },
    });
    expect(occupied.statusCode).toBe(409);

    const tooMuchDiscount = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/discounts`,
      headers,
      payload: { type: "AMOUNT", amountMinor: 999999 },
    });
    expect(tooMuchDiscount.statusCode).toBe(200);
    expect(tooMuchDiscount.json().data.totalMinor).toBeGreaterThanOrEqual(0);

    await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/discounts`,
      headers,
      payload: { type: "AMOUNT", amountMinor: 0 },
    });

    const coupon = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/coupons`,
      headers,
      payload: { code: "SAVE10", amountMinor: 1000 },
    });
    expect(coupon.statusCode).toBe(201);
    const applied = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/coupon`,
      headers,
      payload: { code: "save10" },
    });
    expect(applied.statusCode).toBe(200);
    expect(applied.json().data.couponTotalMinor).toBe(1000);

    const unpaidComplete = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/complete`,
      headers,
    });
    expect(unpaidComplete.statusCode).toBe(409);
    expect(unpaidComplete.json().error.code).toBe("CONFLICT");

    const beforePayStatus = applied.json().data.status as string;
    const pay = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/payments`,
      headers,
      payload: { amountMinor: applied.json().data.totalMinor, method: "CASH" },
    });
    expect(pay.statusCode).toBe(201);
    expect(pay.json().data.order.status).toBe(beforePayStatus);
    expect(pay.json().data.order.balanceMinor).toBe(0);

    const prematureComplete = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/complete`,
      headers,
    });
    expect(prematureComplete.statusCode).toBe(409);
    expect(prematureComplete.json().error.code).toBe("INVALID_STATE_TRANSITION");

    const confirm = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/confirm`,
      headers,
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().data.status).toBe("PREPARING");
    expect(confirm.json().data.history.some((row: { toStatus: string }) => row.toStatus === "CONFIRMED")).toBe(
      true,
    );
    const events = await withOrganizationScope(db, orgId, (tx) =>
      tx.select({ topic: outbox.topic }).from(outbox),
    );
    expect(events.some((row) => row.topic === "order.updated")).toBe(true);

    const illegal = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/serve`,
      headers,
    });
    expect(illegal.statusCode).toBe(409);
    expect(illegal.json().error.code).toBe("INVALID_STATE_TRANSITION");

    const complete = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/complete`,
      headers,
    });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().data.status).toBe("COMPLETED");

    const cancelDone = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/cancel`,
      headers,
    });
    expect(cancelDone.statusCode).toBe(409);

    const refund = await app.inject({
      method: "POST",
      url: `/api/v1/payments/${pay.json().data.payment.id}/refunds`,
      headers,
      payload: { amountMinor: 1, reason: "test" },
    });
    expect(refund.statusCode).toBe(201);

    const overRefund = await app.inject({
      method: "POST",
      url: `/api/v1/payments/${pay.json().data.payment.id}/refunds`,
      headers,
      payload: { amountMinor: 99_999_999 },
    });
    expect(overRefund.statusCode).toBe(400);
  });
});
