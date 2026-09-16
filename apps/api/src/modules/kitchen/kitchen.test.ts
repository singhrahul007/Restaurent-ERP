import { eq } from "drizzle-orm";
import { parseApiEnv } from "@niva/config";
import { createDatabase, users } from "@niva/database";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { ACCESS_COOKIE } from "../auth/auth.cookies.js";
import { kitchenPayloadHasMoney } from "./kitchen.public.js";

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

describe.skipIf(!hasDatabase)("kitchen tickets", () => {
  const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const email = `kds-${Date.now()}@example.com`;
  const password = "longenough1";

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, email));
    await sql.end();
  });

  it("creates tickets on confirm, omits money, and marks the order READY", async () => {
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
      payload: { name: "KDS Org" },
    });
    const orgId = org.json().data.id as string;
    const headers = { cookie, "x-organization-id": orgId };

    const restaurant = await app.inject({
      method: "POST",
      url: "/api/v1/restaurants",
      headers,
      payload: { name: "KDS Cafe", kitchenSoundEnabled: true },
    });
    const restaurantId = restaurant.json().data.id as string;
    expect(restaurant.json().data.kitchenSoundEnabled).toBe(true);
    const branch = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/branches`,
      headers,
      payload: { name: "Main" },
    });
    const branchId = branch.json().data.id as string;
    const otherBranch = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/branches`,
      headers,
      payload: { name: "Other" },
    });
    const otherBranchId = otherBranch.json().data.id as string;

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
        name: "Idli",
        categoryId: category.json().data.id,
        taxClassId: tax.json().data.id,
        basePriceMinor: 5000,
      },
    });
    const itemId = item.json().data.id as string;

    const created = await app.inject({
      method: "POST",
      url: `/api/v1/branches/${branchId}/orders`,
      headers,
      payload: {
        type: "TAKEAWAY",
        items: [{ menuItemId: itemId, qty: 1, modifierIds: [] }],
      },
    });
    const orderId = created.json().data.id as string;
    await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/confirm`,
      headers,
    });

    const board = await app.inject({
      method: "GET",
      url: `/api/v1/branches/${branchId}/kitchen/tickets`,
      headers,
    });
    expect(board.statusCode).toBe(200);
    expect(kitchenPayloadHasMoney(board.json().data)).toBe(false);
    expect(JSON.stringify(board.json().data)).not.toMatch(/amountMinor|totalMinor|balanceMinor|payment/i);
    const ticket = board.json().data.columns.NEW[0] as {
      id: string;
      items: Array<{ id: string; name: string }>;
    };
    expect(ticket.items[0]?.name).toBe("Idli");

    const otherBoard = await app.inject({
      method: "GET",
      url: `/api/v1/branches/${otherBranchId}/kitchen/tickets`,
      headers,
    });
    expect(otherBoard.json().data.columns.NEW).toHaveLength(0);

    const cooking = await app.inject({
      method: "PATCH",
      url: `/api/v1/kitchen/ticket-items/${ticket.items[0]?.id}`,
      headers,
      payload: { status: "IN_PROGRESS" },
    });
    expect(cooking.statusCode).toBe(200);
    expect(cooking.json().data.status).toBe("IN_PROGRESS");

    const ready = await app.inject({
      method: "POST",
      url: `/api/v1/kitchen/tickets/${ticket.id}/ready`,
      headers,
    });
    expect(ready.statusCode).toBe(200);
    expect(ready.json().data.status).toBe("READY");

    const order = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${orderId}`,
      headers,
    });
    expect(order.json().data.status).toBe("READY");
  });
});
