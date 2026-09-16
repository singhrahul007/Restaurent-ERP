CREATE TYPE "public"."delivery_event_type" AS ENUM('ASSIGNED', 'PICKED_UP', 'DELIVERED', 'COD_RECORDED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('ASSIGNED', 'PICKED_UP', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
ALTER TYPE "public"."order_type" ADD VALUE 'DELIVERY';--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_type" "order_type" DEFAULT 'DELIVERY' NOT NULL,
	"agent_id" uuid NOT NULL,
	"status" "delivery_status" DEFAULT 'ASSIGNED' NOT NULL,
	"otp_hash" varchar(64) NOT NULL,
	"cod_amount_minor" bigint DEFAULT 0 NOT NULL,
	"cod_collected_minor" bigint,
	"address_line" varchar(300) NOT NULL,
	"phone" varchar(32),
	"customer_name" varchar(120),
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_order_id_uidx" UNIQUE("order_id"),
	CONSTRAINT "deliveries_order_type_delivery_chk" CHECK ("deliveries"."order_type" = 'DELIVERY'),
	CONSTRAINT "deliveries_cod_amount_minor_chk" CHECK ("deliveries"."cod_amount_minor" >= 0),
	CONSTRAINT "deliveries_cod_collected_minor_chk" CHECK ("deliveries"."cod_collected_minor" is null or "deliveries"."cod_collected_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "delivery_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"online" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_agents_org_user_uidx" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "delivery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"delivery_id" uuid NOT NULL,
	"type" "delivery_event_type" NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_agent_id_delivery_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."delivery_agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_type_fk" FOREIGN KEY ("order_id","order_type") REFERENCES "public"."orders"("id","type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_agents" ADD CONSTRAINT "delivery_agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_agents" ADD CONSTRAINT "delivery_agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deliveries_organization_id_idx" ON "deliveries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "deliveries_agent_id_idx" ON "deliveries" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "deliveries_status_idx" ON "deliveries" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "delivery_agents_organization_id_idx" ON "delivery_agents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "delivery_events_delivery_id_idx" ON "delivery_events" USING btree ("delivery_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_id_type_uidx" UNIQUE("id","type");