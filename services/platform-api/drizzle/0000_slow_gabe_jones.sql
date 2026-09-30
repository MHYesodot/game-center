CREATE TABLE "catalog_game_capabilities" (
	"version_id" integer PRIMARY KEY NOT NULL,
	"multiplayer" boolean NOT NULL,
	"ranked" boolean NOT NULL,
	"spectators" boolean NOT NULL,
	"replays" boolean NOT NULL,
	"private_rooms" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_game_distribution_metadata" (
	"version_id" integer PRIMARY KEY NOT NULL,
	"minimum_version" text,
	"download_strategy" text,
	"launch_strategy" text,
	"architecture" text
);
--> statement-breakpoint
CREATE TABLE "catalog_game_platform_availability" (
	"version_id" integer PRIMARY KEY NOT NULL,
	"web" boolean NOT NULL,
	"windows" boolean NOT NULL,
	"macos" boolean NOT NULL,
	"android" boolean NOT NULL,
	"ios" boolean NOT NULL,
	"ipados" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_game_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"game_version" text NOT NULL,
	"protocol_version" text NOT NULL,
	"build_version" text NOT NULL,
	"client_runtime" text NOT NULL,
	"engine" text NOT NULL,
	"server_type" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_games" (
	"game_id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"status" text NOT NULL,
	"category" text NOT NULL,
	"category_key" text NOT NULL,
	"display_name_key" text NOT NULL,
	"description_key" text NOT NULL,
	"tagline_key" text NOT NULL,
	"tags" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_game_capabilities" ADD CONSTRAINT "catalog_game_capabilities_version_id_catalog_game_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."catalog_game_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_game_distribution_metadata" ADD CONSTRAINT "catalog_game_distribution_metadata_version_id_catalog_game_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."catalog_game_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_game_platform_availability" ADD CONSTRAINT "catalog_game_platform_availability_version_id_catalog_game_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."catalog_game_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_game_versions" ADD CONSTRAINT "catalog_game_versions_game_id_catalog_games_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."catalog_games"("game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_game_versions_tuple_idx" ON "catalog_game_versions" USING btree ("game_id","game_version","protocol_version","build_version");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_game_versions_active_idx" ON "catalog_game_versions" USING btree ("game_id") WHERE "catalog_game_versions"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_games_slug_idx" ON "catalog_games" USING btree ("slug");