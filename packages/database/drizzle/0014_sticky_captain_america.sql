ALTER TYPE "public"."order_type" ADD VALUE 'ONLINE';--> statement-breakpoint
CREATE TABLE "integration_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" varchar(64) NOT NULL,
	"label" varchar(120),
	"credentials_encrypted" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_accounts_org_provider_uidx" UNIQUE("organization_id","provider")
);
--> statement-breakpoint
CREATE TABLE "integration_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"provider" varchar(64) NOT NULL,
	"direction" varchar(16) NOT NULL,
	"payload_json" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "source" varchar(64) DEFAULT 'pos' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "source_external_id" varchar(128);--> statement-breakpoint
ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_accounts_organization_id_idx" ON "integration_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integration_events_organization_id_idx" ON "integration_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integration_events_provider_created_at_idx" ON "integration_events" USING btree ("provider","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_org_source_external_uidx" ON "orders" USING btree ("organization_id","source","source_external_id") WHERE "orders"."source_external_id" is not null;