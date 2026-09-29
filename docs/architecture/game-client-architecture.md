# Game Client Architecture

Status: Accepted source of truth for production game client architecture

## Scope

This document defines mandatory architecture rules for production game clients.

It does not authorize building a production game now.

Current work is limited to architecture correction, prototype classification, ADRs, and migration guidance.

## Hard Decisions

### Engine Direction

- Board games: web or Godot depending on title, backed by an authoritative Go server.
- Arcade games: Phaser, PixiJS, or Godot.
- High-end racing, flight, and simulation games: Unreal Engine 5 with C++ and Blueprints where appropriate, backed by Unreal dedicated server.
- Three.js is not a production simulation engine.

Three.js is allowed only for:

- 3D preview
- model viewer
- lightweight browser visualization
- prototype

Vanilla Canvas or DOM gameplay implementation is allowed only when there is a documented technical justification approved before scale-up.

## Mandatory Client Boundaries

Every production game client must separate at least:

```text
bootstrap
domain
state
systems
input
rendering
ui
localization
platform-adapter
tests
```

No production client may collapse those concerns into a monolithic `main.ts` that mixes markup, state, input, simulation, rendering, HUD, and platform calls.

## UI Rules

Application UI must use the framework or engine UI architecture that matches the product runtime.

Forbidden pattern:

```ts
app.innerHTML = `...large UI...`
```

Allowed exception:

- minimal root bootstrap only

## Localization Invariant

Production game clients must follow the same i18n invariant as the platform:

- no hard-coded user-facing text
- locale-driven directionality where relevant
- translation keys and locale bundles owned as explicit assets

## Design Token Invariant

Game Center UI must consume shared design tokens.

Game-specific HUDs may introduce game-specific tokens, but those tokens must also be centralized and tokenized rather than embedded ad hoc across rendering or UI code.

## Rendering and State Separation

Rendering is a projection of game state, not the source of truth.

Required flow:

```text
Input
  -> Game Systems
  -> Game State
  -> Renderer
```

Renderers may read state snapshots and emit visuals, but they must not become the authoritative owner of domain state.

## Platform Integration Boundary

Game systems must not call the platform API directly.

Production clients must depend on an adapter such as:

```ts
interface PlatformGameAdapter {
  getSession(): Promise<GameSession>
  reportReady(): Promise<void>
  reportResult(result: GameResult): Promise<void>
  submitTelemetry(event: GameTelemetryEvent): Promise<void>
}
```

The adapter boundary exists to keep platform integration replaceable and to prevent gameplay systems from learning transport details.

## Prototype Policy

The following paths are classified as `PROTOTYPE ONLY`:

- `games/prototypes/board-arena`
- `games/prototypes/arcade-runner`
- `games/prototypes/flight-sim`

Those clients may be used for reference, visual exploration, interaction experiments, and migration planning.

They must not be production-hardened in place.

## Migration Guidance

### Board titles

- Preserve reusable interaction ideas and visual references.
- Rebuild the client with proper module boundaries.
- Move authority to a dedicated Go game server.

### Arcade titles

- Preserve pacing, camera feel, and obstacle concepts where useful.
- Rebuild on Phaser, PixiJS, or Godot.
- Separate loop systems from UI and platform integration from day one.

### High-end 3D titles

- Preserve mission-bay visual direction and metadata concepts only.
- Do not evolve the Three.js preview into the production simulation client.
- Rebuild the production path in Unreal Engine 5.