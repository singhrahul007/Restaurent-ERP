import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Phase 0 bootstrap table. Not a domain entity.
 */
export const schemaHeartbeat = pgTable("_niva_schema_heartbeat", {
  id: uuid("id").primaryKey().defaultRandom(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});
