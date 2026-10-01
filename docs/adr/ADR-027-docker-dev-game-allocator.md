# ADR-027 Docker DEV Game Allocator

Status: Accepted

## Context

P02 locked the provider-neutral allocation contract and durable recovery semantics, but stable runtime still intentionally returned semantic allocation failure through the `unavailable` provider. P03 needs a real DEV and CI allocator so session flows can hand players to an actual game-server process without starting Kubernetes, Agones, or Realtime Gateway work.

## Decision

- add a `docker` allocation provider behind the existing `GameServerAllocator` registry
- keep `unavailable` as the stable default and require explicit `ALLOCATION_PROVIDER=docker` selection for real container provisioning
- isolate `dockerode` behind an allocation-infrastructure runtime client boundary
- create one managed container per durable allocation using deterministic names and labels
- wait for Docker `HEALTHCHECK` success before returning a durable ready allocation
- use dynamic published host ports and a configured public host in the returned connection descriptor
- expose Docker readiness through `/health/ready` only when the Docker provider is enabled
- provide orphan cleanup for managed containers that no longer correspond to an active durable Docker allocation

## Consequences

- DEV and CI can now prove a real session-to-container handoff without changing the public contract introduced in P02
- allocation orchestration remains provider-neutral and ready for future providers
- Docker runtime concerns remain confined to allocation infrastructure rather than leaking into Sessions, Catalog, or other platform modules
- the repository now has an executable boundary proving concurrency, restart recovery, timeout behavior, and orphan cleanup for the first real allocator

## Explicit Non-Goals

- Kubernetes or Agones provider implementation
- production fleet orchestration design
- Realtime Gateway or websocket transport work
- gameplay-state ownership inside the allocator