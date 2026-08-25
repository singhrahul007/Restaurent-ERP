import {
  char,
  index,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { memberships } from "./memberships.js";
import { organizations } from "./organizations.js";

/**
 * Delete rules:
 * - Organization delete is RESTRICT while restaurants exist.
 * - Restaurant delete cascades branches.
 * - Branch delete cascades branch_assignments.
 */
export const restaurants = pgTable(
  "restaurants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 200 }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("INR"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Kolkata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("restaurants_organization_id_idx").on(table.organizationId)],
);

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("branches_organization_id_idx").on(table.organizationId),
    index("branches_restaurant_id_idx").on(table.restaurantId),
  ],
);

export const branchAssignments = pgTable(
  "branch_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("branch_assignments_membership_id_branch_id_uidx").on(
      table.membershipId,
      table.branchId,
    ),
    index("branch_assignments_branch_id_idx").on(table.branchId),
  ],
);
