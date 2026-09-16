import {
  boolean,
  char,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { memberships } from "./memberships.js";
import { organizations } from "./organizations.js";

export const inventoryPolicy = pgEnum("inventory_policy", [
  "OFF",
  "ON_SALE",
  "MANUAL",
]);

export const diningTableStatus = pgEnum("dining_table_status", [
  "AVAILABLE",
  "OCCUPIED",
  "RESERVED",
]);

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
    posIdleTimeoutMinutes: integer("pos_idle_timeout_minutes").notNull().default(15),
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

export const restaurantSettings = pgTable(
  "restaurant_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Kolkata"),
    currency: char("currency", { length: 3 }).notNull().default("INR"),
    taxInclusive: boolean("tax_inclusive").notNull().default(false),
    kitchenSoundEnabled: boolean("kitchen_sound_enabled").notNull().default(true),
    inventoryPolicy: inventoryPolicy("inventory_policy").notNull().default("OFF"),
    addressLine1: varchar("address_line1", { length: 200 }),
    addressLine2: varchar("address_line2", { length: 200 }),
    city: varchar("city", { length: 100 }),
    region: varchar("region", { length: 100 }),
    postalCode: varchar("postal_code", { length: 20 }),
    country: char("country", { length: 2 }).notNull().default("IN"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("restaurant_settings_restaurant_id_uidx").on(table.restaurantId),
    index("restaurant_settings_organization_id_idx").on(table.organizationId),
  ],
);

export const diningTables = pgTable(
  "dining_tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 32 }).notNull(),
    floor: varchar("floor", { length: 64 }),
    seats: integer("seats"),
    status: diningTableStatus("status").notNull().default("AVAILABLE"),
    qrTokenHash: varchar("qr_token_hash", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("dining_tables_branch_id_code_uidx").on(table.branchId, table.code),
    index("dining_tables_organization_id_idx").on(table.organizationId),
    index("dining_tables_branch_id_idx").on(table.branchId),
  ],
);
