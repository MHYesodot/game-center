CREATE TABLE "game_server_allocations" (
	"allocation_id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_reference" text,
	"status" text NOT NULL,
	"game_id" text NOT NULL,
	"game_version" text NOT NULL,
	"protocol_version" text NOT NULL,
	"build_version" text NOT NULL,
	"server_type" text NOT NULL,
	"runtime_type" text NOT NULL,
	"runtime_profile" text NOT NULL,
	"region" text,
	"participant_capacity" integer NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"provisioning_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"releasing_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"failure_code" text,
	"connection_transport" text,
	"connection_host" text,
	"connection_port" integer,
	"connection_secure" boolean,
	"connection_protocol_version" text,
	"connection_token_reference" text,
	"connection_expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "game_server_allocations" ADD CONSTRAINT "game_server_allocations_session_id_game_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_server_allocations_session_idx" ON "game_server_allocations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "game_server_allocations_status_idx" ON "game_server_allocations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "game_server_allocations_expiry_idx" ON "game_server_allocations" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "game_server_allocations_active_session_unique_idx" ON "game_server_allocations" USING btree ("session_id") WHERE "game_server_allocations"."status" in ('requested', 'provisioning', 'ready', 'releasing');--> statement-breakpoint
CREATE UNIQUE INDEX "game_server_allocations_provider_reference_unique_idx" ON "game_server_allocations" USING btree ("provider","provider_reference") WHERE "game_server_allocations"."provider_reference" is not null;