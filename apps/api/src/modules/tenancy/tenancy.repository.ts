import { and, eq } from "drizzle-orm";
import {
  ORG_PERMISSION_CODES,
  isPermissionCode,
  type PermissionCode,
} from "@niva/auth";
import {
  branchAssignments,
  membershipRoles,
  memberships,
  organizations,
  permissions,
  rolePermissions,
  roles,
  users,
  withOrganizationScope,
  type Database,
} from "@niva/database";

export type MembershipSummary = {
  id: string;
  organizationId: string;
  organizationName: string;
  isOwner: boolean;
  roles: string[];
};

export function createTenancyRepository(db: Database) {
  return {
    async listMemberships(userId: string): Promise<MembershipSummary[]> {
      const rows = await db
        .select({
          id: memberships.id,
          organizationId: memberships.organizationId,
          organizationName: organizations.name,
          isOwner: memberships.isOwner,
          roleSlug: roles.slug,
        })
        .from(memberships)
        .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
        .leftJoin(membershipRoles, eq(membershipRoles.membershipId, memberships.id))
        .leftJoin(roles, eq(roles.id, membershipRoles.roleId))
        .where(eq(memberships.userId, userId));

      const byId = new Map<string, MembershipSummary>();
      for (const row of rows) {
        const current = byId.get(row.id) ?? {
          id: row.id,
          organizationId: row.organizationId,
          organizationName: row.organizationName,
          isOwner: row.isOwner,
          roles: [],
        };
        if (row.roleSlug && !current.roles.includes(row.roleSlug)) {
          current.roles.push(row.roleSlug);
        }
        byId.set(row.id, current);
      }
      return [...byId.values()];
    },

    async findMembership(userId: string, organizationId: string) {
      const [row] = await db
        .select({
          id: memberships.id,
          isOwner: memberships.isOwner,
        })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.organizationId, organizationId),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async listAssignedBranchIds(membershipId: string): Promise<string[]> {
      const rows = await db
        .select({ branchId: branchAssignments.branchId })
        .from(branchAssignments)
        .where(eq(branchAssignments.membershipId, membershipId));
      return rows.map((row) => row.branchId);
    },

    async loadPermissionCodes(
      userId: string,
      organizationId: string | undefined,
      isPlatformAdmin: boolean,
    ): Promise<Set<PermissionCode>> {
      const granted = new Set<PermissionCode>();
      if (isPlatformAdmin) {
        granted.add("platform.manage");
      }
      if (!organizationId) {
        return granted;
      }

      const membership = await this.findMembership(userId, organizationId);
      if (!membership) {
        return granted;
      }

      if (membership.isOwner) {
        for (const code of ORG_PERMISSION_CODES) {
          granted.add(code);
        }
      }

      const rows = await db
        .select({ code: permissions.code })
        .from(membershipRoles)
        .innerJoin(rolePermissions, eq(rolePermissions.roleId, membershipRoles.roleId))
        .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
        .where(eq(membershipRoles.membershipId, membership.id));

      for (const row of rows) {
        if (isPermissionCode(row.code)) {
          granted.add(row.code);
        }
      }
      return granted;
    },

    async insertOrganization(name: string) {
      const [row] = await db
        .insert(organizations)
        .values({ name })
        .returning({
          id: organizations.id,
          name: organizations.name,
          createdAt: organizations.createdAt,
        });
      if (!row) {
        throw new Error("ORGANIZATION_INSERT_FAILED");
      }
      return row;
    },

    async findOrganization(id: string) {
      const [row] = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          createdAt: organizations.createdAt,
        })
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);
      return row ?? null;
    },

    async listOrganizations() {
      return db
        .select({
          id: organizations.id,
          name: organizations.name,
          createdAt: organizations.createdAt,
        })
        .from(organizations);
    },

    async updateOrganizationName(id: string, name: string) {
      const [row] = await db
        .update(organizations)
        .set({ name })
        .where(eq(organizations.id, id))
        .returning({
          id: organizations.id,
          name: organizations.name,
          createdAt: organizations.createdAt,
        });
      return row ?? null;
    },

    async insertOwnerMembership(userId: string, organizationId: string) {
      const [membership] = await db
        .insert(memberships)
        .values({ userId, organizationId, isOwner: true })
        .returning({ id: memberships.id });
      if (!membership) {
        throw new Error("MEMBERSHIP_INSERT_FAILED");
      }

      const [ownerRole] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.slug, "RESTAURANT_OWNER"))
        .limit(1);
      if (!ownerRole) {
        throw new Error("OWNER_ROLE_MISSING");
      }

      await db.insert(membershipRoles).values({
        membershipId: membership.id,
        roleId: ownerRole.id,
      });
      return membership;
    },

    async insertBranchAssignment(input: {
      organizationId: string;
      membershipId: string;
      branchId: string;
    }) {
      return withOrganizationScope(db, input.organizationId, async (tx) => {
        const [row] = await tx
          .insert(branchAssignments)
          .values(input)
          .returning({
            id: branchAssignments.id,
            membershipId: branchAssignments.membershipId,
            branchId: branchAssignments.branchId,
          });
        if (!row) {
          throw new Error("BRANCH_ASSIGNMENT_INSERT_FAILED");
        }
        return row;
      });
    },

    async listBranchAssignments(organizationId: string, branchId: string) {
      return withOrganizationScope(db, organizationId, async (tx) =>
        tx
          .select({
            id: branchAssignments.id,
            membershipId: branchAssignments.membershipId,
            branchId: branchAssignments.branchId,
          })
          .from(branchAssignments)
          .where(
            and(
              eq(branchAssignments.organizationId, organizationId),
              eq(branchAssignments.branchId, branchId),
            ),
          ),
      );
    },

    async membershipInOrganization(membershipId: string, organizationId: string) {
      const [row] = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.id, membershipId),
            eq(memberships.organizationId, organizationId),
          ),
        )
        .limit(1);
      return Boolean(row);
    },

    async deleteBranchAssignment(
      organizationId: string,
      branchId: string,
      membershipId: string,
    ) {
      return withOrganizationScope(db, organizationId, async (tx) => {
        const deleted = await tx
          .delete(branchAssignments)
          .where(
            and(
              eq(branchAssignments.organizationId, organizationId),
              eq(branchAssignments.branchId, branchId),
              eq(branchAssignments.membershipId, membershipId),
            ),
          )
          .returning({ id: branchAssignments.id });
        return deleted.length > 0;
      });
    },

    async grantPlatformAdminByEmail(email: string) {
      const [row] = await db
        .update(users)
        .set({ isPlatformAdmin: true })
        .where(eq(users.email, email))
        .returning({ id: users.id, email: users.email });
      return row ?? null;
    },
  };
}

export type TenancyRepository = ReturnType<typeof createTenancyRepository>;
