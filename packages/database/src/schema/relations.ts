import { relations } from "drizzle-orm";
import { auditLogs } from "./audit-logs.js";
import { memberships, membershipRoles } from "./memberships.js";
import { mfaRecoveryCodes } from "./mfa.js";
import { organizations } from "./organizations.js";
import { emailVerifications, otpChallenges } from "./otp.js";
import { passwordResetTokens } from "./password-reset-tokens.js";
import { permissions, rolePermissions, roles } from "./rbac.js";
import {
  menuAvailabilityOverrides,
  menuCategories,
  menuItemModifierGroups,
  menuItems,
  menuItemVariants,
  modifierGroups,
  modifiers,
  taxClasses,
  taxRates,
} from "./menu.js";
import {
  branchAssignments,
  branches,
  diningTables,
  restaurantSettings,
  restaurants,
} from "./restaurants.js";
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
  settings: one(restaurantSettings, {
    fields: [restaurants.id],
    references: [restaurantSettings.restaurantId],
  }),
  taxClasses: many(taxClasses),
  menuCategories: many(menuCategories),
  menuItems: many(menuItems),
  modifierGroups: many(modifierGroups),
}));

export const restaurantSettingsRelations = relations(restaurantSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [restaurantSettings.organizationId],
    references: [organizations.id],
  }),
  restaurant: one(restaurants, {
    fields: [restaurantSettings.restaurantId],
    references: [restaurants.id],
  }),
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
  diningTables: many(diningTables),
  menuAvailabilityOverrides: many(menuAvailabilityOverrides),
}));

export const diningTablesRelations = relations(diningTables, ({ one }) => ({
  organization: one(organizations, {
    fields: [diningTables.organizationId],
    references: [organizations.id],
  }),
  branch: one(branches, {
    fields: [diningTables.branchId],
    references: [branches.id],
  }),
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

export const taxClassesRelations = relations(taxClasses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [taxClasses.organizationId],
    references: [organizations.id],
  }),
  restaurant: one(restaurants, {
    fields: [taxClasses.restaurantId],
    references: [restaurants.id],
  }),
  rates: many(taxRates),
  menuItems: many(menuItems),
}));

export const taxRatesRelations = relations(taxRates, ({ one }) => ({
  organization: one(organizations, {
    fields: [taxRates.organizationId],
    references: [organizations.id],
  }),
  taxClass: one(taxClasses, {
    fields: [taxRates.taxClassId],
    references: [taxClasses.id],
  }),
}));

export const menuCategoriesRelations = relations(menuCategories, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [menuCategories.organizationId],
    references: [organizations.id],
  }),
  restaurant: one(restaurants, {
    fields: [menuCategories.restaurantId],
    references: [restaurants.id],
  }),
  parent: one(menuCategories, {
    fields: [menuCategories.parentId],
    references: [menuCategories.id],
    relationName: "menu_category_tree",
  }),
  children: many(menuCategories, { relationName: "menu_category_tree" }),
  items: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [menuItems.organizationId],
    references: [organizations.id],
  }),
  restaurant: one(restaurants, {
    fields: [menuItems.restaurantId],
    references: [restaurants.id],
  }),
  category: one(menuCategories, {
    fields: [menuItems.categoryId],
    references: [menuCategories.id],
  }),
  taxClass: one(taxClasses, {
    fields: [menuItems.taxClassId],
    references: [taxClasses.id],
  }),
  variants: many(menuItemVariants),
  modifierGroups: many(menuItemModifierGroups),
  availabilityOverrides: many(menuAvailabilityOverrides),
}));

export const menuItemVariantsRelations = relations(menuItemVariants, ({ one }) => ({
  organization: one(organizations, {
    fields: [menuItemVariants.organizationId],
    references: [organizations.id],
  }),
  item: one(menuItems, {
    fields: [menuItemVariants.menuItemId],
    references: [menuItems.id],
  }),
}));

export const modifierGroupsRelations = relations(modifierGroups, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [modifierGroups.organizationId],
    references: [organizations.id],
  }),
  restaurant: one(restaurants, {
    fields: [modifierGroups.restaurantId],
    references: [restaurants.id],
  }),
  modifiers: many(modifiers),
  items: many(menuItemModifierGroups),
}));

export const modifiersRelations = relations(modifiers, ({ one }) => ({
  organization: one(organizations, {
    fields: [modifiers.organizationId],
    references: [organizations.id],
  }),
  group: one(modifierGroups, {
    fields: [modifiers.modifierGroupId],
    references: [modifierGroups.id],
  }),
}));

export const menuItemModifierGroupsRelations = relations(
  menuItemModifierGroups,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [menuItemModifierGroups.organizationId],
      references: [organizations.id],
    }),
    item: one(menuItems, {
      fields: [menuItemModifierGroups.menuItemId],
      references: [menuItems.id],
    }),
    group: one(modifierGroups, {
      fields: [menuItemModifierGroups.modifierGroupId],
      references: [modifierGroups.id],
    }),
  }),
);

export const menuAvailabilityOverridesRelations = relations(
  menuAvailabilityOverrides,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [menuAvailabilityOverrides.organizationId],
      references: [organizations.id],
    }),
    restaurant: one(restaurants, {
      fields: [menuAvailabilityOverrides.restaurantId],
      references: [restaurants.id],
    }),
    item: one(menuItems, {
      fields: [menuAvailabilityOverrides.menuItemId],
      references: [menuItems.id],
    }),
    branch: one(branches, {
      fields: [menuAvailabilityOverrides.branchId],
      references: [branches.id],
    }),
  }),
);
