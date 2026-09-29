# ADR-009 Game Engine Selection Rules

Status: Accepted

## Context

Game Center must support many game categories. The platform must not force one engine for all gameplay workloads, but unrestricted engine choice would create integration and maintenance drift.

## Decision

Adopt the following defaults:

- Board / turn-based authoritative servers -> Go
- Web arcade titles -> Phaser or PixiJS unless justified otherwise
- High-end 3D / simulation -> Unreal Engine 5 with C++ / Blueprints
- Three.js -> previews, visualizations, lightweight browser experiences

Unity may be used only with a concrete justification for a specific game.

## Alternatives Considered

- Standardizing every game on React web tech
- Standardizing all 3D on Three.js
- Allowing unrestricted engine choice without review

## Consequences

- Current Three.js and canvas prototypes remain references, not final engine policy.
- New game products require an explicit runtime decision before implementation scale-up.