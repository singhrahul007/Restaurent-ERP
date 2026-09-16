import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { branches, restaurants } from "./restaurants.js";
import { menuItems, menuItemVariants } from "./menu.js";
import { inventoryItems } from "./inventory.js";
import { orders } from "./orders.js";

export const recipes = pgTable(
  "recipes",
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
    variantId: uuid("variant_id").references(() => menuItemVariants.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("recipes_organization_id_idx").on(table.organizationId),
    index("recipes_restaurant_id_idx").on(table.restaurantId),
    uniqueIndex("recipes_item_no_variant_uidx")
      .on(table.menuItemId)
      .where(sql`${table.variantId} is null`),
    uniqueIndex("recipes_item_variant_uidx")
      .on(table.menuItemId, table.variantId)
      .where(sql`${table.variantId} is not null`),
  ],
);

export const recipeLines = pgTable(
  "recipe_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    qtyBase: bigint("qty_base", { mode: "number" }).notNull(),
  },
  (table) => [
    index("recipe_lines_recipe_id_idx").on(table.recipeId),
    unique("recipe_lines_recipe_inventory_uidx").on(table.recipeId, table.inventoryItemId),
  ],
);

/** One row per order. Unique `order_id` makes SALE_CONSUMPTION idempotent. */
export const inventoryConsumptions = pgTable(
  "inventory_consumptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("inventory_consumptions_order_id_uidx").on(table.orderId),
    index("inventory_consumptions_organization_id_idx").on(table.organizationId),
  ],
);
