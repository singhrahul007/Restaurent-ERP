import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import {
  isAuthApiPath,
  loadPermissions,
  requirePermission,
} from "./authorize.js";

describe("loadPermissions", () => {
  it("loads no permissions until memberships exist", () => {
    expect(loadPermissions().size).toBe(0);
  });
});

describe("isAuthApiPath", () => {
  it("matches auth routes including the v1 prefix", () => {
    expect(isAuthApiPath("/api/v1/auth/me")).toBe(true);
    expect(isAuthApiPath("/api/v1/auth/login?next=/pos")).toBe(true);
    expect(isAuthApiPath("/auth/logout")).toBe(true);
  });

  it("does not match other API routes", () => {
    expect(isAuthApiPath("/api/v1/orders")).toBe(false);
    expect(isAuthApiPath("/health")).toBe(false);
    expect(isAuthApiPath("/author")).toBe(false);
  });
});

describe("requirePermission", () => {
  it("returns 403 FORBIDDEN when the in-memory set does not grant the code", async () => {
    const app = Fastify();
    app.get(
      "/api/v1/orders",
      { preHandler: requirePermission("orders.create") },
      async () => ({ ok: true }),
    );

    const response = await app.inject({ method: "GET", url: "/api/v1/orders" });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      success: false,
      error: { code: "FORBIDDEN", message: "Forbidden" },
    });
    await app.close();
  });

  it("allows the request when the permission is present", async () => {
    const app = Fastify();
    app.get(
      "/api/v1/orders",
      {
        preHandler: [
          async (request) => {
            request.permissions = new Set(["orders.create"]);
          },
          requirePermission("orders.create"),
        ],
      },
      async () => ({ ok: true }),
    );

    const response = await app.inject({ method: "GET", url: "/api/v1/orders" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    await app.close();
  });

  it("skips the check for /auth/* even when the set is empty", async () => {
    const app = Fastify();
    app.get(
      "/api/v1/auth/me",
      { preHandler: requirePermission("orders.create") },
      async () => ({ ok: true }),
    );

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    await app.close();
  });
});
