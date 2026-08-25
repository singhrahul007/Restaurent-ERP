import { eq } from "drizzle-orm";
import { ORG_PERMISSION_CODES } from "@niva/auth";
import { parseApiEnv } from "@niva/config";
import { createDatabase, users } from "@niva/database";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import {
  ACCESS_COOKIE,
  ORGANIZATION_COOKIE,
} from "../auth/auth.cookies.js";

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

describe.skipIf(!hasDatabase)("tenant isolation", () => {
  const env = parseApiEnv({ ...process.env, NODE_ENV: "test" });
  const { sql, db } = createDatabase(env.DATABASE_URL);
  const suffix = Date.now();
  const ownerA = `a-${suffix}@example.com`;
  const ownerB = `b-${suffix}@example.com`;
  const staffA = `staff-${suffix}@example.com`;
  const password = "longenough1";

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, ownerA));
    await db.delete(users).where(eq(users.email, ownerB));
    await db.delete(users).where(eq(users.email, staffA));
    await sql.end();
  });

  it("isolates orgs, loads owner permissions, and hides cross-tenant restaurants", async () => {
    const app = await buildApp({ env, sql, db });

    for (const email of [ownerA, ownerB, staffA]) {
      const created = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: { email, password },
      });
      expect(created.statusCode).toBe(201);
    }

    async function login(email: string) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password },
      });
      expect(response.statusCode).toBe(200);
      return cookieHeader(response.cookies, [ACCESS_COOKIE]);
    }

    const cookieA = await login(ownerA);
    const cookieB = await login(ownerB);

    const orgA1 = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      headers: { cookie: cookieA },
      payload: { name: "Org A1" },
    });
    expect(orgA1.statusCode).toBe(201);
    const orgA1Id = orgA1.json().data.id as string;
    expect(
      orgA1.cookies.some((cookie) => cookie.name === ORGANIZATION_COOKIE),
    ).toBe(true);

    const orgA2 = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      headers: { cookie: cookieA },
      payload: { name: "Org A2" },
    });
    expect(orgA2.statusCode).toBe(201);
    const orgA2Id = orgA2.json().data.id as string;
    expect(orgA2Id).not.toBe(orgA1Id);

    const orgB = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      headers: { cookie: cookieB },
      payload: { name: "Org B" },
    });
    expect(orgB.statusCode).toBe(201);
    const orgBId = orgB.json().data.id as string;

    const meA = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        cookie: `${cookieA}; ${ORGANIZATION_COOKIE}=${orgA1Id}`,
        "x-organization-id": orgA1Id,
      },
    });
    expect(meA.statusCode).toBe(200);
    expect(meA.json().data.memberships).toHaveLength(2);
    const permissions = meA.json().data.permissions as string[];
    expect(permissions).toEqual(expect.arrayContaining([...ORG_PERMISSION_CODES]));
    expect(permissions).not.toContain("platform.manage");

    const restaurantA = await app.inject({
      method: "POST",
      url: "/api/v1/restaurants",
      headers: { cookie: cookieA, "x-organization-id": orgA1Id },
      payload: { name: "Cafe A" },
    });
    expect(restaurantA.statusCode).toBe(201);
    const restaurantAId = restaurantA.json().data.id as string;

    const restaurantB = await app.inject({
      method: "POST",
      url: "/api/v1/restaurants",
      headers: { cookie: cookieB, "x-organization-id": orgBId },
      payload: { name: "Cafe B" },
    });
    expect(restaurantB.statusCode).toBe(201);
    const restaurantBId = restaurantB.json().data.id as string;

    const leakGet = await app.inject({
      method: "GET",
      url: `/api/v1/restaurants/${restaurantBId}`,
      headers: { cookie: cookieA, "x-organization-id": orgA1Id },
    });
    expect(leakGet.statusCode).toBe(404);
    expect(leakGet.json().error.code).toBe("NOT_FOUND");

    const leakList = await app.inject({
      method: "GET",
      url: "/api/v1/restaurants",
      headers: { cookie: cookieA, "x-organization-id": orgA1Id },
    });
    expect(leakList.statusCode).toBe(200);
    const listed = leakList.json().data.restaurants as Array<{ id: string }>;
    expect(listed.map((row) => row.id)).toEqual([restaurantAId]);

    const wrongOrgHeader = await app.inject({
      method: "GET",
      url: "/api/v1/restaurants",
      headers: { cookie: cookieA, "x-organization-id": orgBId },
    });
    expect(wrongOrgHeader.statusCode).toBe(403);
    expect(wrongOrgHeader.json().error.code).toBe("TENANT_MISMATCH");

    const branchA = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantAId}/branches`,
      headers: { cookie: cookieA, "x-organization-id": orgA1Id },
      payload: { name: "Downtown" },
    });
    expect(branchA.statusCode).toBe(201);
    const branchAId = branchA.json().data.id as string;

    const branchA2 = await app.inject({
      method: "POST",
      url: `/api/v1/restaurants/${restaurantAId}/branches`,
      headers: { cookie: cookieA, "x-organization-id": orgA1Id },
      payload: { name: "Uptown" },
    });
    expect(branchA2.statusCode).toBe(201);
    const branchA2Id = branchA2.json().data.id as string;

    const memberships = meA.json().data.memberships as Array<{
      id: string;
      organizationId: string;
    }>;
    const membershipA1 = memberships.find((item) => item.organizationId === orgA1Id);
    expect(membershipA1).toBeTruthy();

    const assignSelf = await app.inject({
      method: "POST",
      url: `/api/v1/branches/${branchAId}/assignments`,
      headers: { cookie: cookieA, "x-organization-id": orgA1Id },
      payload: { membershipId: membershipA1!.id },
    });
    expect(assignSelf.statusCode).toBe(201);

    const otherBranch = await app.inject({
      method: "GET",
      url: `/api/v1/branches/${branchA2Id}`,
      headers: {
        cookie: cookieA,
        "x-organization-id": orgA1Id,
        "x-branch-id": branchA2Id,
      },
    });
    expect(otherBranch.statusCode).toBe(403);
    expect(otherBranch.json().error.code).toBe("TENANT_MISMATCH");

    const hiddenBranch = await app.inject({
      method: "GET",
      url: `/api/v1/branches/${branchA2Id}`,
      headers: { cookie: cookieA, "x-organization-id": orgA1Id },
    });
    expect(hiddenBranch.statusCode).toBe(404);

    const ownerPlatform = await app.inject({
      method: "GET",
      url: "/api/v1/platform/organizations",
      headers: { cookie: cookieA },
    });
    expect(ownerPlatform.statusCode).toBe(403);
    expect(ownerPlatform.json().error.code).toBe("FORBIDDEN");

    const ownerPing = await app.inject({
      method: "GET",
      url: "/api/v1/platform/ping",
      headers: { cookie: cookieA },
    });
    expect(ownerPing.statusCode).toBe(403);

    await app.close();
  });
});
