CREATE TABLE "matchmaking_requests" (
	"request_id" text PRIMARY KEY NOT NULL,
	"requester_type" text NOT NULL,
	"requester_id" text NOT NULL,
	"game_id" text NOT NULL,
	"queue_key" text NOT NULL,
	"queue_type" text NOT NULL,
	"platform" text NOT NULL,
	"region" text,
	"game_version" text NOT NULL,
	"protocol_version" text NOT NULL,
	"status" text NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"matched_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"terminal_outcome" text,
	"source_lobby_id" text,
	"active_proposal_id" text
);
--> statement-breakpoint
CREATE TABLE "match_proposals" (
	"proposal_id" text PRIMARY KEY NOT NULL,
	"match_id" text,
	"queue_key" text NOT NULL,
	"game_id" text NOT NULL,
	"queue_type" text NOT NULL,
	"platform" text NOT NULL,
	"region" text,
	"game_version" text NOT NULL,
	"protocol_version" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"matched_at" timestamp with time zone,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "match_proposal_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"request_id" text NOT NULL,
	"player_id" text NOT NULL,
	"acceptance_status" text NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "match_proposal_members" ADD CONSTRAINT "match_proposal_members_proposal_id_match_proposals_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."match_proposals"("proposal_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_proposal_members" ADD CONSTRAINT "match_proposal_members_request_id_matchmaking_requests_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."matchmaking_requests"("request_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "matchmaking_requests_active_requester_unique_idx" ON "matchmaking_requests" USING btree ("requester_type","requester_id") WHERE "matchmaking_requests"."status" in ('queued', 'proposed');--> statement-breakpoint
CREATE INDEX "matchmaking_requests_queue_status_requested_idx" ON "matchmaking_requests" USING btree ("queue_key","status","requested_at");--> statement-breakpoint
CREATE INDEX "matchmaking_requests_expiry_idx" ON "matchmaking_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "matchmaking_requests_active_proposal_idx" ON "matchmaking_requests" USING btree ("active_proposal_id");--> statement-breakpoint
CREATE INDEX "matchmaking_requests_game_status_idx" ON "matchmaking_requests" USING btree ("game_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "match_proposals_match_id_unique_idx" ON "match_proposals" USING btree ("match_id") WHERE "match_proposals"."match_id" is not null;--> statement-breakpoint
CREATE INDEX "match_proposals_queue_status_idx" ON "match_proposals" USING btree ("queue_key","status");--> statement-breakpoint
CREATE INDEX "match_proposals_expiry_idx" ON "match_proposals" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "match_proposal_members_proposal_request_unique_idx" ON "match_proposal_members" USING btree ("proposal_id","request_id");--> statement-breakpoint
CREATE INDEX "match_proposal_members_request_idx" ON "match_proposal_members" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "match_proposal_members_player_idx" ON "match_proposal_members" USING btree ("player_id");