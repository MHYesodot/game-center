# Catalog Persistence

Status: Accepted source of truth for Foundation Slice 2 catalog persistence

## Scope

This document covers only the Catalog module persistence introduced in Foundation Slice 2. It does not authorize persistence work for Lobby, Matchmaking, Sessions, or game-server allocation.

## Domain Split

- `GameDefinition` is the persistent root for identity, lifecycle state, category, tags, and semantic localization keys.
- `GameVersion` owns the active compatibility tuple and runtime metadata.
- `GameCapabilities`, `GamePlatformAvailability`, and `GameDistributionMetadata` are version-scoped value objects.
- `GameManifest` is the API projection assembled from the current active version plus the definition fields required by clients.

## Relational Model

The catalog persistence model uses normalized relational tables inside the Platform API boundary:

- `catalog_games`
- `catalog_game_versions`
- `catalog_game_capabilities`
- `catalog_game_platform_availability`
- `catalog_game_distribution_metadata`

Rules:

- `catalog_games.game_id` is the canonical identifier.
- `catalog_games.slug` is unique and stable for routing.
- `catalog_game_versions` stores historical versions, but exactly one active version is allowed per game.
- Child tables are keyed by `catalog_game_versions.id` and represent the active version's declared capability surfaces.

## Read Path

- `CatalogRepository.listGames()` joins the normalized tables and returns domain aggregates.
- `CatalogRepository.getGameBySlug(slug)` returns a single aggregate or `null`.
- `CatalogService` projects those aggregates into the shared contracts package, preserving semantic localization keys for the web client.
- Public API reads are split by use case:
	- `GET /api/games` for catalog list screens
	- `GET /api/games/:slug` for direct detail reads and deep-link-compatible clients
- The web detail page must fetch by slug directly. It must not use the in-memory list response as the source of truth for detail.

## Detail Error Contract

- Missing games return HTTP `404` with `{ "code": "CATALOG_GAME_NOT_FOUND" }`.
- The API does not return localized display text for list, detail, or error contracts.
- Unknown catalog failures remain non-semantic server errors and must not fall back to local preview data.

## Version Selection Rule

- The current public catalog always projects the single row marked `catalog_game_versions.is_active = true`.
- This is the explicit eligibility rule for both list and detail reads.
- Draft, disabled, or future version-state modeling is not implemented in this slice. Until it exists, non-active versions are not eligible for the public catalog API.

## Seed Strategy

- Catalog data in this slice is treated as reference data, not throwaway gameplay fixtures.
- DEV and integration tests use deterministic, idempotent catalog reference data application.
- Reference data is stored once in the catalog persistence layer and reused by the migration/seed scripts and integration tests.
- Seeded records validate against both `en` and `he` translation bundles.
- `npm run db:seed` is blocked when `NODE_ENV=production` unless `ALLOW_PRODUCTION_CATALOG_REFERENCE_DATA=true` is explicitly set.

## Schema Audit

| Table | Purpose | Primary Key | Foreign Keys | Unique Constraints | JSONB Fields |
| --- | --- | --- | --- | --- | --- |
| `catalog_games` | Canonical game identity, lifecycle state, category, tags, and semantic localization keys | `game_id` | none | unique `slug` | none |
| `catalog_game_versions` | Active and historical compatibility/runtime tuples per game | `id` | `game_id -> catalog_games.game_id` | unique `(game_id, game_version, protocol_version, build_version)`; unique active row per `game_id` where `is_active = true` | none |
| `catalog_game_capabilities` | Version-scoped capability flags | `version_id` | `version_id -> catalog_game_versions.id` | none beyond PK | none |
| `catalog_game_platform_availability` | Version-scoped platform matrix | `version_id` | `version_id -> catalog_game_versions.id` | none beyond PK | none |
| `catalog_game_distribution_metadata` | Version-scoped minimum-version and launch/distribution metadata | `version_id` | `version_id -> catalog_game_versions.id` | none beyond PK | none |

## JSONB Audit

- Catalog persistence uses no JSONB fields.
- Versions, platform availability, capabilities, and distribution metadata are all modeled explicitly in relational tables.

## Commands

- `npm run db:generate`
- `npm run db:status`
- `npm run db:migrate`
- `npm run db:seed`
- `npm run db:prepare`
- `npm run test:integration`

## Docker-first Workflow

- Host-run integration and smoke flows expect the DEV overlay to publish PostgreSQL, Redis, and NATS to localhost.
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis nats` is the baseline dependency stack for local persistence validation.
- `docker compose up` or `npm run docker:dev` does not generate migrations or apply destructive schema changes automatically.
- Catalog migrations are applied only through committed migration artifacts and explicit commands.