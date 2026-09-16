import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
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
import { orders, orderType } from "./orders.js";

export const deliveryStatus = pgEnum("delivery_status", [
  "ASSIGNED",
  "PICKED_UP",
  "DELIVERED",
  "CANCELLED",
]);

export const deliveryEventType = pgEnum("delivery_event_type", [
  "ASSIGNED",
  "PICKED_UP",
  "DELIVERED",
  "COD_RECORDED",
  "CANCELLED",
]);

export const deliveryAgents = pgTable(
  "delivery_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    online: boolean("online").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("delivery_agents_org_user_uidx").on(table.organizationId, table.userId),
    index("delivery_agents_organization_id_idx").on(table.organizationId),
  ],
);

export const deliveries = pgTable(
  "deliveries",
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
    orderId: uuid("order_id").notNull(),
    orderType: orderType("order_type").notNull().default("DELIVERY"),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => deliveryAgents.id, { onDelete: "restrict" }),
    status: deliveryStatus("status").notNull().default("ASSIGNED"),
    otpHash: varchar("otp_hash", { length: 64 }).notNull(),
    codAmountMinor: bigint("cod_amount_minor", { mode: "number" }).notNull().default(0),
    codCollectedMinor: bigint("cod_collected_minor", { mode: "number" }),
    addressLine: varchar("address_line", { length: 300 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    customerName: varchar("customer_name", { length: 120 }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("deliveries_order_id_uidx").on(table.orderId),
    index("deliveries_organization_id_idx").on(table.organizationId),
    index("deliveries_agent_id_idx").on(table.agentId),
    index("deliveries_status_idx").on(table.organizationId, table.status),
    check("deliveries_cod_amount_minor_chk", sql`${table.codAmountMinor} >= 0`),
    check(
      "deliveries_cod_collected_minor_chk",
      sql`${table.codCollectedMinor} is null or ${table.codCollectedMinor} >= 0`,
    ),
    foreignKey({
      name: "deliveries_order_id_type_fk",
      columns: [table.orderId, table.orderType],
      foreignColumns: [orders.id, orders.type],
    }),
  ],
);

export const deliveryEvents = pgTable(
  "delivery_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => deliveries.id, { onDelete: "cascade" }),
    type: deliveryEventType("type").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("delivery_events_delivery_id_idx").on(table.deliveryId)],
);
