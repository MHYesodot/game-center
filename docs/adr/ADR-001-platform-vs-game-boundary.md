# ADR-001 Platform vs Game Boundary

Status: Accepted

## Context

The current prototype mixes lobby orchestration with game-specific rules. The platform must support many game categories and runtimes without embedding per-game logic.

## Decision

Establish a hard boundary:

- Platform services own cross-game capabilities.
- Game products own game rules, state, simulation, authoritative validation, and gameplay networking.

Platform services may exchange session metadata and result envelopes with games, but may not implement game-rule logic.

## Alternatives Considered

- Shared mixed services per game category
- Platform-owned generic gameplay services
- Embedding small game rules inside lobby/session services

## Consequences

- Existing prototype lobby server cannot become the final lobby service as-is.
- Contracts and manifests become mandatory integration surfaces.
- Dedicated game server boundaries are preserved for future scale.