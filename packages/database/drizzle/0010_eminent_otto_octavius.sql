CREATE TYPE "public"."kitchen_ticket_item_status" AS ENUM('PENDING', 'IN_PROGRESS', 'READY');--> statement-breakpoint
CREATE TYPE "public"."kitchen_ticket_status" AS ENUM('NEW', 'IN_PROGRESS', 'READY', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "kitchen_ticket_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"order_item_id" uuid,
	"name" varchar(200) NOT NULL,
	"variant_name" varchar(120),
	"qty" integer NOT NULL,
	"modifiers_json" text DEFAULT '[]' NOT NULL,
	"status" "kitchen_ticket_item_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kitchen_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "kitchen_ticket_status" DEFAULT 'NEW' NOT NULL,
	"order_type" varchar(16) NOT NULL,
	"table_code" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kitchen_tickets_order_id_uidx" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "restaurant_settings" ADD COLUMN "kitchen_sound_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_ticket_id_kitchen_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."kitchen_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kitchen_ticket_items_organization_id_idx" ON "kitchen_ticket_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "kitchen_ticket_items_ticket_id_idx" ON "kitchen_ticket_items" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "kitchen_tickets_organization_id_idx" ON "kitchen_tickets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "kitchen_tickets_branch_id_status_idx" ON "kitchen_tickets" USING btree ("branch_id","status");