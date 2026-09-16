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

describe.skipIf(!hasDatabase)("integrations", () => {
  const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const email = `integrations-${Date.now()}@example.com`;
  const password = "longenough1";

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, email));
    await sql.end();
  });

  it("masks secrets, stubs webhooks, and ingests mock partner orders as ONLINE", async () => {
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
      payload: { name: "Integrations Org" },
    });
    const orgId = org.json().data.id as string;
    const headers = { cookie, "x-organization-id": orgId };

    const saved = await app.inject({
      method: "PUT",
      url: "/api/v1/integration-accounts",
      headers,
      payload: { provider: "mock_pay", credentials: { secret: "super-secret-key" } },
    });
    expect(saved.statusCode).toBe(201);
    expect(JSON.stringify(saved.json())).not.toContain("super-secret-key");
    expect(saved.json().data.credentialsMasked).toEqual({ secret: true });

    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/integration-accounts",
      headers,
    });
    expect(listed.statusCode).toBe(200);
    expect(JSON.stringify(listed.json())).not.toContain("super-secret-key");
    expect(listed.json().data.accounts[0].credentialsMasked.secret).toBe(true);

    const webhook = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks/mock",
      payload: { providerRef: "mock_1", event: "payment.captured" },
    });
    expect(webhook.statusCode).toBe(200);
    expect(webhook.json().data.accepted).toBe(true);

    const restaurant = await app.inject({
      method: "POST",
      url: "/api/v1/restaurants",
      headers,
      payload: { name: "Channel Cafe" },
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
        basePriceMinor: 8000,
      },
    });

    const ingested = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/channels/mock/orders`,
      headers,
      payload: {
        externalId: `ext-${Date.now()}`,
        branchId,
        items: [{ menuItemId: menuItem.json().data.id, qty: 1 }],
      },
    });
    expect(ingested.statusCode).toBe(201);
    expect(ingested.json().data.type).toBe("ONLINE");
    expect(ingested.json().data.source).toBe("partner:mock");
  });
});
