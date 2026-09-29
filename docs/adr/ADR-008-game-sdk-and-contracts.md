# ADR-008 Game SDK and Contracts

Status: Accepted

## Context

The platform must support independent game products implemented in multiple languages without embedding custom logic inside platform code.

## Decision

Define versioned contracts first, then SDKs on top of those contracts.

Initial contract families:

- domain model types
- API DTOs
- integration events
- game-server contracts

Initial SDK directions:

- TypeScript
- Go
- C++
- C#

## Alternatives Considered

- Platform-specific ad hoc integration logic per game
- SDK-first without canonical contracts
- One-off APIs negotiated per product

## Consequences

- Platform-to-game integration becomes explicit and testable.
- Version compatibility can be enforced in session creation.
- Domain entities are no longer treated as API response shapes by default; DTOs and integration events evolve separately from core domain types.