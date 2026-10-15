import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { branches, restaurants } from "./restaurants.js";
import { orders } from "./orders.js";

export const ondcOrderStatus = pgEnum("ondc_order_status", [
  "INITIATED",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const ondcSellerConfigs = pgTable(
  "ondc_seller_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    subscriberId: varchar("subscriber_id", { length: 255 }).notNull(),
    subscriberUrl: text("subscriber_url").notNull(),
    uniqueKeyId: varchar("unique_key_id", { length: 128 }).notNull(),
    signingPublicKey: text("signing_public_key").notNull(),
    signingPrivateKeyEncrypted: text("signing_private_key_encrypted").notNull(),
    encryptionPublicKey: text("encryption_public_key"),
    encryptionPrivateKeyEncrypted: text("encryption_private_key_encrypted"),
    providerLocationId: varchar("provider_location_id", { length: 128 }),
    domain: varchar("domain", { length: 64 }).notNull().default("ONDC:RET11"),
    cityCode: varchar("city_code", { length: 32 }).notNull().default("std:080"),
    country: varchar("country", { length: 8 }).notNull().default("IND"),
    bppId: varchar("bpp_id", { length: 255 }),
    bppUri: text("bpp_uri"),
    gatewayUrl: text("gateway_url"),
    enabled: boolean("enabled").notNull().default(true),
    autoAcceptOrders: boolean("auto_accept_orders").notNull().default(true),
    defaultPrepTimeMinutes: integer("default_prep_time_minutes").notNull().default(30),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("ondc_seller_configs_org_branch_uidx").on(table.organizationId, table.branchId),
    index("ondc_seller_configs_organization_id_idx").on(table.organizationId),
    index("ondc_seller_configs_subscriber_id_idx").on(table.subscriberId),
  ],
);

export const ondcTransactions = pgTable(
  "ondc_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    transactionId: varchar("transaction_id", { length: 128 }).notNull(),
    messageId: varchar("message_id", { length: 128 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    bapId: varchar("bap_id", { length: 255 }).notNull(),
    bapUri: text("bap_uri").notNull(),
    bppId: varchar("bpp_id", { length: 255 }),
    bppUri: text("bpp_uri"),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    ondcOrderId: varchar("ondc_order_id", { length: 128 }),
    status: ondcOrderStatus("status").notNull().default("INITIATED"),
    requestPayload: jsonb("request_payload"),
    responsePayload: jsonb("response_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("ondc_transactions_tx_msg_action_uidx").on(
      table.transactionId,
      table.messageId,
      table.action,
    ),
    index("ondc_transactions_organization_id_idx").on(table.organizationId),
    index("ondc_transactions_transaction_id_idx").on(table.transactionId),
    index("ondc_transactions_order_id_idx").on(table.orderId),
    index("ondc_transactions_ondc_order_id_idx").on(table.ondcOrderId),
  ],
);

