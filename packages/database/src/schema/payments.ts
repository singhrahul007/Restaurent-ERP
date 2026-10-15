import {
  bigint,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { orders } from "./orders.js";
import { users } from "./users.js";

export const paymentStatus = pgEnum("payment_status", [
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);

export const paymentMethod = pgEnum("payment_method", ["CASH"]);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    status: paymentStatus("status").notNull().default("PAID"),
    method: paymentMethod("method").notNull().default("CASH"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("payments_organization_id_idx").on(table.organizationId),
    index("payments_order_id_idx").on(table.orderId),
    index("payments_organization_id_method_created_at_idx").on(
      table.organizationId,
      table.method,
      table.createdAt,
    ),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    reason: varchar("reason", { length: 200 }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("refunds_organization_id_idx").on(table.organizationId),
    index("refunds_payment_id_idx").on(table.paymentId),
  ],
);

export const shiftStatus = pgEnum("shift_status", ["OPEN", "CLOSED"]);

export const posShifts = pgTable(
  "pos_shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").notNull(),
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: shiftStatus("status").notNull().default("OPEN"),
    openingFloatMinor: bigint("opening_float_minor", { mode: "number" }).notNull().default(0),
    expectedCashMinor: bigint("expected_cash_minor", { mode: "number" }).notNull().default(0),
    actualCashMinor: bigint("actual_cash_minor", { mode: "number" }),
    cashDiscrepancyMinor: bigint("cash_discrepancy_minor", { mode: "number" }).notNull().default(0),
    cashSalesMinor: bigint("cash_sales_minor", { mode: "number" }).notNull().default(0),
    cardSalesMinor: bigint("card_sales_minor", { mode: "number" }).notNull().default(0),
    upiSalesMinor: bigint("upi_sales_minor", { mode: "number" }).notNull().default(0),
    denominationCountsJson: varchar("denomination_counts_json", { length: 2000 }),
    notes: varchar("notes", { length: 500 }),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("pos_shifts_organization_id_branch_id_idx").on(table.organizationId, table.branchId),
    index("pos_shifts_cashier_id_status_idx").on(table.cashierId, table.status),
  ],
);
