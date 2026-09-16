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

describe.skipIf(!hasDatabase)("restaurant setup", () => {
  const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const email = `setup-${Date.now()}@example.com`;
  const staffEmail = `staff-${Date.now()}@example.com`;
  const password = "longenough1";

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, email));
    await db.delete(users).where(eq(users.email, staffEmail));
    await sql.end();
  });

  it("defaults INR/Kolkata, unique table codes, and blocks platform roles", async () => {
    const app = await buildApp({ env, sql, db });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });
    expect(created.statusCode).toBe(201);

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
      payload: { name: "Setup Org" },
    });
    expect(org.statusCode).toBe(201);
    const orgId = org.json().data.id as string;
    const headers = { cookie, "x-organization-id": orgId };

    const restaurant = await app.inject({
      method: "POST",
      url: "/api/v1/restaurants",
      headers,
      payload: { name: "Cafe" },
    });
    expect(restaurant.statusCode).toBe(201);
    expect(restaurant.json().data.currency).toBe("INR");
    expect(restaurant.json().data.timezone).toBe("Asia/Kolkata");
    expect(restaurant.json().data.taxInclusive).toBe(false);
    expect(restaurant.json().data.inventoryPolicy).toBe("OFF");
    const restaurantId = restaurant.json().data.id as string;

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/v1/restaurants/${restaurantId}`,
      headers,
      payload: {
        addressLine1: "12 MG Road",
        city: "Bengaluru",
        taxInclusive: true,
        inventoryPolicy: "ON_SALE",
      },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().data.taxInclusive).toBe(true);
    expect(patched.json().data.city).toBe("Bengaluru");

    const branch = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/branches`,
      headers,
      payload: { name: "Indiranagar", posIdleTimeoutMinutes: 10 },
    });
    expect(branch.statusCode).toBe(201);
    expect(branch.json().data.posIdleTimeoutMinutes).toBe(10);
    const branchId = branch.json().data.id as string;

    const table = await app.inject({
      method: "POST",
      url: `/api/v1/branches/${branchId}/tables`,
      headers,
      payload: { code: "T1", floor: "Ground", seats: 4 },
    });
    expect(table.statusCode).toBe(201);

    const duplicate = await app.inject({
      method: "POST",
      url: `/api/v1/branches/${branchId}/tables`,
      headers,
      payload: { code: "T1" },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe("CONFLICT");

    const platformInvite = await app.inject({
      method: "POST",
      url: "/api/v1/staff/invites",
      headers,
      payload: { email: staffEmail, roleSlug: "SUPER_ADMIN", branchIds: [] },
    });
    expect(platformInvite.statusCode).toBe(403);

    const invite = await app.inject({
      method: "POST",
      url: "/api/v1/staff/invites",
      headers,
      payload: {
        email: staffEmail,
        roleSlug: "RESTAURANT_MANAGER",
        branchIds: [branchId],
      },
    });
    expect(invite.statusCode).toBe(201);
    expect(invite.json().data.roleSlug).toBe("RESTAURANT_MANAGER");

    const staffList = await app.inject({
      method: "GET",
      url: "/api/v1/staff",
      headers,
    });
    expect(staffList.statusCode).toBe(200);
    const staff = staffList.json().data.staff as Array<{ email: string; roles: string[] }>;
    expect(staff.some((row) => row.email === staffEmail)).toBe(true);

    await app.close();
  });
});
