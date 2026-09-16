import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { branches, restaurants } from "./restaurants.js";

export const taxClasses = pgTable(
  "tax_classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    inclusive: boolean("inclusive").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("tax_classes_organization_id_idx").on(table.organizationId),
    index("tax_classes_restaurant_id_idx").on(table.restaurantId),
  ],
);

/** GST-oriented rates. Values are integer basis points (1800 = 18%). */
export const taxRates = pgTable(
  "tax_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    taxClassId: uuid("tax_class_id")
      .notNull()
      .references(() => taxClasses.id, { onDelete: "cascade" }),
    rateBps: integer("rate_bps").notNull(),
    cgstBps: integer("cgst_bps").notNull().default(0),
    sgstBps: integer("sgst_bps").notNull().default(0),
    igstBps: integer("igst_bps").notNull().default(0),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("tax_rates_organization_id_idx").on(table.organizationId),
    index("tax_rates_tax_class_id_idx").on(table.taxClassId),
    check("tax_rates_bps_nonnegative_chk", sql`${table.rateBps} >= 0`),
    check("tax_rates_cgst_nonnegative_chk", sql`${table.cgstBps} >= 0`),
    check("tax_rates_sgst_nonnegative_chk", sql`${table.sgstBps} >= 0`),
    check("tax_rates_igst_nonnegative_chk", sql`${table.igstBps} >= 0`),
  ],
);

export const menuCategories = pgTable(
  "menu_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => menuCategories.id, {
      onDelete: "restrict",
    }),
    name: varchar("name", { length: 120 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("menu_categories_organization_id_idx").on(table.organizationId),
    index("menu_categories_restaurant_id_idx").on(table.restaurantId),
    index("menu_categories_parent_id_idx").on(table.parentId),
  ],
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => menuCategories.id, { onDelete: "restrict" }),
    taxClassId: uuid("tax_class_id")
      .notNull()
      .references(() => taxClasses.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    basePriceMinor: bigint("base_price_minor", { mode: "number" }).notNull(),
    available: boolean("available").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("menu_items_organization_id_idx").on(table.organizationId),
    index("menu_items_restaurant_id_idx").on(table.restaurantId),
    index("menu_items_category_id_idx").on(table.categoryId),
    check("menu_items_base_price_minor_chk", sql`${table.basePriceMinor} >= 0`),
  ],
);

export const menuItemVariants = pgTable(
  "menu_item_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    sku: varchar("sku", { length: 64 }),
    priceDeltaMinor: bigint("price_delta_minor", { mode: "number" }).notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("menu_item_variants_organization_id_idx").on(table.organizationId),
    index("menu_item_variants_menu_item_id_idx").on(table.menuItemId),
  ],
);

export const modifierGroups = pgTable(
  "modifier_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    minSelect: integer("min_select").notNull().default(0),
    maxSelect: integer("max_select").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("modifier_groups_organization_id_idx").on(table.organizationId),
    index("modifier_groups_restaurant_id_idx").on(table.restaurantId),
    check("modifier_groups_min_select_chk", sql`${table.minSelect} >= 0`),
    check(
      "modifier_groups_max_gte_min_chk",
      sql`${table.maxSelect} >= ${table.minSelect}`,
    ),
  ],
);

export const modifiers = pgTable(
  "modifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    modifierGroupId: uuid("modifier_group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    priceDeltaMinor: bigint("price_delta_minor", { mode: "number" }).notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("modifiers_organization_id_idx").on(table.organizationId),
    index("modifiers_modifier_group_id_idx").on(table.modifierGroupId),
  ],
);

export const menuItemModifierGroups = pgTable(
  "menu_item_modifier_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    modifierGroupId: uuid("modifier_group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("menu_item_modifier_groups_item_group_uidx").on(
      table.menuItemId,
      table.modifierGroupId,
    ),
    index("menu_item_modifier_groups_organization_id_idx").on(table.organizationId),
  ],
);

/** 86 overlay: restaurant-wide when branch_id is null, else branch-specific. */
export const menuAvailabilityOverrides = pgTable(
  "menu_availability_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }),
    available: boolean("available").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("menu_availability_overrides_organization_id_idx").on(table.organizationId),
    index("menu_availability_overrides_menu_item_id_idx").on(table.menuItemId),
    uniqueIndex("menu_availability_item_restaurant_uidx")
      .on(table.menuItemId)
      .where(sql`${table.branchId} is null`),
    uniqueIndex("menu_availability_item_branch_uidx")
      .on(table.menuItemId, table.branchId)
      .where(sql`${table.branchId} is not null`),
  ],
);
