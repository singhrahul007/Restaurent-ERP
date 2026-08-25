import type { preHandlerAsyncHookHandler } from "fastify";
import type { ApiEnv } from "@niva/config";
import { errorEnvelope } from "../../lib/envelope.js";
import { ACCESS_COOKIE, verifyAccessToken } from "./auth.cookies.js";
import type { AuthRepository } from "./auth.repository.js";
import type { TenancyRepository } from "../tenancy/tenancy.repository.js";

export type AuthUser = {
  id: string;
  email: string;
  status: "PENDING_VERIFICATION" | "ACTIVE" | "DISABLED";
  isPlatformAdmin: boolean;
};

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

const UNAUTHORIZED = errorEnvelope("UNAUTHORIZED", "Unauthorized");
const ACCESS_EXPIRED = errorEnvelope("UNAUTHORIZED", "Access token expired");

export function createRequireAuth(
  env: ApiEnv,
  repository: AuthRepository,
  tenancy?: TenancyRepository,
): preHandlerAsyncHookHandler {
  return async function requireAuth(request, reply) {
    const verified = await verifyAccessToken(env, request.cookies[ACCESS_COOKIE]);
    if (!verified.ok) {
      const body = verified.reason === "expired" ? ACCESS_EXPIRED : UNAUTHORIZED;
      return reply.status(401).send(body);
    }

    const user = await repository.findUserById(verified.userId);
    if (!user || user.status === "DISABLED") {
      return reply.status(401).send(UNAUTHORIZED);
    }

    request.authUser = user;
    request.permissions = tenancy
      ? await tenancy.loadPermissionCodes(user.id, undefined, user.isPlatformAdmin)
      : new Set();
  };
}
