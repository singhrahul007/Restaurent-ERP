CREATE TYPE "public"."dining_table_status" AS ENUM('AVAILABLE', 'OCCUPIED', 'RESERVED');--> statement-breakpoint
CREATE TYPE "public"."inventory_policy" AS ENUM('OFF', 'ON_SALE', 'MANUAL');--> statement-breakpoint
CREATE TABLE "dining_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"floor" varchar(64),
	"seats" integer,
	"status" "dining_table_status" DEFAULT 'AVAILABLE' NOT NULL,
	"qr_token_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dining_tables_branch_id_code_uidx" UNIQUE("branch_id","code")
);
--> statement-breakpoint
CREATE TABLE "restaurant_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Kolkata' NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"tax_inclusive" boolean DEFAULT false NOT NULL,
	"inventory_policy" "inventory_policy" DEFAULT 'OFF' NOT NULL,
	"address_line1" varchar(200),
	"address_line2" varchar(200),
	"city" varchar(100),
	"region" varchar(100),
	"postal_code" varchar(20),
	"country" char(2) DEFAULT 'IN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurant_settings_restaurant_id_uidx" UNIQUE("restaurant_id")
);
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "pos_idle_timeout_minutes" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_settings" ADD CONSTRAINT "restaurant_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_settings" ADD CONSTRAINT "restaurant_settings_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dining_tables_organization_id_idx" ON "dining_tables" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "dining_tables_branch_id_idx" ON "dining_tables" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "restaurant_settings_organization_id_idx" ON "restaurant_settings" USING btree ("organization_id");--> statement-breakpoint
INSERT INTO "restaurant_settings" ("organization_id", "restaurant_id", "timezone", "currency")
SELECT "organization_id", "id", "timezone", "currency" FROM "restaurants"
WHERE NOT EXISTS (
  SELECT 1 FROM "restaurant_settings" s WHERE s."restaurant_id" = "restaurants"."id"
);