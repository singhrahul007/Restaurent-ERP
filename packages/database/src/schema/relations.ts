import { relations } from "drizzle-orm";
import { auditLogs } from "./audit-logs.js";
import { memberships, membershipRoles } from "./memberships.js";
import { mfaRecoveryCodes } from "./mfa.js";
import { organizations } from "./organizations.js";
import { emailVerifications, otpChallenges } from "./otp.js";
import { passwordResetTokens } from "./password-reset-tokens.js";
import { permissions, rolePermissions, roles } from "./rbac.js";
import { branchAssignments, branches, restaurants } from "./restaurants.js";
import { sessions } from "./sessions.js";
import { users } from "./users.js";

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  auditLogs: many(auditLogs),
  passwordResetTokens: many(passwordResetTokens),
  emailVerifications: many(emailVerifications),
  otpChallenges: many(otpChallenges),
  mfaRecoveryCodes: many(mfaRecoveryCodes),
  memberships: many(memberships),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  restaurants: many(restaurants),
  auditLogs: many(auditLogs),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  membershipRoles: many(membershipRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const membershipsRelations = relations(memberships, ({ one, many }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
  membershipRoles: many(membershipRoles),
  branchAssignments: many(branchAssignments),
}));

export const membershipRolesRelations = relations(membershipRoles, ({ one }) => ({
  membership: one(memberships, {
    fields: [membershipRoles.membershipId],
    references: [memberships.id],
  }),
  role: one(roles, {
    fields: [membershipRoles.roleId],
    references: [roles.id],
  }),
}));

export const restaurantsRelations = relations(restaurants, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [restaurants.organizationId],
    references: [organizations.id],
  }),
  branches: many(branches),
}));

export const branchesRelations = relations(branches, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [branches.organizationId],
    references: [organizations.id],
  }),
  restaurant: one(restaurants, {
    fields: [branches.restaurantId],
    references: [restaurants.id],
  }),
  branchAssignments: many(branchAssignments),
}));

export const branchAssignmentsRelations = relations(branchAssignments, ({ one }) => ({
  organization: one(organizations, {
    fields: [branchAssignments.organizationId],
    references: [organizations.id],
  }),
  membership: one(memberships, {
    fields: [branchAssignments.membershipId],
    references: [memberships.id],
  }),
  branch: one(branches, {
    fields: [branchAssignments.branchId],
    references: [branches.id],
  }),
}));

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
}));

export const emailVerificationsRelations = relations(
  emailVerifications,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerifications.userId],
      references: [users.id],
    }),
  }),
);

export const otpChallengesRelations = relations(otpChallenges, ({ one }) => ({
  user: one(users, {
    fields: [otpChallenges.userId],
    references: [users.id],
  }),
}));

export const mfaRecoveryCodesRelations = relations(mfaRecoveryCodes, ({ one }) => ({
  user: one(users, {
    fields: [mfaRecoveryCodes.userId],
    references: [users.id],
  }),
}));
