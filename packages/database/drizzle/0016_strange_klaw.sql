CREATE TYPE "public"."ondc_order_status" AS ENUM('INITIATED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "kitchen_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"code" varchar(32) NOT NULL,
	"color_hex" varchar(16) DEFAULT '#f59e0b' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kitchen_stations_branch_id_code_uidx" UNIQUE("branch_id","code")
);
--> statement-breakpoint
CREATE TABLE "ondc_seller_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"subscriber_id" varchar(255) NOT NULL,
	"subscriber_url" text NOT NULL,
	"unique_key_id" varchar(128) NOT NULL,
	"signing_public_key" text NOT NULL,
	"signing_private_key_encrypted" text NOT NULL,
	"encryption_public_key" text,
	"encryption_private_key_encrypted" text,
	"provider_location_id" varchar(128),
	"domain" varchar(64) DEFAULT 'ONDC:RET11' NOT NULL,
	"city_code" varchar(32) DEFAULT 'std:080' NOT NULL,
	"country" varchar(8) DEFAULT 'IND' NOT NULL,
	"bpp_id" varchar(255),
	"bpp_uri" text,
	"gateway_url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"auto_accept_orders" boolean DEFAULT true NOT NULL,
	"default_prep_time_minutes" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ondc_seller_configs_org_branch_uidx" UNIQUE("organization_id","branch_id")
);
--> statement-breakpoint
CREATE TABLE "ondc_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"transaction_id" varchar(128) NOT NULL,
	"message_id" varchar(128) NOT NULL,
	"action" varchar(64) NOT NULL,
	"bap_id" varchar(255) NOT NULL,
	"bap_uri" text NOT NULL,
	"bpp_id" varchar(255),
	"bpp_uri" text,
	"order_id" uuid,
	"ondc_order_id" varchar(128),
	"status" "ondc_order_status" DEFAULT 'INITIATED' NOT NULL,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ondc_transactions_tx_msg_action_uidx" UNIQUE("transaction_id","message_id","action")
);
--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD COLUMN "kitchen_station_id" uuid;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD COLUMN "assigned_cook_id" uuid;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kitchen_stations" ADD CONSTRAINT "kitchen_stations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_stations" ADD CONSTRAINT "kitchen_stations_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_stations" ADD CONSTRAINT "kitchen_stations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ondc_seller_configs" ADD CONSTRAINT "ondc_seller_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ondc_seller_configs" ADD CONSTRAINT "ondc_seller_configs_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ondc_seller_configs" ADD CONSTRAINT "ondc_seller_configs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ondc_transactions" ADD CONSTRAINT "ondc_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ondc_transactions" ADD CONSTRAINT "ondc_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kitchen_stations_organization_id_idx" ON "kitchen_stations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "kitchen_stations_branch_id_idx" ON "kitchen_stations" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "ondc_seller_configs_organization_id_idx" ON "ondc_seller_configs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ondc_seller_configs_subscriber_id_idx" ON "ondc_seller_configs" USING btree ("subscriber_id");--> statement-breakpoint
CREATE INDEX "ondc_transactions_organization_id_idx" ON "ondc_transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ondc_transactions_transaction_id_idx" ON "ondc_transactions" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "ondc_transactions_order_id_idx" ON "ondc_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ondc_transactions_ondc_order_id_idx" ON "ondc_transactions" USING btree ("ondc_order_id");--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_kitchen_station_id_kitchen_stations_id_fk" FOREIGN KEY ("kitchen_station_id") REFERENCES "public"."kitchen_stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_assigned_cook_id_users_id_fk" FOREIGN KEY ("assigned_cook_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kitchen_ticket_items_station_id_idx" ON "kitchen_ticket_items" USING btree ("kitchen_station_id");--> statement-breakpoint
CREATE INDEX "kitchen_ticket_items_assigned_cook_id_idx" ON "kitchen_ticket_items" USING btree ("assigned_cook_id");