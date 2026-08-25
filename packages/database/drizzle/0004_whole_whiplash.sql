ALTER TABLE "audit_logs" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "resource_type" varchar(64);--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "resource_id" uuid;--> statement-breakpoint
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs" USING btree ("organization_id","created_at");