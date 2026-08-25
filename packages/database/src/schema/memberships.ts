import {
  boolean,
  index,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { roles } from "./rbac.js";
import { users } from "./users.js";

/**
 * Delete rules:
 * - User delete cascades memberships.
 * - Organization delete is RESTRICT while memberships (or restaurants) exist.
 */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    isOwner: boolean("is_owner").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("memberships_user_id_organization_id_uidx").on(
      table.userId,
      table.organizationId,
    ),
    index("memberships_organization_id_idx").on(table.organizationId),
  ],
);

export const membershipRoles = pgTable(
  "membership_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("membership_roles_membership_id_role_id_uidx").on(
      table.membershipId,
      table.roleId,
    ),
  ],
);
