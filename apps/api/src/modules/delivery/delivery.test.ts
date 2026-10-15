import { eq } from "drizzle-orm";
import { parseApiEnv } from "@niva/config";
import { createDatabase, deliveries, deliveryAgents, users } from "@niva/database";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { ACCESS_COOKIE } from "../auth/auth.cookies.js";
import { deliveryPayloadHasOtp } from "./delivery.public.js";

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

describe.skipIf(!hasDatabase)("delivery", () => {
  const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const ownerEmail = `dlv-owner-${Date.now()}@example.com`;
  const agentEmail = `dlv-agent-${Date.now()}@example.com`;
  const otherEmail = `dlv-other-${Date.now()}@example.com`;
  const password = "longenough1";

  afterAll(async () => {
    const agentUser = await db.query.users.findFirst({
      where: eq(users.email, agentEmail),
    });
    if (agentUser) {
      const agent = await db.query.deliveryAgents.findFirst({
        where: eq(deliveryAgents.userId, agentUser.id),
      });
      if (agent) {
        await db.delete(deliveries).where(eq(deliveries.agentId, agent.id));
      }
      await db.delete(deliveryAgents).where(eq(deliveryAgents.userId, agentUser.id));
    }
    await db.delete(users).where(eq(users.email, ownerEmail));
    await db.delete(users).where(eq(users.email, agentEmail));
    await db.delete(users).where(eq(users.email, otherEmail));
    await sql.end();
  });

  it("assigns in-org only, hides OTP on GET, tracks COD integers, and scopes jobs to the agent", async () => {
    const app = await buildApp({ env, sql, db });
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: ownerEmail, password },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: agentEmail, password },
    });
    const ownerLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: ownerEmail, password },
    });
    const ownerCookie = cookieHeader(ownerLogin.cookies, [ACCESS_COOKIE]);
    const org = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      headers: { cookie: ownerCookie },
      payload: { name: "Delivery Org" },
    });
    const orgId = org.json().data.id as string;
    const ownerHeaders = { cookie: ownerCookie, "x-organization-id": orgId };

    const restaurant = await app.inject({
      method: "POST",
      url: "/api/v1/restaurants",
      headers: ownerHeaders,
      payload: { name: "Delivery Cafe" },
    });
    const restaurantId = restaurant.json().data.id as string;
    const branch = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/branches`,
      headers: ownerHeaders,
      payload: { name: "Main" },
    });
    const branchId = branch.json().data.id as string;
    const tax = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/tax-classes`,
      headers: ownerHeaders,
      payload: { name: "GST 18", rateBps: 1800, cgstBps: 900, sgstBps: 900 },
    });
    const category = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/menu/categories`,
      headers: ownerHeaders,
      payload: { name: "Mains" },
    });
    const item = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantId}/menu/items`,
      headers: ownerHeaders,
      payload: {
        name: "Biryani",
        categoryId: category.json().data.id,
        taxClassId: tax.json().data.id,
        basePriceMinor: 25000,
      },
    });

    const invite = await app.inject({
      method: "POST",
      url: "/api/v1/staff/invites",
      headers: ownerHeaders,
      payload: {
        email: agentEmail,
        roleSlug: "DELIVERY_AGENT",
        branchIds: [branchId],
      },
    });
    expect(invite.statusCode).toBe(201);
    const agentUserId = invite.json().data.userId as string;

    const agentLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: agentEmail, password },
    });
    const agentHeaders = {
      cookie: cookieHeader(agentLogin.cookies, [ACCESS_COOKIE]),
      "x-organization-id": orgId,
    };
    const online = await app.inject({
      method: "POST",
      url: "/api/v1/delivery/me/shift",
      headers: agentHeaders,
      payload: { online: true },
    });
    expect(online.statusCode).toBe(200);
    expect(online.json().data.online).toBe(true);

    const order = await app.inject({
      method: "POST",
      url: `/api/v1/branches/${branchId}/orders`,
      headers: ownerHeaders,
      payload: {
        type: "DELIVERY",
        items: [{ menuItemId: item.json().data.id, qty: 1, modifierIds: [] }],
      },
    });
    expect(order.statusCode).toBe(201);
    const orderId = order.json().data.id as string;

    const otherOrg = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      headers: { cookie: ownerCookie },
      payload: { name: "Other Org" },
    });
    const leakAssign = await app.inject({
      method: "POST",
      url: "/api/v1/deliveries",
      headers: { cookie: ownerCookie, "x-organization-id": otherOrg.json().data.id },
      payload: {
        orderId,
        agentUserId,
        addressLine: "1 Other Street",
        codAmountMinor: 25000,
      },
    });
    expect(leakAssign.statusCode).toBe(404);

    const assigned = await app.inject({
      method: "POST",
      url: "/api/v1/deliveries",
      headers: ownerHeaders,
      payload: {
        orderId,
        agentUserId,
        addressLine: "12 MG Road, Bengaluru",
        phone: "9999999999",
        customerName: "Asha",
        codAmountMinor: 25000,
      },
    });
    expect(assigned.statusCode).toBe(201);
    const otp = assigned.json().data.otp as string;
    expect(otp).toMatch(/^\d{6}$/);
    expect(Number.isInteger(assigned.json().data.codAmountMinor)).toBe(true);
    const deliveryId = assigned.json().data.id as string;

    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/delivery/me/jobs",
      headers: agentHeaders,
    });
    expect(listed.statusCode).toBe(200);
    expect(deliveryPayloadHasOtp(listed.json().data)).toBe(false);
    expect(listed.json().data.deliveries).toHaveLength(1);
    expect(listed.json().data.deliveries[0].maps.google).toContain("google.com/maps");

    const got = await app.inject({
      method: "GET",
      url: `/api/v1/deliveries/${deliveryId}`,
      headers: agentHeaders,
    });
    expect(got.statusCode).toBe(200);
    expect(got.json().data.otp).toBeUndefined();
    expect(got.json().data.otpHash).toBeUndefined();

    const pickup = await app.inject({
      method: "POST",
      url: `/api/v1/deliveries/${deliveryId}/pickup`,
      headers: agentHeaders,
    });
    expect(pickup.statusCode).toBe(200);
    expect(pickup.json().data.status).toBe("PICKED_UP");

    const badOtp = await app.inject({
      method: "POST",
      url: `/api/v1/deliveries/${deliveryId}/confirm`,
      headers: agentHeaders,
      payload: { otp: "000000", codCollectedMinor: 25000 },
    });
    expect(badOtp.statusCode).toBe(400);

    const floatCod = await app.inject({
      method: "POST",
      url: `/api/v1/deliveries/${deliveryId}/confirm`,
      headers: agentHeaders,
      payload: { otp, codCollectedMinor: 12.5 },
    });
    expect(floatCod.statusCode).toBe(400);

    const confirmed = await app.inject({
      method: "POST",
      url: `/api/v1/deliveries/${deliveryId}/confirm`,
      headers: agentHeaders,
      payload: { otp, codCollectedMinor: 25000 },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().data.status).toBe("DELIVERED");
    expect(confirmed.json().data.codCollectedMinor).toBe(25000);

    const earnings = await app.inject({
      method: "GET",
      url: "/api/v1/delivery/me/earnings",
      headers: agentHeaders,
    });
    expect(earnings.statusCode).toBe(200);
    expect(earnings.json().data.count).toBe(1);
    expect(earnings.json().data.codCollectedMinor).toBe(25000);

    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: otherEmail, password },
    });
    const otherInvite = await app.inject({
      method: "POST",
      url: "/api/v1/staff/invites",
      headers: ownerHeaders,
      payload: {
        email: otherEmail,
        roleSlug: "DELIVERY_AGENT",
        branchIds: [branchId],
      },
    });
    expect(otherInvite.statusCode).toBe(201);
    const otherLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: otherEmail, password },
    });
    const otherHeaders = {
      cookie: cookieHeader(otherLogin.cookies, [ACCESS_COOKIE]),
      "x-organization-id": orgId,
    };
    const hidden = await app.inject({
      method: "GET",
      url: `/api/v1/deliveries/${deliveryId}`,
      headers: otherHeaders,
    });
    expect(hidden.statusCode).toBe(404);
    const otherJobs = await app.inject({
      method: "GET",
      url: "/api/v1/delivery/me/jobs",
      headers: otherHeaders,
    });
    expect(otherJobs.json().data.deliveries).toHaveLength(0);
    const otherEarn = await app.inject({
      method: "GET",
      url: "/api/v1/delivery/me/earnings",
      headers: otherHeaders,
    });
    expect(otherEarn.statusCode).toBe(200);
    expect(otherEarn.json().data.count).toBe(0);
    expect(otherEarn.json().data.codCollectedMinor).toBe(0);
  });
});
