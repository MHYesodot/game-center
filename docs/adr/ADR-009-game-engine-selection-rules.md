# ADR-009 Game Engine Selection Rules

Status: Accepted

## Context

Game Center must support many game categories. The platform must not force one engine for all gameplay workloads, but unrestricted engine choice would create integration and maintenance drift.

## Decision

Adopt the following defaults:

- Board / turn-based authoritative servers -> Go
- Board clients -> web or Godot depending on title
- Web arcade titles -> Phaser, PixiJS, or Godot unless justified otherwise
- High-end 3D / simulation -> Unreal Engine 5 with C++ / Blueprints and Unreal dedicated server
- Three.js -> previews, visualizations, lightweight browser experiences, and prototypes only
- Vanilla Canvas / DOM gameplay clients -> prototype-only unless a concrete technical exception is documented

Unity may be used only with a concrete justification for a specific game.

## Alternatives Considered

- Standardizing every game on React web tech
- Standardizing all 3D on Three.js
- Allowing unrestricted engine choice without review

## Consequences

- Current Three.js and canvas prototypes remain references, not final engine policy.
- New game products require an explicit runtime decision before implementation scale-up.
- Production game clients must follow the structural rules later formalized in ADR-020.