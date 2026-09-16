import { eq } from "drizzle-orm";
import { parseApiEnv } from "@niva/config";
import { createDatabase, users } from "@niva/database";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { ACCESS_COOKIE } from "../auth/auth.cookies.js";
import { createRecipeRepository } from "./recipes.repository.js";

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

describe.skipIf(!hasDatabase)("recipes and consumption", () => {
  const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const email = `recipe-${Date.now()}@example.com`;
  const password = "longenough1";

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, email));
    await sql.end();
  });

  it("stores unique recipes, consumes on complete, no-ops a second consume, and reverses a full refund", async () => {
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
      payload: { name: "Recipe Org" },
    });
    const orgId = org.json().data.id as string;
    const headers = { cookie, "x-organization-id": orgId };

    const restaurant = await app.inject({
      method: "POST",
      url: "/api/v1/restaurants",
      headers,
      payload: { name: "Recipe Cafe", inventoryPolicy: "ON_SALE" },
    });
    const restaurantId = restaurant.json().data.id as string;
    expect(restaurant.json().data.inventoryPolicy).toBe("ON_SALE");
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
      payload: { name: "GST 18", rateBps: 1800, cgstBps: 900, sgstBps: 900 },
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
        name: "Idli",
        categoryId: category.json().data.id,
        taxClassId: tax.json().data.id,
        basePriceMinor: 5000,
      },
    });
    const menuItemId = menuItem.json().data.id as string;

    const units = await app.inject({
      method: "GET",
      url: `/api/v1/restaurants/${restaurantId}/units`,
      headers,
    });
    const gram = (units.json().data.units as Array<{ id: string; code: string }>).find(
      (unit) => unit.code === "g",
    )!;
    const rice = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/inventory/items`,
      headers,
      payload: { sku: "RICE", name: "Rice", baseUnitId: gram.id },
    });
    const riceId = rice.json().data.id as string;
    await app.inject({
      method: "POST",
      url: `/api/v1/branches/${branchId}/inventory/transactions`,
      headers,
      payload: {
        type: "ADJUSTMENT",
        inventoryItemId: riceId,
        unitId: gram.id,
        qtyInUnit: 1000,
        reason: "Opening stock",
      },
    });

    const createdRecipe = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/recipes`,
      headers,
      payload: {
        menuItemId,
        lines: [{ inventoryItemId: riceId, qtyBase: 100 }],
      },
    });
    expect(createdRecipe.statusCode).toBe(201);
    const duplicate = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/recipes`,
      headers,
      payload: {
        menuItemId,
        lines: [{ inventoryItemId: riceId, qtyBase: 50 }],
      },
    });
    expect(duplicate.statusCode).toBe(409);

    const otherOrg = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      headers: { cookie },
      payload: { name: "Other" },
    });
    const leak = await app.inject({
      method: "GET",
      url: `/api/v1/restaurants/${restaurantId}/recipes`,
      headers: { cookie, "x-organization-id": otherOrg.json().data.id },
    });
    expect(leak.statusCode).toBe(404);

    async function sellQty(qty: number) {
      const order = await app.inject({
        method: "POST",
        url: `/api/v1/branches/${branchId}/orders`,
        headers,
        payload: {
          type: "TAKEAWAY",
          items: [{ menuItemId, qty, modifierIds: [] }],
        },
      });
      const orderId = order.json().data.id as string;
      const totalMinor = order.json().data.totalMinor as number;
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
      return { orderId, totalMinor };
    }

    const first = await sellQty(2);
    const complete = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${first.orderId}/complete`,
      headers,
    });
    expect(complete.statusCode).toBe(200);

    const afterSale = await app.inject({
      method: "GET",
      url: `/api/v1/branches/${branchId}/inventory/items`,
      headers,
    });
    const sold = afterSale.json().data.items.find((row: { id: string }) => row.id === riceId);
    expect(sold.quantity).toBe(800);

    const again = await createRecipeRepository(db).consumeOrder({
      organizationId: orgId,
      restaurantId,
      branchId,
      orderId: first.orderId,
      actorId: (await app.inject({ method: "GET", url: "/api/v1/auth/me", headers })).json()
        .data.user.id,
    });
    expect(again.status).toBe("already");
    const still = await app.inject({
      method: "GET",
      url: `/api/v1/branches/${branchId}/inventory/items`,
      headers,
    });
    expect(still.json().data.items.find((row: { id: string }) => row.id === riceId).quantity).toBe(
      800,
    );

    const actorId = (
      await app.inject({ method: "GET", url: "/api/v1/auth/me", headers })
    ).json().data.user.id as string;

    const second = await sellQty(1);
    const [left, right] = await Promise.all([
      app.inject({
        method: "POST",
        url: `/api/v1/orders/${second.orderId}/complete`,
        headers,
      }),
      app.inject({
        method: "POST",
        url: `/api/v1/orders/${second.orderId}/complete`,
        headers,
      }),
    ]);
    expect([left.statusCode, right.statusCode].some((code) => code === 200)).toBe(true);
    const afterRace = await app.inject({
      method: "GET",
      url: `/api/v1/branches/${branchId}/inventory/items`,
      headers,
    });
    expect(
      afterRace.json().data.items.find((row: { id: string }) => row.id === riceId).quantity,
    ).toBe(700);

    const payments = complete.json().data.payments as Array<{ id: string }>;
    const refund = await app.inject({
      method: "POST",
      url: `/api/v1/payments/${payments[0]?.id}/refunds`,
      headers,
      payload: { amountMinor: first.totalMinor, reason: "Guest complaint" },
    });
    expect(refund.statusCode).toBe(201);
    const restored = await app.inject({
      method: "GET",
      url: `/api/v1/branches/${branchId}/inventory/items`,
      headers,
    });
    expect(
      restored.json().data.items.find((row: { id: string }) => row.id === riceId).quantity,
    ).toBe(900);

    const reverseAgain = await createRecipeRepository(db).reverseOrder({
      organizationId: orgId,
      orderId: first.orderId,
      actorId,
    });
    expect(reverseAgain.status).toBe("already");
  });
});
