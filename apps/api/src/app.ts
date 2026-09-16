import type { IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import Fastify, {
  type FastifyError,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { ApiEnv } from "@niva/config";
import { logRedactPaths } from "@niva/config";
import { pingDatabase, type Database } from "@niva/database";
import type { Sql } from "postgres";
import { errorEnvelope } from "./lib/envelope.js";
import { isAppError } from "./lib/errors.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { organizationRoutes } from "./modules/organizations/organizations.routes.js";
import { platformRoutes } from "./modules/platform/platform.routes.js";
import { kitchenRoutes } from "./modules/kitchen/kitchen.routes.js";
import { menuRoutes } from "./modules/menu/menu.routes.js";
import { orderRoutes } from "./modules/orders/orders.routes.js";
import { restaurantRoutes } from "./modules/restaurants/restaurants.routes.js";
import { inventoryRoutes } from "./modules/inventory/inventory.routes.js";
import { staffRoutes } from "./modules/staff/staff.routes.js";

export { errorEnvelope } from "./lib/envelope.js";

export type BuildAppOptions = {
  env: ApiEnv;
  sql: Sql;
  db: Database;
};

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({
    logger: {
      name: "api",
      level: options.env.LOG_LEVEL,
      redact: {
        paths: [...logRedactPaths],
        censor: "[Redacted]",
      },
    },
    disableRequestLogging: false,
    requestIdHeader: "x-request-id",
    genReqId: (req: IncomingMessage) =>
      (req.headers["x-request-id"] as string | undefined) ?? randomUUID(),
    bodyLimit: 1_048_576,
  });

  app.addHook("onRequest", async (request) => {
    request.requestId = request.id;
  });

  const origins = options.env.CORS_ORIGINS.split(",").map((item) => item.trim());

  await app.register(helmet, { global: true });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(cors, {
    origin: origins,
    credentials: true,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Niva API",
        version: "0.0.0",
      },
      tags: [
        { name: "auth", description: "Identity, sessions, and password recovery" },
        { name: "tenancy", description: "Organizations, restaurants, and branches" },
        { name: "menu", description: "Tax classes, categories, items, and modifiers" },
        { name: "orders", description: "POS orders, payments, and coupons" },
        { name: "kitchen", description: "Kitchen display tickets" },
        { name: "inventory", description: "Units, stock, suppliers, and purchase orders" },
        { name: "platform", description: "Platform administration" },
        { name: "system", description: "Health and readiness" },
      ],
      components: {
        securitySchemes: {
          accessCookie: {
            type: "apiKey",
            in: "cookie",
            name: "niva_access",
          },
        },
      },
      servers: [{ url: "/api/v1" }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/api/v1/docs",
  });

  app.get(
    "/health",
    {
      schema: {
        tags: ["system"],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object" },
              meta: { type: "object" },
            },
          },
        },
      },
    },
    async (request) => ({
      success: true as const,
      data: { status: "ok" },
      meta: { requestId: request.id },
    }),
  );

  app.get("/ready", async (request, reply) => {
    try {
      await pingDatabase(options.sql);
      return {
        success: true as const,
        data: { status: "ready" },
        meta: { requestId: request.id },
      };
    } catch {
      reply.status(503);
      return errorEnvelope("NOT_READY", "Database unavailable");
    }
  });

  app.get("/api/v1", async (request) => ({
    success: true as const,
    data: { name: "niva-api", version: "v1" },
    meta: { requestId: request.id },
  }));

  await app.register(authRoutes, {
    prefix: "/api/v1/auth",
    db: options.db,
    env: options.env,
  });
  await app.register(organizationRoutes, {
    prefix: "/api/v1",
    db: options.db,
    env: options.env,
  });
  await app.register(restaurantRoutes, {
    prefix: "/api/v1",
    db: options.db,
    env: options.env,
  });
  await app.register(staffRoutes, {
    prefix: "/api/v1",
    db: options.db,
    env: options.env,
  });
  await app.register(menuRoutes, {
    prefix: "/api/v1",
    db: options.db,
    env: options.env,
  });
  await app.register(orderRoutes, {
    prefix: "/api/v1",
    db: options.db,
    env: options.env,
  });
  await app.register(kitchenRoutes, {
    prefix: "/api/v1",
    db: options.db,
    env: options.env,
  });
  await app.register(inventoryRoutes, {
    prefix: "/api/v1",
    db: options.db,
    env: options.env,
  });
  await app.register(platformRoutes, {
    prefix: "/api/v1/platform",
    db: options.db,
    env: options.env,
  });

  app.setNotFoundHandler((_request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send(errorEnvelope("NOT_FOUND", "Not found"));
  });

  app.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      if (isAppError(error)) {
        return reply
          .status(error.statusCode)
          .send(errorEnvelope(error.code, error.message));
      }
      request.log.error({ err: error, requestId: request.id }, "unhandled error");
      const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
      const code = status === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR";
      const message = status === 500 ? "Internal server error" : error.message;
      reply.status(status).send(errorEnvelope(code, message));
    },
  );

  app.decorate("db", options.db);

  return app;
}
