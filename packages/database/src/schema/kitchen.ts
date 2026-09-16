import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { orders } from "./orders.js";
import { branches, restaurants } from "./restaurants.js";

export const kitchenTicketStatus = pgEnum("kitchen_ticket_status", [
  "NEW",
  "IN_PROGRESS",
  "READY",
  "CANCELLED",
]);

export const kitchenTicketItemStatus = pgEnum("kitchen_ticket_item_status", [
  "PENDING",
  "IN_PROGRESS",
  "READY",
]);

export const kitchenTickets = pgTable(
  "kitchen_tickets",
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
      .references(() => orders.id, { onDelete: "cascade" }),
    status: kitchenTicketStatus("status").notNull().default("NEW"),
    orderType: varchar("order_type", { length: 16 }).notNull(),
    tableCode: varchar("table_code", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("kitchen_tickets_order_id_uidx").on(table.orderId),
    index("kitchen_tickets_organization_id_idx").on(table.organizationId),
    index("kitchen_tickets_branch_id_status_idx").on(table.branchId, table.status),
  ],
);

export const kitchenTicketItems = pgTable(
  "kitchen_ticket_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => kitchenTickets.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id"),
    name: varchar("name", { length: 200 }).notNull(),
    variantName: varchar("variant_name", { length: 120 }),
    qty: integer("qty").notNull(),
    /** JSON array of modifier names only (no prices). */
    modifiersJson: text("modifiers_json").notNull().default("[]"),
    status: kitchenTicketItemStatus("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("kitchen_ticket_items_organization_id_idx").on(table.organizationId),
    index("kitchen_ticket_items_ticket_id_idx").on(table.ticketId),
  ],
);
