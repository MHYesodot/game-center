# ADR-004 Game Server Model

Status: Accepted

## Context

Different games require different runtimes, authority models, and server processes. The platform must support dedicated game servers without coupling platform APIs to container internals.

## Decision

Adopt an explicit game server model:

- Session Service creates session metadata.
- Session Service calls a `GameServerAllocator` abstraction.
- Dedicated game server instances are allocated per product/runtime needs.
- Game servers report lifecycle and results back through contracts.

DEV may use Docker-backed allocation. Production may use Kubernetes / Agones or equivalent later.

## Alternatives Considered

- Running gameplay inside platform services
- Exposing Docker APIs directly from platform business services
- Using a single generic game server process for all products

## Consequences

- Dedicated orchestration becomes pluggable.
- Board games, arcade servers, and simulation servers can evolve independently.