# Database Migrations

## Scope

This policy currently covers committed Drizzle migrations for the active Platform API persistence domains: Catalog, Lobby, and Matchmaking.

It does not yet authorize Session persistence or future domains that have not reached an approved persisted roadmap phase.

## Commands

- `npm run db:generate`: development-only command that creates new migration artifacts from schema changes. Generated migrations must be reviewed and committed.
- `npm run db:status`: Drizzle `check` command used as the nearest status equivalent for the committed migration folder.
- `npm run db:migrate`: applies committed migrations only.
- `npm run db:seed`: applies catalog reference data.
- `npm run db:prepare`: runs `db:migrate` then `db:seed`.

## Environment Policy

### DEV

- Start services with Docker.
- Run `npm run db:prepare` explicitly.
- `docker compose up` must not generate migrations automatically.
- DEV uses committed, forward-only migrations only.

### TEST

- Integration tests create an isolated PostgreSQL database.
- Tests run committed migrations.
- Tests apply deterministic catalog reference data when required.
- Tests clean up the isolated database after execution.
- Tests do not use the shared DEV schema as their source of truth.

### CI

- CI starts a fresh PostgreSQL service.
- CI runs `npm run db:migrate`.
- CI runs `npm run db:seed` only for suites that require catalog reference data.
- CI then runs integration and E2E validation.

### STAGING

- Build artifacts are created before deployment.
- A dedicated migration step applies committed migrations before application rollout.
- Application containers do not generate migrations at runtime.
- Reference data application is explicit and separate from normal application startup.

### PRODUCTION

- Production migrations are an explicit deployment step.
- Production runtime does not generate migrations.
- Production runtime does not auto-apply DEV-style reference data.
- `npm run db:seed` is blocked when `NODE_ENV=production` unless `ALLOW_PRODUCTION_CATALOG_REFERENCE_DATA=true` is intentionally set.

## Reference Data Policy

- Current catalog games are treated as catalog reference data.
- Reference data is distinct from test fixtures such as fake users, fake lobbies, or fake sessions.
- Future admin/content provisioning may replace command-driven reference-data application, but that is outside this slice.

## Rollback Policy

- The default migration policy is forward-fix, not automatic down migrations.
- High-risk changes should rely on backup and restore plans rather than assuming reversible runtime migrations.

## Destructive Migration Policy

The following require explicit review and deployment planning:

- `DROP TABLE`
- `DROP COLUMN`
- destructive type narrowing
- bulk data rewrites

Required safeguards:

- reviewed committed migration SQL
- backup strategy appropriate to the environment
- rollout plan for staging and production

## Failure And Recovery

- If migrations fail, fix the migration or the target environment before declaring the application ready.
- Readiness must not be treated as healthy if PostgreSQL is unavailable.
- Catalog endpoints must fail rather than falling back to local preview data when the database is unavailable.

## Ownership

- Catalog migration files remain under `services/platform-api/drizzle`.
- Migration ownership stays with the Platform API catalog persistence implementation.