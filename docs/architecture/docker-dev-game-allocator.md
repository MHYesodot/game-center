# Docker DEV Game Allocator

Status: Accepted source of truth for P03 Docker DEV Game Allocator

## Purpose

P03 delivers the first real DEV and CI game-server allocator without changing the provider-neutral contract established in P02.

## Provider Selection

- supported providers are `unavailable`, `test`, and `docker`
- stable runtime keeps `unavailable` as the default
- real Docker allocation is enabled only by setting `ALLOCATION_PROVIDER=docker`

## Runtime Shape

- `AllocationsService` remains the orchestration entrypoint for request, read, and release flows
- `DockerGameServerAllocator` is selected through `GameServerAllocatorRegistry`
- `dockerode` is hidden behind `DockerRuntimeClient`
- managed containers run on the `game-center-game-servers` Docker network
- container names are deterministic: `gc-game-<allocationId>`
- container labels carry allocation, session, game, version, and protocol metadata for reconciliation and cleanup

## Readiness And Connectivity

- the provider waits for Docker `HEALTHCHECK` success before returning durable `ready`
- the published host port is assigned dynamically from Docker and returned in the connection descriptor
- the host in the descriptor comes from `DOCKER_ALLOCATOR_PUBLIC_HOST`
- `/health/ready` includes Docker daemon readiness only when the Docker provider is selected

## Failure Semantics

- unreachable Docker daemon maps to semantic provider unavailability
- missing images map to semantic provider failure
- health-check timeout maps to `ALLOCATION_TIMEOUT`
- repeated release is idempotent when the managed container is already gone
- durable `ready` rows are reconciled against provider state to avoid stale connection handoff after container loss

## Cleanup Boundary

- orphan cleanup removes only containers labeled as Game Center managed
- cleanup requires the allocation, session, and game labels before a container is eligible
- active durable Docker allocations protect their containers from cleanup
- unmanaged containers are never touched

## Explicit Non-Goals

- Kubernetes or Agones integration
- production scheduler design
- Realtime Gateway work
- silent promotion of Docker to the universal runtime default