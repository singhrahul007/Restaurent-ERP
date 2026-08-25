CREATE TABLE "_niva_schema_heartbeat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
