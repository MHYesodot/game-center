CREATE TABLE "game_session_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"player_id" text NOT NULL,
	"source_request_id" text NOT NULL,
	"source_lobby_id" text,
	"joined_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"session_id" text PRIMARY KEY NOT NULL,
	"source_kind" text NOT NULL,
	"match_id" text NOT NULL,
	"proposal_id" text NOT NULL,
	"game_id" text NOT NULL,
	"queue_type" text NOT NULL,
	"platform" text NOT NULL,
	"region" text,
	"game_version" text NOT NULL,
	"protocol_version" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"failure_code" text
);
--> statement-breakpoint
ALTER TABLE "game_session_participants" ADD CONSTRAINT "game_session_participants_session_id_game_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_session_participants_session_player_unique_idx" ON "game_session_participants" USING btree ("session_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_session_participants_session_request_unique_idx" ON "game_session_participants" USING btree ("session_id","source_request_id");--> statement-breakpoint
CREATE INDEX "game_session_participants_session_idx" ON "game_session_participants" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "game_session_participants_player_idx" ON "game_session_participants" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "game_session_participants_source_lobby_idx" ON "game_session_participants" USING btree ("source_lobby_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_sessions_match_id_unique_idx" ON "game_sessions" USING btree ("match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_sessions_proposal_id_unique_idx" ON "game_sessions" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "game_sessions_status_idx" ON "game_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "game_sessions_expiry_idx" ON "game_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "game_sessions_game_status_idx" ON "game_sessions" USING btree ("game_id","status");