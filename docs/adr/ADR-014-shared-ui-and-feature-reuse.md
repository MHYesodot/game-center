# ADR-014 Shared UI and Feature Reuse

Status: Accepted

## Context

The repository will support several platform clients. Reuse is necessary, but false abstractions create brittle shared code and app-to-app coupling.

## Decision

Define strict reuse boundaries:

- generic shared UI belongs in `packages/ui`
- feature-specific UI stays with its owning feature until reuse is clearly stable
- apps must not import other apps directly
- desktop and mobile reuse must happen through packages, not through `apps/web`

## Alternatives Considered

- sharing directly from `apps/web`
- moving anything reused twice into shared packages
- fully separate per-app duplication everywhere

## Consequences

- shared packages stay intentional
- desktop and mobile can grow without coupling to web implementation folders
- future lint rules should enforce app-boundary imports