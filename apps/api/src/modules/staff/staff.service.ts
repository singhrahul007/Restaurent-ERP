import { randomBytes } from "node:crypto";
import {
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@niva/auth";
import { writeAudit, type Database } from "@niva/database";
import { AppError } from "../../lib/errors.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { StaffRepository } from "./staff.repository.js";

const ASSIGNABLE_ROLES = SYSTEM_ROLE_SLUGS.filter(
  (slug) => slug !== "SUPER_ADMIN",
) as SystemRoleSlug[];

function assertAssignableRole(
  slug: string,
  actorIsOwner: boolean,
): asserts slug is SystemRoleSlug {
  if (slug === "SUPER_ADMIN" || slug === "platform.manage") {
    throw new AppError("FORBIDDEN", "Cannot grant platform access", 403);
  }
  if (!ASSIGNABLE_ROLES.includes(slug as SystemRoleSlug)) {
    throw new AppError("VALIDATION_ERROR", "Unknown role", 400);
  }
  if (slug === "RESTAURANT_OWNER" && !actorIsOwner) {
    throw new AppError("FORBIDDEN", "Only an owner can assign the owner role", 403);
  }
}

export function createStaffService(
  db: Database,
  staff: StaffRepository,
  auth: AuthRepository,
) {
  return {
    list(tenant: TenantContext) {
      return staff.listStaff(tenant.organizationId);
    },

    async invite(
      tenant: TenantContext,
      actorId: string,
      input: { email: string; roleSlug: string; branchIds: string[] },
      context: { ip?: string | null; userAgent?: string | null },
    ) {
      assertAssignableRole(input.roleSlug, tenant.isOwner);
      const role = await staff.findRoleBySlug(input.roleSlug);
      if (!role) {
        throw new AppError("VALIDATION_ERROR", "Unknown role", 400);
      }

      for (const branchId of input.branchIds) {
        const ok = await staff.branchInOrganization(branchId, tenant.organizationId);
        if (!ok) {
          throw new AppError("NOT_FOUND", "Not found", 404);
        }
      }

      let user = await staff.findUserByEmail(input.email);
      let createdUser = false;
      if (!user) {
        createdUser = true;
        user = await staff.insertUser(
          input.email,
          await hashPassword(randomBytes(32).toString("hex")),
        );
      }

      let membership = await staff.findMembership(user.id, tenant.organizationId);
      if (!membership) {
        membership = await staff.insertMembership({
          userId: user.id,
          organizationId: tenant.organizationId,
          isOwner: input.roleSlug === "RESTAURANT_OWNER",
        });
      } else if (membership.isOwner && input.roleSlug !== "RESTAURANT_OWNER" && !tenant.isOwner) {
        throw new AppError("FORBIDDEN", "Cannot change an owner membership", 403);
      }

      await staff.replaceMembershipRole(membership.id, role.id);
      await staff.replaceBranchAssignments({
        organizationId: tenant.organizationId,
        membershipId: membership.id,
        branchIds: input.branchIds,
      });

      await writeAudit(db, {
        actorId,
        organizationId: tenant.organizationId,
        action: "ROLE_CHANGED",
        resourceType: "membership",
        resourceId: membership.id,
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: {
          email: user.email,
          roleSlug: input.roleSlug,
          branchIds: input.branchIds,
        },
      });

      let inviteToken: string | undefined;
      if (createdUser) {
        const token = generateOpaqueToken();
        await auth.insertPasswordReset({
          userId: user.id,
          tokenHash: hashOpaqueToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });
        inviteToken = token;
      }

      return {
        membershipId: membership.id,
        userId: user.id,
        email: user.email,
        roleSlug: input.roleSlug,
        branchIds: input.branchIds,
        inviteToken,
      };
    },

    async update(
      tenant: TenantContext,
      actorId: string,
      membershipId: string,
      patch: { roleSlug?: string; branchIds?: string[] },
      context: { ip?: string | null; userAgent?: string | null },
    ) {
      const membership = await staff.findMembershipById(
        membershipId,
        tenant.organizationId,
      );
      if (!membership) {
        throw new AppError("NOT_FOUND", "Not found", 404);
      }
      if (membership.isOwner && !tenant.isOwner) {
        throw new AppError("FORBIDDEN", "Cannot change an owner membership", 403);
      }

      if (patch.roleSlug) {
        assertAssignableRole(patch.roleSlug, tenant.isOwner);
        const role = await staff.findRoleBySlug(patch.roleSlug);
        if (!role) {
          throw new AppError("VALIDATION_ERROR", "Unknown role", 400);
        }
        await staff.replaceMembershipRole(membership.id, role.id);
        await writeAudit(db, {
          actorId,
          organizationId: tenant.organizationId,
          action: "ROLE_CHANGED",
          resourceType: "membership",
          resourceId: membership.id,
          ip: context.ip,
          userAgent: context.userAgent,
          metadata: { roleSlug: patch.roleSlug },
        });
      }

      if (patch.branchIds) {
        for (const branchId of patch.branchIds) {
          const ok = await staff.branchInOrganization(branchId, tenant.organizationId);
          if (!ok) {
            throw new AppError("NOT_FOUND", "Not found", 404);
          }
        }
        await staff.replaceBranchAssignments({
          organizationId: tenant.organizationId,
          membershipId: membership.id,
          branchIds: patch.branchIds,
        });
      }

      const [row] = (await staff.listStaff(tenant.organizationId)).filter(
        (item) => item.id === membershipId,
      );
      return row ?? null;
    },
  };
}

export type StaffService = ReturnType<typeof createStaffService>;
