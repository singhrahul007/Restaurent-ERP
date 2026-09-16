import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { branches, diningTables, restaurants } from "./restaurants.js";
import { users } from "./users.js";

export const orderType = pgEnum("order_type", ["DINE_IN", "TAKEAWAY"]);

export const orderStatus = pgEnum("order_status", [
  "DRAFT",
  "CREATED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
  "HANDED_OVER",
  "COMPLETED",
  "CANCELLED",
]);

export const orderDiscountType = pgEnum("order_discount_type", ["PERCENT", "AMOUNT"]);

export const orders = pgTable(
  "orders",
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
    tableId: uuid("table_id").references(() => diningTables.id, { onDelete: "restrict" }),
    type: orderType("type").notNull(),
    status: orderStatus("status").notNull().default("CREATED"),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    notes: varchar("notes", { length: 500 }),
    couponId: uuid("coupon_id").references((): AnyPgColumn => coupons.id, {
      onDelete: "set null",
    }),
    subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull().default(0),
    discountTotalMinor: bigint("discount_total_minor", { mode: "number" }).notNull().default(0),
    couponTotalMinor: bigint("coupon_total_minor", { mode: "number" }).notNull().default(0),
    taxTotalMinor: bigint("tax_total_minor", { mode: "number" }).notNull().default(0),
    serviceChargeMinor: bigint("service_charge_minor", { mode: "number" }).notNull().default(0),
    roundingMinor: bigint("rounding_minor", { mode: "number" }).notNull().default(0),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("orders_organization_id_idempotency_key_uidx").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("orders_organization_id_branch_id_created_at_idx").on(
      table.organizationId,
      table.branchId,
      table.createdAt,
    ),
    index("orders_table_id_idx").on(table.tableId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id"),
    variantId: uuid("variant_id"),
    itemName: varchar("item_name", { length: 200 }).notNull(),
    variantName: varchar("variant_name", { length: 120 }),
    qty: integer("qty").notNull(),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
    taxRateBps: integer("tax_rate_bps").notNull().default(0),
    taxInclusive: boolean("tax_inclusive").notNull().default(false),
    lineDiscountMinor: bigint("line_discount_minor", { mode: "number" }).notNull().default(0),
    taxMinor: bigint("tax_minor", { mode: "number" }).notNull().default(0),
    lineTotalMinor: bigint("line_total_minor", { mode: "number" }).notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("order_items_organization_id_idx").on(table.organizationId),
    index("order_items_order_id_idx").on(table.orderId),
  ],
);

export const orderItemModifiers = pgTable(
  "order_item_modifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    modifierId: uuid("modifier_id"),
    name: varchar("name", { length: 120 }).notNull(),
    priceDeltaMinor: bigint("price_delta_minor", { mode: "number" }).notNull().default(0),
  },
  (table) => [index("order_item_modifiers_order_item_id_idx").on(table.orderItemId)],
);

export const orderDiscounts = pgTable(
  "order_discounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: orderDiscountType("type").notNull(),
    percentBps: integer("percent_bps"),
    amountMinor: bigint("amount_minor", { mode: "number" }),
    reason: varchar("reason", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("order_discounts_order_id_idx").on(table.orderId)],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("order_status_history_order_id_idx").on(table.orderId)],
);

/**
 * Redemption rule: at most one coupon per order; one redemption row per
 * (coupon_id, order_id). A code may be redeemed up to max_redemptions times
 * across orders (null = unlimited).
 */
export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 40 }).notNull(),
    percentBps: integer("percent_bps"),
    amountMinor: bigint("amount_minor", { mode: "number" }),
    maxRedemptions: integer("max_redemptions"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("coupons_organization_id_code_uidx").on(table.organizationId, table.code),
    index("coupons_restaurant_id_idx").on(table.restaurantId),
  ],
);

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("coupon_redemptions_order_id_uidx").on(table.orderId),
    unique("coupon_redemptions_coupon_id_order_id_uidx").on(table.couponId, table.orderId),
    index("coupon_redemptions_coupon_id_idx").on(table.couponId),
  ],
);

export const outbox = pgTable(
  "outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    topic: varchar("topic", { length: 128 }).notNull(),
    payload: text("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    index("outbox_unpublished_idx").on(table.publishedAt, table.createdAt),
    index("outbox_organization_id_idx").on(table.organizationId),
  ],
);
