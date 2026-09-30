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

## Seed Strategy

- DEV and integration tests use a deterministic, idempotent catalog seed.
- Seed data is stored once in the catalog persistence layer and reused by the migration/seed scripts and integration tests.
- Seeded records validate against both `en` and `he` translation bundles.

## Commands

- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:seed`
- `npm run test:integration`

## Docker-first Workflow

- Host-run integration and smoke flows expect the DEV overlay to publish PostgreSQL, Redis, and NATS to localhost.
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis nats` is the baseline dependency stack for local persistence validation.