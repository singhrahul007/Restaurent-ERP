import type { FastifyPluginAsync } from "fastify";
import type { ApiEnv } from "@niva/config";
import type { Database } from "@niva/database";
import { requirePermission } from "../../lib/authorize.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { createAuthRepository } from "../auth/auth.repository.js";
import { createTenancyRepository } from "../tenancy/tenancy.repository.js";

import { and, eq, inArray } from "drizzle-orm";
import {
  branchAssignments,
  branches,
  membershipRoles,
  memberships,
  organizations,
  permissions,
  restaurants,
  rolePermissions,
  roles,
  users,
} from "@niva/database";
import {
  PERMISSION_CODES,
  SYSTEM_ROLE_PERMISSIONS,
  type PermissionCode,
} from "@niva/auth";

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

  // 1. Get all roles and their granted permissions
  app.get(
    "/roles",
    { schema: { tags: ["platform"] }, preHandler: platformOnly },
    async (request) => {
      const allRoles = await opts.db
        .select({
          id: roles.id,
          slug: roles.slug,
          name: roles.name,
          isSystem: roles.isSystem,
        })
        .from(roles);

      const allPerms = await opts.db
        .select({
          roleId: rolePermissions.roleId,
          code: permissions.code,
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId));

      const rolePermMap = new Map<string, string[]>();
      for (const item of allPerms) {
        const list = rolePermMap.get(item.roleId) ?? [];
        list.push(item.code);
        rolePermMap.set(item.roleId, list);
      }

      const results = allRoles.map((r) => ({
        ...r,
        permissions: rolePermMap.get(r.id) ?? [],
      }));

      return {
        success: true,
        data: { roles: results, allPermissionCodes: PERMISSION_CODES },
        meta: { requestId: request.id },
      };
    },
  );

  // 2. Update permissions for a role
  app.put<{
    Params: { roleId: string };
    Body: { permissions: string[] };
  }>(
    "/roles/:roleId/permissions",
    { schema: { tags: ["platform"] }, preHandler: platformOnly },
    async (request, reply) => {
      const { roleId } = request.params;
      const { permissions: newPermCodes } = request.body;

      const [targetRole] = await opts.db
        .select()
        .from(roles)
        .where(eq(roles.id, roleId))
        .limit(1);

      if (!targetRole) {
        reply.status(404);
        return { success: false, error: { message: "Role not found" } };
      }

      // Find matching permissions
      const dbPerms = await opts.db
        .select({ id: permissions.id, code: permissions.code })
        .from(permissions)
        .where(inArray(permissions.code, newPermCodes as PermissionCode[]));

      // Remove existing permissions
      await opts.db
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId));

      // Insert new permissions
      if (dbPerms.length > 0) {
        await opts.db.insert(rolePermissions).values(
          dbPerms.map((p) => ({
            roleId,
            permissionId: p.id,
          })),
        );
      }

      return {
        success: true,
        data: {
          roleId,
          permissions: dbPerms.map((p) => p.code),
        },
        meta: { requestId: request.id },
      };
    },
  );

  // 3. Get all restaurants, branches, and user assignments for Access Control Studio
  app.get(
    "/access-control/directory",
    { schema: { tags: ["platform"] }, preHandler: platformOnly },
    async (request) => {
      const restList = await opts.db
        .select({
          id: restaurants.id,
          name: restaurants.name,
          organizationId: restaurants.organizationId,
        })
        .from(restaurants);

      const branchList = await opts.db
        .select({
          id: branches.id,
          name: branches.name,
          restaurantId: branches.restaurantId,
          organizationId: branches.organizationId,
        })
        .from(branches);

      const userMemberships = await opts.db
        .select({
          userId: users.id,
          email: users.email,
          membershipId: memberships.id,
          organizationId: memberships.organizationId,
          isOwner: memberships.isOwner,
          roleId: roles.id,
          roleSlug: roles.slug,
          roleName: roles.name,
        })
        .from(users)
        .innerJoin(memberships, eq(memberships.userId, users.id))
        .leftJoin(membershipRoles, eq(membershipRoles.membershipId, memberships.id))
        .leftJoin(roles, eq(roles.id, membershipRoles.roleId));

      const assignments = await opts.db
        .select({
          membershipId: branchAssignments.membershipId,
          branchId: branchAssignments.branchId,
        })
        .from(branchAssignments);

      const branchAssignMap = new Map<string, string[]>();
      for (const a of assignments) {
        const list = branchAssignMap.get(a.membershipId) ?? [];
        list.push(a.branchId);
        branchAssignMap.set(a.membershipId, list);
      }

      const usersWithScope = userMemberships.map((u) => ({
        ...u,
        assignedBranchIds: branchAssignMap.get(u.membershipId) ?? [],
      }));

      return {
        success: true,
        data: {
          restaurants: restList,
          branches: branchList,
          members: usersWithScope,
        },
        meta: { requestId: request.id },
      };
    },
  );

  // 4. Assign or unassign branches to a user's membership
  app.post<{
    Body: {
      membershipId: string;
      organizationId: string;
      branchIds: string[];
    };
  }>(
    "/access-control/assign-branches",
    { schema: { tags: ["platform"] }, preHandler: platformOnly },
    async (request) => {
      const { membershipId, organizationId, branchIds } = request.body;

      // Delete existing branch assignments for this membership
      await opts.db
        .delete(branchAssignments)
        .where(eq(branchAssignments.membershipId, membershipId));

      // Re-insert selected branches
      if (branchIds && branchIds.length > 0) {
        await opts.db.insert(branchAssignments).values(
          branchIds.map((branchId) => ({
            organizationId,
            membershipId,
            branchId,
          })),
        );
      }

      return {
        success: true,
        data: { membershipId, assignedBranchIds: branchIds },
        meta: { requestId: request.id },
      };
    },
  );
};
