# ADR-021 Catalog Persistence Model

Status: Accepted

## Context

Foundation Slice 2 introduces the first persisted platform domain. Catalog already owns game discovery, manifest metadata, and semantic localization keys, but it previously served in-memory seed data and the web app kept a runtime preview fallback.

The next step must preserve the modular-monolith boundary, keep translation ownership outside the database, and avoid starting from table design before the domain split is explicit.

## Decision

- Persist Catalog in PostgreSQL through Drizzle ORM and Drizzle Kit.
- Model `GameDefinition` as the persistent root for identity, lifecycle, tags, category, and semantic localization keys.
- Model `GameVersion`, `GameCapabilities`, `GamePlatformAvailability`, and `GameDistributionMetadata` as explicit version-scoped value objects.
- Assemble `GameManifest` as a read projection returned by the catalog repository and service layer.
- Expose persisted reads through `GET /api/games` and `GET /api/games/:slug`.
- Remove runtime fake fallback behavior from the platform web app; the client may keep local presentation metadata, but catalog entries themselves must come from the live API.

## Persistence Shape

Use normalized relational tables for the current slice:

- `catalog_games`
- `catalog_game_versions`
- `catalog_game_capabilities`
- `catalog_game_platform_availability`
- `catalog_game_distribution_metadata`

The repository owns the joins that rebuild the domain aggregate and its manifest projection.

## Alternatives Considered

- single JSONB manifest row per game
- flat single table with repeated version and capability columns
- continuing in-memory catalog reads with no persisted source of truth

## Consequences

- Catalog becomes the first real PostgreSQL-backed platform domain.
- Translation values remain in shared locale bundles rather than being copied into the database.
- DEV and CI must run migrations and seeds before smoke or integration flows that depend on catalog data.
- Lobby, Matchmaking, Sessions, and allocator persistence remain out of scope for this slice.