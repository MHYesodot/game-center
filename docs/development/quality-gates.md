# Quality Gates

The local source of truth for quality enforcement is the root validation pipeline.

The current machine-enforced scope for Foundation Slice 1.2 is the active platform foundation surfaces:

- [apps/web](apps/web)
- [packages](packages)
- [services/platform-api](services/platform-api)

Legacy prototype clients outside those surfaces are intentionally excluded until they are migrated onto the shared token and localization architecture.

The enforced gates are:

- `npm run lint` runs workspace linting for the web app and platform API.
- `npm run typecheck` compiles every workspace that exposes a build script.
- `npm run validate:i18n` enforces locale parity, placeholder parity, list shape parity, and translation key usage auditing.
- `npm run validate:design` fails when raw color, gradient, or motion literals appear outside approved token-definition files.
- `npm run validate:architecture` fails on hard-coded UI text in React render paths, invalid import boundaries, NestJS usage in domain layers, cross-module internal imports, and circular dependencies.
- `npm run test:unit` runs unit tests for validator gates and pure domain helpers.
- `npm run test:integration` runs isolated PostgreSQL catalog integration tests, including migration-from-empty, reference-data application, mapper coverage, repository reads, and catalog HTTP contract checks.
- `npm run test:e2e` runs Playwright smoke tests for locale direction, catalog list/detail flows, semantic not-found behavior, API health, and accessibility.

The primary local developer entrypoints are:

- `npm run validate` for static contract and architecture checks.
- `npm run db:prepare` for explicit local catalog migration plus reference-data application.
- `npm run ci:quality` for the full local CI-equivalent quality pass except browser installation.

CI mirrors the same gates in [.github/workflows/ci.yml](.github/workflows/ci.yml), then validates both Docker Compose configurations with:

- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`

Approved exceptions are intentionally narrow:

- Raw design literals are allowed only in token-definition and approved foundation files, currently [packages/design-tokens/src/index.ts](packages/design-tokens/src/index.ts) and [apps/web/src/index.css](apps/web/src/index.css).
- UI text in render paths must come from translation keys, while technical identifiers such as routes, command names, `data-testid`, and translation keys remain allowed as implementation details.