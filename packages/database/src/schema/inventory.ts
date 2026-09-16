import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { branches, restaurants } from "./restaurants.js";
import { users } from "./users.js";

export const unitDimension = pgEnum("unit_dimension", ["MASS", "VOLUME", "COUNT"]);

export const inventoryTransactionType = pgEnum("inventory_transaction_type", [
  "PURCHASE",
  "SALE_CONSUMPTION",
  "WASTAGE",
  "ADJUSTMENT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "RETURN",
]);

export const purchaseOrderStatus = pgEnum("purchase_order_status", [
  "DRAFT",
  "RECEIVED",
  "CANCELLED",
]);

export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    dimension: unitDimension("dimension").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("units_restaurant_id_code_uidx").on(table.restaurantId, table.code),
    index("units_organization_id_idx").on(table.organizationId),
  ],
);

export const unitConversions = pgTable(
  "unit_conversions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    fromUnitId: uuid("from_unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    toUnitId: uuid("to_unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    numerator: integer("numerator").notNull(),
    denominator: integer("denominator").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("unit_conversions_from_to_uidx").on(table.fromUnitId, table.toUnitId),
    index("unit_conversions_organization_id_idx").on(table.organizationId),
  ],
);

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 64 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    baseUnitId: uuid("base_unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "restrict" }),
    trackStock: boolean("track_stock").notNull().default(true),
    lowStockThreshold: bigint("low_stock_threshold", { mode: "number" }),
    /** Last-cost per base unit in minor currency (paise). Used for stock valuation estimates. */
    unitCostMinor: bigint("unit_cost_minor", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("inventory_items_restaurant_id_sku_uidx").on(table.restaurantId, table.sku),
    index("inventory_items_organization_id_idx").on(table.organizationId),
  ],
);

export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    quantity: bigint("quantity", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("inventory_balances_item_branch_uidx").on(table.inventoryItemId, table.branchId),
    index("inventory_balances_organization_id_idx").on(table.organizationId),
    index("inventory_balances_branch_id_idx").on(table.branchId),
  ],
);

export const inventoryTransactions = pgTable(
  "inventory_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    type: inventoryTransactionType("type").notNull(),
    qtyBase: bigint("qty_base", { mode: "number" }).notNull(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "restrict" }),
    qtyInUnit: bigint("qty_in_unit", { mode: "number" }).notNull(),
    reason: varchar("reason", { length: 300 }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    referenceType: varchar("reference_type", { length: 40 }),
    referenceId: uuid("reference_id"),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("inventory_transactions_org_idempotency_uidx").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("inventory_transactions_item_created_idx").on(
      table.organizationId,
      table.inventoryItemId,
      table.createdAt,
    ),
    index("inventory_transactions_branch_id_idx").on(table.branchId),
  ],
);

export const wastageRecords = pgTable(
  "wastage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => inventoryTransactions.id, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 300 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("wastage_records_organization_id_idx").on(table.organizationId)],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 320 }),
    notes: varchar("notes", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("suppliers_organization_id_idx").on(table.organizationId),
    index("suppliers_restaurant_id_idx").on(table.restaurantId),
  ],
);

export const purchaseOrders = pgTable(
  "purchase_orders",
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
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    status: purchaseOrderStatus("status").notNull().default("DRAFT"),
    notes: varchar("notes", { length: 500 }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("purchase_orders_organization_id_idx").on(table.organizationId),
    index("purchase_orders_branch_id_idx").on(table.branchId),
  ],
);

export const purchaseOrderLines = pgTable(
  "purchase_order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "restrict" }),
    qtyInUnit: bigint("qty_in_unit", { mode: "number" }).notNull(),
    qtyBase: bigint("qty_base", { mode: "number" }).notNull(),
  },
  (table) => [index("purchase_order_lines_po_id_idx").on(table.purchaseOrderId)],
);
