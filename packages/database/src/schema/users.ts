import { pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar, boolean } from "drizzle-orm/pg-core";

export const userStatus = pgEnum("user_status", [
  "PENDING_VERIFICATION",
  "ACTIVE",
  "DISABLED",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    mfaSecretEncrypted: varchar("mfa_secret_encrypted", { length: 512 }),
    mfaEnabledAt: timestamp("mfa_enabled_at", { withTimezone: true }),
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    status: userStatus("status").notNull().default("PENDING_VERIFICATION"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("users_email_uidx").on(table.email)],
);
