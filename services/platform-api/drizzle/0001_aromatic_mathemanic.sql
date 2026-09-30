CREATE TABLE "lobbies" (
	"lobby_id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"owner_player_id" text NOT NULL,
	"status" text NOT NULL,
	"visibility" text NOT NULL,
	"capacity" integer NOT NULL,
	"minimum_players" integer NOT NULL,
	"configuration" jsonb NOT NULL,
	"join_code_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lobby_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"lobby_id" text NOT NULL,
	"player_id" text NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "lobby_members" ADD CONSTRAINT "lobby_members_lobby_id_lobbies_lobby_id_fk" FOREIGN KEY ("lobby_id") REFERENCES "public"."lobbies"("lobby_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lobbies_game_status_idx" ON "lobbies" USING btree ("game_id","status");--> statement-breakpoint
CREATE INDEX "lobbies_owner_idx" ON "lobbies" USING btree ("owner_player_id");--> statement-breakpoint
CREATE INDEX "lobbies_status_idx" ON "lobbies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lobbies_expiry_idx" ON "lobbies" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lobby_members_active_unique_idx" ON "lobby_members" USING btree ("lobby_id","player_id") WHERE "lobby_members"."left_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "lobby_members_active_owner_unique_idx" ON "lobby_members" USING btree ("lobby_id") WHERE "lobby_members"."left_at" is null and "lobby_members"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "lobby_members_lobby_joined_idx" ON "lobby_members" USING btree ("lobby_id","joined_at");--> statement-breakpoint
CREATE INDEX "lobby_members_player_idx" ON "lobby_members" USING btree ("player_id");