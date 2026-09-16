import { and, eq } from "drizzle-orm";
import {
  branchAssignments,
  branches,
  membershipRoles,
  memberships,
  roles,
  users,
  type Database,
} from "@niva/database";

export function createStaffRepository(db: Database) {
  return {
    async listStaff(organizationId: string) {
      const rows = await db
        .select({
          membershipId: memberships.id,
          userId: users.id,
          email: users.email,
          isOwner: memberships.isOwner,
          roleSlug: roles.slug,
          branchId: branchAssignments.branchId,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .leftJoin(membershipRoles, eq(membershipRoles.membershipId, memberships.id))
        .leftJoin(roles, eq(roles.id, membershipRoles.roleId))
        .leftJoin(
          branchAssignments,
          eq(branchAssignments.membershipId, memberships.id),
        )
        .where(eq(memberships.organizationId, organizationId));

      const byId = new Map<
        string,
        {
          id: string;
          userId: string;
          email: string;
          isOwner: boolean;
          roles: string[];
          branchIds: string[];
        }
      >();
      for (const row of rows) {
        const current = byId.get(row.membershipId) ?? {
          id: row.membershipId,
          userId: row.userId,
          email: row.email,
          isOwner: row.isOwner,
          roles: [],
          branchIds: [],
        };
        if (row.roleSlug && !current.roles.includes(row.roleSlug)) {
          current.roles.push(row.roleSlug);
        }
        if (row.branchId && !current.branchIds.includes(row.branchId)) {
          current.branchIds.push(row.branchId);
        }
        byId.set(row.membershipId, current);
      }
      return [...byId.values()];
    },

    async findUserByEmail(email: string) {
      const [row] = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return row ?? null;
    },

    async insertUser(email: string, passwordHash: string) {
      const [row] = await db
        .insert(users)
        .values({ email, passwordHash })
        .returning({ id: users.id, email: users.email });
      if (!row) {
        throw new Error("USER_INSERT_FAILED");
      }
      return row;
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

    async findMembershipById(membershipId: string, organizationId: string) {
      const [row] = await db
        .select({
          id: memberships.id,
          userId: memberships.userId,
          isOwner: memberships.isOwner,
        })
        .from(memberships)
        .where(
          and(
            eq(memberships.id, membershipId),
            eq(memberships.organizationId, organizationId),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async insertMembership(input: {
      userId: string;
      organizationId: string;
      isOwner: boolean;
    }) {
      const [row] = await db
        .insert(memberships)
        .values(input)
        .returning({ id: memberships.id, isOwner: memberships.isOwner });
      if (!row) {
        throw new Error("MEMBERSHIP_INSERT_FAILED");
      }
      return row;
    },

    async findRoleBySlug(slug: string) {
      const [row] = await db
        .select({ id: roles.id, slug: roles.slug })
        .from(roles)
        .where(eq(roles.slug, slug))
        .limit(1);
      return row ?? null;
    },

    async replaceMembershipRole(membershipId: string, roleId: string) {
      await db.delete(membershipRoles).where(eq(membershipRoles.membershipId, membershipId));
      await db.insert(membershipRoles).values({ membershipId, roleId });
    },

    async branchInOrganization(branchId: string, organizationId: string) {
      const [row] = await db
        .select({ id: branches.id })
        .from(branches)
        .where(
          and(eq(branches.id, branchId), eq(branches.organizationId, organizationId)),
        )
        .limit(1);
      return Boolean(row);
    },

    async replaceBranchAssignments(input: {
      organizationId: string;
      membershipId: string;
      branchIds: string[];
    }) {
      await db
        .delete(branchAssignments)
        .where(eq(branchAssignments.membershipId, input.membershipId));
      if (input.branchIds.length === 0) {
        return;
      }
      await db.insert(branchAssignments).values(
        input.branchIds.map((branchId) => ({
          organizationId: input.organizationId,
          membershipId: input.membershipId,
          branchId,
        })),
      );
    },
  };
}

export type StaffRepository = ReturnType<typeof createStaffRepository>;
