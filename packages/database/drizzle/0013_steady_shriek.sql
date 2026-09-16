CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"branch_id" uuid,
	"category" varchar(80) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"incurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" varchar(500),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_minor_chk" CHECK ("expenses"."amount_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "deliveries" DROP CONSTRAINT IF EXISTS "deliveries_order_type_delivery_chk";--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "unit_cost_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_organization_id_idx" ON "expenses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "expenses_restaurant_id_incurred_at_idx" ON "expenses" USING btree ("restaurant_id","incurred_at");--> statement-breakpoint
CREATE INDEX "expenses_branch_id_idx" ON "expenses" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "order_items_organization_id_item_name_idx" ON "order_items" USING btree ("organization_id","item_name");--> statement-breakpoint
CREATE INDEX "orders_organization_id_restaurant_id_status_created_at_idx" ON "orders" USING btree ("organization_id","restaurant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "payments_organization_id_method_created_at_idx" ON "payments" USING btree ("organization_id","method","created_at");