CREATE TYPE "public"."reservation_status" AS ENUM('CONFIRMED', 'WAITLISTED', 'SEATED', 'CANCELLED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TABLE "pos_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"cashier_id" uuid NOT NULL,
	"status" "shift_status" DEFAULT 'OPEN' NOT NULL,
	"opening_float_minor" bigint DEFAULT 0 NOT NULL,
	"expected_cash_minor" bigint DEFAULT 0 NOT NULL,
	"actual_cash_minor" bigint,
	"cash_discrepancy_minor" bigint DEFAULT 0 NOT NULL,
	"cash_sales_minor" bigint DEFAULT 0 NOT NULL,
	"card_sales_minor" bigint DEFAULT 0 NOT NULL,
	"upi_sales_minor" bigint DEFAULT 0 NOT NULL,
	"denomination_counts_json" varchar(2000),
	"notes" varchar(500),
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "table_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"guest_name" varchar(128) NOT NULL,
	"guest_phone" varchar(32) NOT NULL,
	"party_size" integer DEFAULT 2 NOT NULL,
	"reservation_time" timestamp with time zone NOT NULL,
	"table_id" uuid,
	"status" "reservation_status" DEFAULT 'CONFIRMED' NOT NULL,
	"special_requests" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "token_number" integer;--> statement-breakpoint
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_reservations" ADD CONSTRAINT "table_reservations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_reservations" ADD CONSTRAINT "table_reservations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_reservations" ADD CONSTRAINT "table_reservations_table_id_dining_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."dining_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pos_shifts_organization_id_branch_id_idx" ON "pos_shifts" USING btree ("organization_id","branch_id");--> statement-breakpoint
CREATE INDEX "pos_shifts_cashier_id_status_idx" ON "pos_shifts" USING btree ("cashier_id","status");--> statement-breakpoint
CREATE INDEX "table_reservations_org_branch_time_idx" ON "table_reservations" USING btree ("organization_id","branch_id","reservation_time");--> statement-breakpoint
CREATE INDEX "table_reservations_guest_phone_idx" ON "table_reservations" USING btree ("organization_id","guest_phone");