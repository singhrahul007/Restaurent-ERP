import type { FastifyRequest, FastifyReply, preHandlerAsyncHookHandler } from "fastify";
import type { ApiEnv } from "@niva/config";
import { errorEnvelope } from "./envelope.js";
import type { TenancyRepository } from "../modules/tenancy/tenancy.repository.js";
import {
  ORGANIZATION_COOKIE,
  organizationCookieOptions,
} from "../modules/auth/auth.cookies.js";

export const ORGANIZATION_HEADER = "x-organization-id";
export const RESTAURANT_HEADER = "x-restaurant-id";
export const BRANCH_HEADER = "x-branch-id";

export type TenantContext = {
  organizationId: string;
  membershipId: string;
  isOwner: boolean;
  /** `null` means restaurant-wide (no branch assignments). */
  allowedBranchIds: string[] | null;
  restaurantId?: string;
  branchId?: string;
};

declare module "fastify" {
  interface FastifyRequest {
    tenant?: TenantContext;
    memberships?: Array<{
      id: string;
      organizationId: string;
      organizationName: string;
      isOwner: boolean;
      roles: string[];
    }>;
  }
}

function readHeader(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveRequestedOrganizationId(request: {
  headers: Record<string, string | string[] | undefined>;
  cookies: Record<string, string | undefined>;
}): string | undefined {
  return (
    readHeader(request.headers[ORGANIZATION_HEADER]) ??
    request.cookies[ORGANIZATION_COOKIE]
  );
}

export function setOrganizationCookie(
  reply: FastifyReply,
  env: ApiEnv,
  organizationId: string,
) {
  reply.setCookie(
    ORGANIZATION_COOKIE,
    organizationId,
    organizationCookieOptions(env),
  );
}

export function createRequireTenant(
  env: ApiEnv,
  tenancy: TenancyRepository,
): preHandlerAsyncHookHandler {
  return async function requireTenant(request, reply) {
    const user = request.authUser;
    if (!user) {
      return reply.status(401).send(errorEnvelope("UNAUTHORIZED", "Unauthorized"));
    }

    const memberships = await tenancy.listMemberships(user.id);
    request.memberships = memberships;

    let organizationId = resolveRequestedOrganizationId(request);
    if (!organizationId && memberships.length === 1) {
      organizationId = memberships[0]?.organizationId;
    }
    if (!organizationId) {
      return reply
        .status(400)
        .send(
          errorEnvelope(
            "TENANT_MISMATCH",
            "X-Organization-Id or organization cookie is required",
          ),
        );
    }

    const membership = memberships.find((item) => item.organizationId === organizationId);
    if (!membership) {
      return reply
        .status(403)
        .send(errorEnvelope("TENANT_MISMATCH", "Not a member of that organization"));
    }

    const assigned = await tenancy.listAssignedBranchIds(membership.id);
    const allowedBranchIds = assigned.length > 0 ? assigned : null;
    const branchId = readHeader(request.headers[BRANCH_HEADER]);
    if (branchId && allowedBranchIds && !allowedBranchIds.includes(branchId)) {
      return reply
        .status(403)
        .send(errorEnvelope("TENANT_MISMATCH", "Not assigned to that branch"));
    }

    request.tenant = {
      organizationId,
      membershipId: membership.id,
      isOwner: membership.isOwner,
      allowedBranchIds,
      restaurantId: readHeader(request.headers[RESTAURANT_HEADER]),
      branchId,
    };
    request.permissions = await tenancy.loadPermissionCodes(
      user.id,
      organizationId,
      user.isPlatformAdmin,
    );
    setOrganizationCookie(reply, env, organizationId);
  };
}

export async function attachOptionalTenant(
  request: FastifyRequest,
  tenancy: TenancyRepository,
) {
  const user = request.authUser;
  if (!user) {
    return;
  }
  const memberships = await tenancy.listMemberships(user.id);
  request.memberships = memberships;
  let organizationId = resolveRequestedOrganizationId(request);
  if (!organizationId && memberships.length === 1) {
    organizationId = memberships[0]?.organizationId;
  }
  const membership = organizationId
    ? memberships.find((item) => item.organizationId === organizationId)
    : undefined;
  request.permissions = await tenancy.loadPermissionCodes(
    user.id,
    membership?.organizationId,
    user.isPlatformAdmin,
  );
  if (membership && organizationId) {
    const assigned = await tenancy.listAssignedBranchIds(membership.id);
    request.tenant = {
      organizationId,
      membershipId: membership.id,
      isOwner: membership.isOwner,
      allowedBranchIds: assigned.length > 0 ? assigned : null,
    };
  }
}
