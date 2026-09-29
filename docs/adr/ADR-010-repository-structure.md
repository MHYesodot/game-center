# ADR-010 Repository Structure

Status: Accepted

## Context

The repository already uses a monorepo, but current top-level grouping does not clearly separate platform apps, platform services, game products, shared packages, SDKs, and infrastructure.

## Decision

Keep a monorepo and adopt a runtime-aware, boundary-aware structure:

- `apps/` for platform-facing applications
- `services/platform-api` for the NestJS modular monolith in Phase 1
- `services/realtime-gateway` for connection-heavy runtime separation
- `games/` for independent game products
- `packages/` for shared contracts/config/sdk implementation support
- `infrastructure/` for container, monitoring, and deployment assets
- `docs/` for architecture and ADRs

## Alternatives Considered

- Multiple repositories per game and service from the current stage
- Flat monorepo without platform/game separation
- Keeping prototype game clients under `apps/` permanently

## Consequences

- Current prototype paths will move.
- The repository becomes clearer for ownership, tooling, and runtime isolation.
- `npm workspaces` remains the monorepo tool for Phase 1.
- Future CI/CD can target boundaries more predictably.