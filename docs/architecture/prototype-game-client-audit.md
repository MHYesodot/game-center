# Prototype Game Client Audit

Status: Accepted reference audit for architecture correction

## Scope

This audit classifies the existing prototype clients strictly as prototype assets.

They are not production architecture and are not to be expanded into production clients.

## Board Arena

- Path: `games/prototypes/board-arena`
- Classification: `PROTOTYPE ONLY`
- Technology: TypeScript, Vite, DOM-rendered board UI, CSS
- Purpose: interaction and visual reference for a board-style lobby/game surface
- Architectural violations:
  - single-file `src/main.ts` mixes bootstrap, domain state, input handling, rendering, UI strings, and win detection
  - uses large `app.innerHTML` application markup
  - hard-coded user-facing text with no localization layer
  - rendering code mutates authoritative state directly
  - no platform adapter boundary
  - no layered tests or modular separation
- What may be reused:
  - visual tone and board layout ideas
  - interaction pacing for token placement
  - candidate UX patterns for status and player panels
- What must be discarded:
  - monolithic file structure
  - direct DOM-driven application composition
  - embedded winner detection as the assumed production client model
  - any implication that browser DOM state is authoritative
- Recommended production replacement:
  - web or Godot board client depending on title
  - authoritative Go board server
  - explicit client layers for bootstrap, domain, state, systems, input, rendering, UI, localization, platform adapter, and tests

## Arcade Runner

- Path: `games/prototypes/arcade-runner`
- Classification: `PROTOTYPE ONLY`
- Technology: TypeScript, Vite, Canvas 2D, CSS
- Purpose: gameplay feel reference for a lightweight reflex-based arcade loop
- Architectural violations:
  - single-file `src/main.ts` mixes markup, HUD, input, state, collision, update loop, rendering, and score display
  - uses large `app.innerHTML` application markup
  - direct canvas loop without production engine architecture
  - hard-coded user-facing text with no localization layer
  - no platform adapter boundary
  - HUD and rendering tightly coupled to gameplay state mutation
- What may be reused:
  - pacing targets and lane/obstacle concepts
  - feel references for score and speed feedback
  - rough visual composition of gameplay area versus side info
- What must be discarded:
  - single-file game loop architecture
  - implicit assumption that vanilla canvas is the production runtime
  - direct DOM HUD wiring and platform-ready claims
  - mixed gameplay/render/UI ownership
- Recommended production replacement:
  - Phaser, PixiJS, or Godot client selected per title complexity
  - explicit separation of systems, state, rendering, HUD UI, localization, and platform adapter
  - authoritative backend only where the product requires validation or anti-cheat controls

## Flight Sim

- Path: `games/prototypes/flight-sim`
- Classification: `PROTOTYPE ONLY`
- Technology: TypeScript, Vite, Three.js, CSS
- Purpose: browser-side mission-bay and 3D preview reference
- Architectural violations:
  - single-file `src/main.ts` mixes bootstrap, scene setup, UI markup, render loop, and static telemetry labels
  - uses large `app.innerHTML` application markup
  - Three.js is used as if it could be the scaling direction for production simulation
  - hard-coded user-facing text with no localization layer
  - no platform adapter boundary
  - no separation between preview rendering concerns and production simulation concerns
- What may be reused:
  - art direction reference for mission-bay presentation
  - candidate metadata panels and staging concepts
  - high-level camera and silhouette ideas for preview surfaces
- What must be discarded:
  - the assumption that Three.js is a production simulation engine
  - monolithic scene/bootstrap/UI composition
  - direct mixing of preview visuals with implied gameplay architecture
  - browser-only rendering path as the target for full-scale flight or racing products
- Recommended production replacement:
  - Unreal Engine 5 client with C++ and Blueprints where appropriate
  - Unreal dedicated server for authoritative simulation sessions
  - keep Three.js only for preview, viewer, or lightweight browser visualization surfaces