import { and, eq } from "drizzle-orm";
import { parseApiEnv } from "@niva/config";
import { auditLogs, createDatabase, outbox, users } from "@niva/database";
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

describe.skipIf(!hasDatabase)("inventory", () => {
  const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const email = `inv-${Date.now()}@example.com`;
  const password = "longenough1";

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, email));
    await sql.end();
  });

  it("converts with integers, posts movements, receives POs, transfers, and alerts", async () => {
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
      payload: { name: "Stock Org" },
    });
    const orgId = org.json().data.id as string;
    const headers = { cookie, "x-organization-id": orgId };

    const restaurant = await app.inject({
      method: "POST",
      url: "/api/v1/restaurants",
      headers,
      payload: { name: "Stock Cafe" },
    });
    const restaurantId = restaurant.json().data.id as string;
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
      payload: { name: "Warehouse" },
    });
    const otherBranchId = otherBranch.json().data.id as string;

    const units = await app.inject({
      method: "GET",
      url: `/api/v1/restaurants/${restaurantId}/units`,
      headers,
    });
    expect(units.statusCode).toBe(200);
    const unitRows = units.json().data.units as Array<{ id: string; code: string }>;
    const gram = unitRows.find((unit) => unit.code === "g")!;
    const kilo = unitRows.find((unit) => unit.code === "kg")!;

    const item = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/inventory/items`,
      headers,
      payload: {
        sku: "RICE-1",
        name: "Rice",
        baseUnitId: gram.id,
        lowStockThreshold: 500,
      },
    });
    expect(item.statusCode).toBe(201);
    const itemId = item.json().data.id as string;

    const inexact = await app.inject({
      method: "POST",
      url: `/api/v1/branches/${branchId}/inventory/transactions`,
      headers,
      payload: {
        type: "ADJUSTMENT",
        inventoryItemId: itemId,
        unitId: kilo.id,
        qtyInUnit: 1,
        reason: "should convert 1kg to 1000g",
      },
    });
    expect(inexact.statusCode).toBe(201);
    expect(inexact.json().data.qtyBase).toBe(1000);

    const listed = await app.inject({
      method: "GET",
      url: `/api/v1/branches/${branchId}/inventory/items`,
      headers,
    });
    expect(listed.json().data.items[0].quantity).toBe(1000);

    const wastage = await app.inject({
      method: "POST",
      url: `/api/v1/branches/${branchId}/inventory/transactions`,
      headers,
      payload: {
        type: "WASTAGE",
        inventoryItemId: itemId,
        unitId: gram.id,
        qtyInUnit: 600,
        reason: "Spill",
      },
    });
    expect(wastage.statusCode).toBe(201);
    expect(wastage.json().data.quantity).toBe(400);

    const audits = await db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(
        and(eq(auditLogs.organizationId, orgId), eq(auditLogs.action, "INVENTORY_ADJUSTED")),
      );
    expect(audits.length).toBeGreaterThanOrEqual(2);

    const alerts = await app.inject({
      method: "GET",
      url: `/api/v1/restaurants/${restaurantId}/inventory/alerts`,
      headers,
    });
    expect(alerts.json().data.alerts).toHaveLength(1);

    const events = await db
      .select({ topic: outbox.topic })
      .from(outbox)
      .where(and(eq(outbox.organizationId, orgId), eq(outbox.topic, "inventory.low_stock")));
    expect(events.length).toBeGreaterThanOrEqual(1);

    const supplier = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/suppliers`,
      headers,
      payload: { name: "Grain Co" },
    });
    expect(supplier.statusCode).toBe(201);
    const supplierId = supplier.json().data.id as string;

    const po = await app.inject({
      method: "POST",
      url: `/api/v1/branches/${branchId}/purchase-orders`,
      headers,
      payload: {
        supplierId,
        lines: [{ inventoryItemId: itemId, unitId: gram.id, qtyInUnit: 200 }],
      },
    });
    expect(po.statusCode).toBe(201);
    const received = await app.inject({
      method: "POST",
      url: `/api/v1/purchase-orders/${po.json().data.id}/receive`,
      headers,
    });
    expect(received.statusCode).toBe(200);
    expect(received.json().data.status).toBe("RECEIVED");

    const afterPo = await app.inject({
      method: "GET",
      url: `/api/v1/branches/${branchId}/inventory/items`,
      headers,
    });
    expect(afterPo.json().data.items[0].quantity).toBe(600);

    const transfer = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/inventory/transfers`,
      headers,
      payload: {
        fromBranchId: branchId,
        toBranchId: otherBranchId,
        inventoryItemId: itemId,
        unitId: gram.id,
        qtyInUnit: 100,
      },
    });
    expect(transfer.statusCode).toBe(201);
    expect(transfer.json().data.out.type).toBe("TRANSFER_OUT");
    expect(transfer.json().data.in.type).toBe("TRANSFER_IN");

    const dest = await app.inject({
      method: "GET",
      url: `/api/v1/branches/${otherBranchId}/inventory/items`,
      headers,
    });
    expect(dest.json().data.items[0].quantity).toBe(100);

    const otherOrg = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      headers: { cookie },
      payload: { name: "Other Org" },
    });
    const leak = await app.inject({
      method: "GET",
      url: `/api/v1/restaurants/${restaurantId}/suppliers`,
      headers: { cookie, "x-organization-id": otherOrg.json().data.id },
    });
    expect(leak.statusCode).toBe(404);
  });
});
