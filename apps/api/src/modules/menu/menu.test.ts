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

describe.skipIf(!hasDatabase)("menu", () => {
  const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const ownerA = `menu-a-${Date.now()}@example.com`;
  const ownerB = `menu-b-${Date.now()}@example.com`;
  const password = "longenough1";

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, ownerA));
    await db.delete(users).where(eq(users.email, ownerB));
    await sql.end();
  });

  it("isolates tenants, stores integer money/tax, and 86s items", async () => {
    const app = await buildApp({ env, sql, db });

    async function session(email: string) {
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
      const org = await app.inject({
        method: "POST",
        url: "/api/v1/organizations",
        headers: { cookie: cookieHeader(login.cookies, [ACCESS_COOKIE]) },
        payload: { name: `Org ${email}` },
      });
      const orgId = org.json().data.id as string;
      const headers = {
        cookie: cookieHeader(login.cookies, [ACCESS_COOKIE]),
        "x-organization-id": orgId,
      };
      const restaurant = await app.inject({
        method: "POST",
        url: "/api/v1/restaurants",
        headers,
        payload: { name: "Cafe" },
      });
      return {
        headers,
        restaurantId: restaurant.json().data.id as string,
      };
    }

    const a = await session(ownerA);
    const b = await session(ownerB);

    const tax = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${a.restaurantId}/tax-classes`,
      headers: a.headers,
      payload: {
        name: "GST 18",
        inclusive: false,
        rateBps: 1800,
        cgstBps: 900,
        sgstBps: 900,
        igstBps: 0,
      },
    });
    expect(tax.statusCode).toBe(201);
    expect(tax.json().data.currentRate.rateBps).toBe(1800);
    const taxClassId = tax.json().data.id as string;

    const category = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${a.restaurantId}/menu/categories`,
      headers: a.headers,
      payload: { name: "South" },
    });
    expect(category.statusCode).toBe(201);
    const categoryId = category.json().data.id as string;

    const leak = await app.inject({
      method: "GET",
      url: `/api/v1/restaurants/${a.restaurantId}/menu/categories`,
      headers: b.headers,
    });
    expect(leak.statusCode).toBe(404);

    const leakClass = await app.inject({
      method: "PATCH",
      url: `/api/v1/tax-classes/${taxClassId}`,
      headers: b.headers,
      payload: { name: "Stolen" },
    });
    expect(leakClass.statusCode).toBe(404);

    const floatPrice = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${a.restaurantId}/menu/items`,
      headers: a.headers,
      payload: {
        name: "Dosa",
        categoryId,
        taxClassId,
        basePriceMinor: 99.5,
      },
    });
    expect(floatPrice.statusCode).toBe(400);

    const item = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${a.restaurantId}/menu/items`,
      headers: a.headers,
      payload: {
        name: "Masala dosa",
        categoryId,
        taxClassId,
        basePriceMinor: 12000,
      },
    });
    expect(item.statusCode).toBe(201);
    expect(item.json().data.basePriceMinor).toBe(12000);
    const itemId = item.json().data.id as string;

    const floatVariant = await app.inject({
      method: "POST",
      url: `/api/v1/menu/items/${itemId}/variants`,
      headers: a.headers,
      payload: { name: "Large", priceDeltaMinor: 1.5 },
    });
    expect(floatVariant.statusCode).toBe(400);

    const variant = await app.inject({
      method: "POST",
      url: `/api/v1/menu/items/${itemId}/variants`,
      headers: a.headers,
      payload: { name: "Large", priceDeltaMinor: 2000 },
    });
    expect(variant.statusCode).toBe(201);
    expect(variant.json().data.priceDeltaMinor).toBe(2000);

    const badGroup = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${a.restaurantId}/menu/modifier-groups`,
      headers: a.headers,
      payload: { name: "Add-ons", minSelect: 2, maxSelect: 1 },
    });
    expect(badGroup.statusCode).toBe(400);

    const group = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${a.restaurantId}/menu/modifier-groups`,
      headers: a.headers,
      payload: { name: "Add-ons", minSelect: 0, maxSelect: 2 },
    });
    expect(group.statusCode).toBe(201);
    const groupId = group.json().data.id as string;

    await app.inject({
      method: "POST",
      url: `/api/v1/menu/modifier-groups/${groupId}/modifiers`,
      headers: a.headers,
      payload: { name: "Extra chutney", priceDeltaMinor: 1500 },
    });

    const attached = await app.inject({
      method: "PUT",
      url: `/api/v1/menu/items/${itemId}/modifier-groups`,
      headers: a.headers,
      payload: { modifierGroupIds: [groupId] },
    });
    expect(attached.statusCode).toBe(200);
    expect(attached.json().data.modifierGroups).toHaveLength(1);

    const eightySixed = await app.inject({
      method: "PUT",
      url: `/api/v1/menu/items/${itemId}/availability`,
      headers: a.headers,
      payload: { available: false },
    });
    expect(eightySixed.statusCode).toBe(200);

    const listed = await app.inject({
      method: "GET",
      url: `/api/v1/restaurants/${a.restaurantId}/menu/items`,
      headers: a.headers,
    });
    expect(listed.json().data.items[0].effectiveAvailable).toBe(false);
  });
});
