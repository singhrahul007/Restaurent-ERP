import type { preHandlerAsyncHookHandler } from "fastify";
import {
  emptyPermissionSet,
  hasPermission,
  type PermissionCode,
} from "@niva/auth";
import { errorEnvelope } from "./envelope.js";

declare module "fastify" {
  interface FastifyRequest {
    permissions?: ReadonlySet<PermissionCode>;
  }
}

const FORBIDDEN = errorEnvelope("FORBIDDEN", "Forbidden");

/** Fallback when no permission set was attached to the request. */
export function loadPermissions(): Set<PermissionCode> {
  return emptyPermissionSet();
}

export function isAuthApiPath(url: string): boolean {
  const path = url.split("?")[0] ?? "";
  return (
    path === "/auth" ||
    path.startsWith("/auth/") ||
    path === "/api/v1/auth" ||
    path.startsWith("/api/v1/auth/")
  );
}

export function requirePermission(
  code: PermissionCode,
): preHandlerAsyncHookHandler {
  return requireAnyPermission(code);
}

export function requireAnyPermission(
  ...codes: PermissionCode[]
): preHandlerAsyncHookHandler {
  return async function requirePermissionHandler(request, reply) {
    if (isAuthApiPath(request.url)) {
      return;
    }

    const granted = request.permissions ?? loadPermissions();
    if (!codes.some((code) => hasPermission(granted, code))) {
      return reply.status(403).send(FORBIDDEN);
    }
  };
}
