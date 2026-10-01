# ADR-026 Game Server Allocation Abstraction

Status: Accepted

## Context

P01 established durable Session lifecycle truth but intentionally stopped short of real game-server provisioning. P02 needs a real allocation domain and persistence model that can survive retries, provider failures, and database failures without pulling Docker, Kubernetes, or Agones into the current phase.

The repository also needs proof that Session lifecycle truth and Allocation lifecycle truth do not drift silently, and that runtime/build metadata is sourced from Catalog through a public boundary rather than persistence internals.

## Decision

- introduce a dedicated `Allocations` module inside `services/platform-api`
- persist allocation state in PostgreSQL with one active allocation row per session
- keep Session lifecycle truth in `Sessions` and provider/resource lifecycle truth in `Allocations`
- connect Session to Allocation only through `SessionAllocationPortAdapter` and `SessionAllocationOrchestrator`
- read runtime/build metadata only through `CatalogAllocationArtifactQuery`
- keep provider implementations behind `GameServerAllocator` and `GameServerAllocatorRegistry`
- default stable runtime to `ALLOCATION_PROVIDER=unavailable`
- allow a deterministic `test` provider only for tests and integration harnesses
- use durable `allocationId` as the provider idempotency key
- preserve process-crash-equivalent recovery by keeping the row in `provisioning` when provider success occurs before durable ready persistence succeeds
- keep release semantics durable with `releasing -> released` convergence

## Ownership Boundary

### Sessions owns

- `matchId -> sessionId` idempotency
- participant authorization
- gameplay orchestration status
- projection from allocation readiness into Session `ready`

### Allocations owns

- provider selection and provider reference
- allocation status and timestamps
- connection descriptor persistence
- provider failure and release semantics
- retry and reconciliation behavior

This means there is no duplicate lifecycle truth for provider state inside the Session aggregate.

## State Machine

Actual allocation states in code:

- `requested`
- `provisioning`
- `ready`
- `failed`
- `releasing`
- `released`
- `expired`

Legal transitions:

- `requested -> provisioning | ready | failed | expired`
- `provisioning -> ready | failed | expired`
- `ready -> releasing`
- `failed -> releasing`
- `releasing -> released`

Terminal states:

- `failed`
- `released`
- `expired`

## Durable / Ephemeral Split

Durable PostgreSQL state owns:

- allocation identity
- session binding
- provider selection and provider reference
- artifact snapshot and runtime requirements
- status and lifecycle timestamps
- failure code
- connection descriptor fields when ready

Ephemeral state owns:

- provider health at the moment of invocation
- process memory used by the deterministic test allocator

Derived state owns:

- expiry materialization from `expiresAt`
- age calculations from durable timestamps

## Idempotency And Recovery

### Concurrent allocation requests

- allocation creation is protected by a PostgreSQL transaction plus a partial unique active-allocation index
- provider invocation is protected by durable `claimProvisioning(...)`
- the same active row is reused across concurrent callers

### Database success, provider failure

- allocation row is durably created first
- provider failure transitions the same row to `failed`
- `failureCode` remains durable
- no connection descriptor is persisted
- callers receive semantic allocation failure, not raw provider exceptions

### Provider success, database failure

- provider receives stable `allocationId`
- if ready persistence fails, the row remains `provisioning`
- retry reuses the same `allocationId`
- reconciliation reads provider state first and converges the durable row to `ready`
- no second active allocation row is created

This same path is treated as the P02 process-crash-equivalent recovery strategy.

## Catalog Artifact Lookup

Allocations depends on Catalog only through `CatalogAllocationArtifactQuery.getGameServerArtifact(gameId)`. This keeps build/runtime metadata inside the Catalog ownership boundary while allowing allocation persistence to snapshot the exact artifact data used for a request.

## Session Coordination

When Allocation returns `ready`, Sessions projects that outcome into Session `ready` through a durable Session transition. Session does not copy provider lifecycle state beyond the user-facing gameplay readiness projection.

## Release Semantics

- only `ready`, `failed`, `releasing`, and `released` are releasable states
- release first converges the row to `releasing`
- provider release failure does not falsely mark the row `released`
- later retry can continue from the same durable row
- repeated release after convergence is idempotent

## ConnectionDescriptor And Security

P02 persists only the implemented connection fields:

- transport
- host
- port
- secure
- protocolVersion
- tokenReference
- expiresAt

P02 does not implement raw token issuance or credential exchange. Non-ready allocations do not expose a usable connection descriptor, and allocation logs do not include connection secrets.

## Deferred Runtime Decisions

### Why Docker is deferred to P03

P02 is a boundary and durability phase. A real Docker allocator would widen scope into container lifecycle, host-port assignment, cleanup, and runtime health behavior before the allocation contract and recovery semantics were fully locked.

### Why Kubernetes and Agones are deferred

Kubernetes and Agones are production deployment decisions that belong after the provider-neutral abstraction is proven. Introducing them in P02 would prematurely lock infrastructure choices before the runtime lifecycle contract and failure semantics are fully validated.

## Consequences

- Allocation is now a real persisted domain instead of a placeholder boundary.
- Session lifecycle and provider lifecycle remain separate and explicit.
- Stable runtime does not pretend a real game server exists.
- P03 can focus on one concrete provider implementation without redefining P02 persistence, error, or recovery semantics.