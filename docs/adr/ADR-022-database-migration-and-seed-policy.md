# ADR-022 Database Migration And Seed Policy

Status: Accepted

## Context

Catalog is the first persisted platform domain. The repository needs an explicit policy for migration generation, migration application, reference-data application, and deployment behavior across development and production-like environments.

Implicit runtime schema generation or environment-blind seed commands would make deployment behavior unsafe and would blur the boundary between reference data and test fixtures.

## Decision

- Use committed Drizzle migrations as the only migration artifact applied outside local schema authoring.
- Treat `db:generate` as a development-only authoring command.
- Apply migrations through a separate `db:migrate` command.
- Apply catalog reference data through a separate `db:seed` command.
- Provide `db:prepare` as the explicit local convenience wrapper for `db:migrate` followed by `db:seed`.

## DEV

- Developers start the Docker-first stack explicitly.
- Developers run `npm run db:prepare` after bringing up the stack.
- `docker compose up` must not generate migrations automatically.

## TEST

- Tests create isolated databases.
- Tests run committed migrations.
- Tests apply deterministic reference data only where required.
- Tests destroy or isolate their database afterward.

## CI

- CI uses fresh PostgreSQL services.
- CI runs migrations before integration or E2E checks.
- CI applies reference data only for suites that require it.

## STAGING

- Staging deployments use a dedicated migration step before application rollout.
- Application runtime does not generate migrations.
- Reference data remains an explicit operator-controlled action.

## PRODUCTION

- Production migrations are an explicit deployment step using committed SQL migrations.
- Application containers must not generate migrations at startup.
- Production does not auto-apply DEV-style reference data.

## Seed Policy

- Current catalog games are classified as catalog reference data.
- Reference data is distinct from synthetic fixtures used only for testing.
- `db:seed` is blocked under `NODE_ENV=production` unless `ALLOW_PRODUCTION_CATALOG_REFERENCE_DATA=true` is intentionally set.

## Rollback Policy

- Default strategy is forward-fix migrations.
- High-risk deployments require backup and restore planning rather than assuming automatic down migrations.

## Consequences

- Migration ownership remains with `services/platform-api` and the catalog persistence layer.
- Local setup becomes explicit and reproducible.
- CI proves migration-from-empty plus reference-data-backed catalog reads.
- Production runtime behavior is safer because schema mutation and reference-data application are not hidden inside normal application startup.