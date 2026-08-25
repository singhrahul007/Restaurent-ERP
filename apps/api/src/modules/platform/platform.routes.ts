import type { FastifyPluginAsync } from "fastify";
import type { ApiEnv } from "@niva/config";
import type { Database } from "@niva/database";
import { requirePermission } from "../../lib/authorize.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { createAuthRepository } from "../auth/auth.repository.js";
import { createTenancyRepository } from "../tenancy/tenancy.repository.js";

export const platformRoutes: FastifyPluginAsync<{
  db: Database;
  env: ApiEnv;
}> = async (app, opts) => {
  const tenancy = createTenancyRepository(opts.db);
  const requireAuth = createRequireAuth(
    opts.env,
    createAuthRepository(opts.db),
    tenancy,
  );
  const platformOnly = [requireAuth, requirePermission("platform.manage")];

  app.get(
    "/ping",
    { schema: { tags: ["platform"] }, preHandler: platformOnly },
    async (request) => ({
      success: true,
      data: { ok: true },
      meta: { requestId: request.id },
    }),
  );

  app.get(
    "/organizations",
    { schema: { tags: ["platform"] }, preHandler: platformOnly },
    async (request) => ({
      success: true,
      data: { organizations: await tenancy.listOrganizations() },
      meta: { requestId: request.id },
    }),
  );
};
