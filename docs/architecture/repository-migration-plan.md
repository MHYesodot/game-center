# Repository Migration Plan

## Objective

Move from the current prototype layout to the target Game Center platform structure without pretending the existing prototypes are production-ready platform components.

Phase 1 uses a modular monolith for platform backend domains rather than service-per-domain deployment.

## Guiding Rules

1. Preserve prototype code until replacement architecture is established.
2. Do not delete gameplay references before equivalent contracts and target directories exist.
3. Prefer move + replace plans over silent drift.
4. Keep platform and game code physically separated as the migration proceeds.

## Current to Target Mapping

| Current Path | Target Path | Action | Notes |
| --- | --- | --- | --- |
| `apps/portal` | `apps/web` | `MOVE` + `REFACTOR` | Keep React/Vite direction, add TanStack Query, replace hardcoded catalog coupling with contracts |
| `services/lobby-server` | `services/platform-api` | `REPLACE` | Rebuild as NestJS modular monolith and move only platform concerns |
| `apps/board-arena` | `games/prototypes/board-arena` | `MOVE AS PROTOTYPE REFERENCE` | No major gameplay refactor in Phase 1 |
| board logic inside `services/lobby-server` | `games/production/board/...` | `DO NOT MIGRATE NOW` | Production board direction is web or Godot client plus authoritative Go server |
| `apps/arcade-runner` | `games/prototypes/arcade-runner` | `MOVE AS PROTOTYPE REFERENCE` | Production replacement must use Phaser, PixiJS, or Godot |
| `apps/flight-sim` | `games/prototypes/flight-sim` | `MOVE AS PREVIEW REFERENCE` | Three.js preview only; UE5 product path remains separate |
| root docs | `docs/architecture`, `docs/adr`, `docs/contracts`, `docs/development` | `EXPAND` | Make docs authoritative before major code changes |
| root workspace packages | `packages/contracts`, `packages/config`, `packages/observability`, `packages/ui`, `packages/platform-sdk-ts` | `ADD` | Shared code must be contracts/config/tooling first, not gameplay logic |

## Planned Migration Phases

### Phase 0: Freeze architecture direction

- Establish source-of-truth documents.
- Write ADRs.
- Record audit and violations.
- Introduce Docker-first DEV design.

### Step 1: Update architecture docs and ADRs

- Update the source of truth to reflect the modular monolith decision.
- Update ADRs to replace service-per-domain Phase 1 assumptions.
- Add ORM decision ADR.

### Step 2: Create target directories

- Add target top-level directories.
- Add contracts package scaffolding.
- Add infrastructure directories and compose conventions.
- Add shared config conventions.

### Step 3: Normalize the platform web app

- Rename `apps/portal` to `apps/web`.
- Add TanStack Query.
- Shift API usage to gateway-routed endpoints.
- Remove direct prototype assumptions from UI copy and routing.

### Step 4: Move gameplay prototypes

- Move board, arcade, and simulation prototypes under `games/prototypes`.
- Do not perform major gameplay rewrites.

### Step 5: Create minimal `services/platform-api`

- Create `services/platform-api` in NestJS.
- Create module boundaries for auth, players, catalog, social, lobby, matchmaking, and sessions.
- Keep all platform modules in one runtime.

### Step 6: Add infrastructure connectivity

- Connect the platform API to PostgreSQL, Redis, and NATS.
- Add health, readiness, config validation, and structured logging.

### Step 7: Introduce contracts and SDKs

- Add versioned HTTP contracts for platform services.
- Add event schemas for NATS JetStream.
- Add `game-server` platform contract.
- Add TypeScript SDK package for platform consumers.

### Step 8: Move only platform concerns from the old prototype

- Move only catalog and lobby platform concerns into `platform-api`.
- Do not move board rules.

### Step 9: Retire old `lobby-server`

- Stop using it for the default development environment.
- Keep only as a deprecated prototype reference until removal is safe.

### Later Phase: Add allocator abstraction

- Introduce `GameServerAllocator` contract in session orchestration.
- Use Docker-backed DEV allocation only behind the abstraction.
- Keep Docker implementation out of platform API surface.

## Deferred Items

The following are intentionally deferred until after architecture approval:

- extracted microservices per domain
- production-grade auth flow
- full database migrations for all future services
- full game runtime selection per product beyond prototype classification
- production implementation of new game clients
- Kubernetes manifests

## Exit Criteria For This Architecture Phase

1. Architecture source of truth exists.
2. ADR set exists and is internally consistent.
3. Docker-first DEV shape is documented.
4. Initial compose design exists.
5. Existing code is clearly classified as keep/refactor/move/replace/prototype.