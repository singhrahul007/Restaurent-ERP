import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { errorEnvelope } from "./app.js";

describe("error envelope", () => {
  it("returns the standard error shape", () => {
    expect(errorEnvelope("NOT_FOUND", "Not found")).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Not found" },
    });
  });

  it("404 handler shape matches the envelope", async () => {
    const app = Fastify();
    app.setNotFoundHandler((_request, reply) => {
      reply.status(404).send(errorEnvelope("NOT_FOUND", "Not found"));
    });
    const response = await app.inject({ method: "GET", url: "/missing" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Not found" },
    });
    await app.close();
  });
});
