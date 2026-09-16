import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { branches, restaurants } from "./restaurants.js";
import { users } from "./users.js";

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }),
    category: varchar("category", { length: 80 }).notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    incurredAt: timestamp("incurred_at", { withTimezone: true }).notNull().defaultNow(),
    notes: varchar("notes", { length: 500 }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("expenses_organization_id_idx").on(table.organizationId),
    index("expenses_restaurant_id_incurred_at_idx").on(table.restaurantId, table.incurredAt),
    index("expenses_branch_id_idx").on(table.branchId),
    check("expenses_amount_minor_chk", sql`${table.amountMinor} >= 0`),
  ],
);
