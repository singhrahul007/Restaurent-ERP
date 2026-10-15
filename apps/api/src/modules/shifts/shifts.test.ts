import { eq } from "drizzle-orm";
import { parseApiEnv } from "@niva/config";
import { createDatabase, diningTables, posShifts, users } from "@niva/database";
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

describe.skipIf(!hasDatabase)("shifts and reservations", () => {
  const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const email = `petpooja-owner-${Date.now()}@example.com`;
  const password = "longenough1";

  afterAll(async () => {
    const owner = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (owner) {
      await db.delete(posShifts).where(eq(posShifts.cashierId, owner.id));
    }
    await db.delete(users).where(eq(users.email, email));
    await sql.end();
  });

  it("handles shift open/close lifecycle and table reservation booking", async () => {
    const app = await buildApp({ env, sql, db });

    // 1. Register & setup owner
    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });
    expect(regRes.statusCode).toBe(201);

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);
    const authCookies = cookieHeader(loginRes.cookies, [ACCESS_COOKIE]);

    // 2. Create organization, restaurant, branch
    const orgRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      headers: { cookie: authCookies },
      payload: { name: "Petpooja Style Diner" },
    });
    expect(orgRes.statusCode).toBe(201);
    const orgId = JSON.parse(orgRes.body).data.id;

    const restRes = await app.inject({
      method: "POST",
      url: "/api/v1/restaurants",
      headers: { cookie: authCookies, "x-organization-id": orgId },
      payload: { name: "Diner Main Outlet" },
    });
    expect(restRes.statusCode).toBe(201);
    const restId = JSON.parse(restRes.body).data.id;

    const branchRes = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restId}/branches`,
      headers: { cookie: authCookies, "x-organization-id": orgId },
      payload: { name: "Downtown Branch" },
    });
    expect(branchRes.statusCode).toBe(201);
    const branchId = JSON.parse(branchRes.body).data.id;

    const tableRes = await app.inject({
      method: "POST",
      url: `/api/v1/branches/${branchId}/tables`,
      headers: { cookie: authCookies, "x-organization-id": orgId },
      payload: { code: "T-01", seats: 4 },
    });
    expect(tableRes.statusCode).toBe(201);
    const tableId = JSON.parse(tableRes.body).data.id;

    // 3. Test Shift Management (Open shift -> Active check -> Close shift with denomination variance)
    const openShiftRes = await app.inject({
      method: "POST",
      url: "/api/v1/shifts/open",
      headers: { cookie: authCookies, "x-organization-id": orgId },
      payload: {
        branchId,
        openingFloatMinor: 50000, // 500.00 opening float
        notes: "Morning shift start",
      },
    });
    expect(openShiftRes.statusCode).toBe(201);
    const shift = JSON.parse(openShiftRes.body).shift;
    expect(shift.status).toBe("OPEN");
    expect(shift.openingFloatMinor).toBe(50000);

    const activeShiftRes = await app.inject({
      method: "GET",
      url: `/api/v1/shifts/active?branchId=${branchId}`,
      headers: { cookie: authCookies, "x-organization-id": orgId },
    });
    expect(activeShiftRes.statusCode).toBe(200);
    expect(JSON.parse(activeShiftRes.body).shift.id).toBe(shift.id);

    const closeShiftRes = await app.inject({
      method: "POST",
      url: `/api/v1/shifts/${shift.id}/close`,
      headers: { cookie: authCookies, "x-organization-id": orgId },
      payload: {
        actualCashMinor: 49500, // 5.00 shortage
        denominationCounts: { "500": 9, "200": 2, "50": 1 },
        notes: "Shift closed with 5.00 variance",
      },
    });
    expect(closeShiftRes.statusCode).toBe(200);
    const closed = JSON.parse(closeShiftRes.body).shift;
    expect(closed.status).toBe("CLOSED");
    expect(closed.cashDiscrepancyMinor).toBe(-500);

    // 4. Test Table Reservation Manager (Create reservation -> List -> Patch status to SEATED)
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/reservations",
      headers: { cookie: authCookies, "x-organization-id": orgId },
      payload: {
        branchId,
        guestName: "Vikram Malhotra",
        guestPhone: "+919876543210",
        partySize: 4,
        reservationTime: futureDate,
        tableId,
        specialRequests: "Window seat preferred",
      },
    });
    expect(createRes.statusCode).toBe(201);
    const reservation = JSON.parse(createRes.body).reservation;
    expect(reservation.guestName).toBe("Vikram Malhotra");
    expect(reservation.status).toBe("CONFIRMED");

    const listRes = await app.inject({
      method: "GET",
      url: `/api/v1/reservations?branchId=${branchId}`,
      headers: { cookie: authCookies, "x-organization-id": orgId },
    });
    expect(listRes.statusCode).toBe(200);
    expect(JSON.parse(listRes.body).reservations.length).toBeGreaterThanOrEqual(1);

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/reservations/${reservation.id}`,
      headers: { cookie: authCookies, "x-organization-id": orgId },
      payload: {
        status: "SEATED",
      },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(JSON.parse(patchRes.body).reservation.status).toBe("SEATED");

    // 5. Test QSR Token Calling Screen endpoint
    const tokensRes = await app.inject({
      method: "GET",
      url: `/api/v1/branches/${branchId}/tokens`,
    });
    expect(tokensRes.statusCode).toBe(200);
    const tokensData = JSON.parse(tokensRes.body).data;
    expect(Array.isArray(tokensData.preparing)).toBe(true);
    expect(Array.isArray(tokensData.ready)).toBe(true);
  });
});
