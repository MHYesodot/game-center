CREATE TABLE "auth_accounts" (
	"player_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_realtime_tickets" (
	"ticket_id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"player_id" text NOT NULL,
	"secret_hash" text NOT NULL,
	"client_type" text NOT NULL,
	"client_version" text NOT NULL,
	"platform" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"session_id" text PRIMARY KEY NOT NULL,
	"player_id" text NOT NULL,
	"secret_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "auth_realtime_tickets" ADD CONSTRAINT "auth_realtime_tickets_session_id_auth_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."auth_sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_realtime_tickets" ADD CONSTRAINT "auth_realtime_tickets_player_id_auth_accounts_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."auth_accounts"("player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_player_id_auth_accounts_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."auth_accounts"("player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_accounts_email_unique_idx" ON "auth_accounts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "auth_realtime_tickets_session_idx" ON "auth_realtime_tickets" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "auth_realtime_tickets_player_idx" ON "auth_realtime_tickets" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "auth_realtime_tickets_expiry_idx" ON "auth_realtime_tickets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_player_idx" ON "auth_sessions" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expiry_idx" ON "auth_sessions" USING btree ("expires_at");