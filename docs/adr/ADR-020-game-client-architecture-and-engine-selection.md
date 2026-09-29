# ADR-020 Game Client Architecture And Engine Selection

Status: Accepted

## Context

The repository contains prototype board, arcade, and 3D preview clients. Those assets are useful references, but they do not represent acceptable production game-client architecture.

Without an explicit decision, the repository risks accidental hardening of prototype DOM, canvas, or Three.js implementations into production paths.

## Decision

Adopt the following production rules:

- `games/prototypes/board-arena`, `games/prototypes/arcade-runner`, and `games/prototypes/flight-sim` are classified as `PROTOTYPE ONLY`.
- No current prototype client may be expanded into production architecture in place.
- Board production direction is a web or Godot client depending on title, backed by an authoritative Go server.
- Arcade production direction is Phaser, PixiJS, or Godot.
- High-end racing, flight, and simulation production direction is Unreal Engine 5 with C++ and Blueprints where appropriate, backed by Unreal dedicated server.
- Three.js may be used only for preview, viewer, lightweight visualization, or prototype surfaces.
- Vanilla DOM/canvas gameplay clients require a documented exception before production use.
- Production game clients must separate bootstrap, domain, state, systems, input, rendering, UI, localization, platform adapter, and tests.
- Rendering may project state but must not become the authoritative source of truth.
- Game systems must not call platform HTTP APIs directly; they must depend on an explicit platform adapter boundary.
- Production game clients must follow the platform localization and design-token invariants.

## Alternatives Considered

- Evolving the existing prototypes in place until they become production-ready
- Standardizing all game clients on browser TypeScript with handcrafted DOM or canvas loops
- Treating Three.js as the default production path for simulation products
- Allowing every game team to choose an engine without an architecture boundary

## Consequences

- Prototype gameplay expansion is intentionally stopped until a production client architecture is started in the correct runtime.
- Architecture correction takes priority over feature growth in the prototype clients.
- Board, arcade, and simulation titles each keep an approved runtime path aligned to their workload.
- Future production client work must start from the documented boundaries rather than from monolithic `main.ts` prototypes.
- Migration planning may reuse concepts, visuals, and interaction references from prototypes, but not their structural architecture.