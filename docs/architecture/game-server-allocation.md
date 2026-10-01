# Game Server Allocation Architecture

Status: Accepted source of truth for P02 GameServerAllocator Abstraction

## Purpose

P02 makes allocation a real persisted domain boundary without starting real Docker or Kubernetes provisioning.

- PostgreSQL is the durable source of truth for allocation identity, provider selection, state, runtime artifact snapshot, release progress, and connection metadata when an allocator reaches `ready`.
- Sessions owns gameplay-session lifecycle truth.
- Allocations owns provider/resource lifecycle truth.
- Catalog remains the source of runtime/build metadata, but Allocations may read it only through `CatalogAllocationArtifactQuery`.
- Stable runtime uses the explicit `unavailable` provider; deterministic `test` behavior exists only for tests and integration harnesses.

## Ownership Boundary

### Sessions owns

- trusted `matchId -> sessionId` lifecycle
- participant authorization
- session orchestration states such as `created`, `allocating`, `ready`, `active`, `failed`, `cancelled`, and `expired`
- projection from allocation success into Session `ready`

### Allocations owns

- one active allocation per session invariant
- provider selection and provider reference persistence
- allocation lifecycle states `requested`, `provisioning`, `ready`, `failed`, `releasing`, `released`, and `expired`
- connection descriptor persistence for `ready` allocations
- provider-success/database-failure reconciliation
- release semantics and retryability

This keeps lifecycle truth separated: Session does not own provider release state, and Allocation does not own gameplay readiness beyond the resource handoff.

## Public Boundary Surface

- Session -> Allocation: `SessionAllocationPort`
- Session adapter -> Allocation orchestrator: `SessionAllocationPortAdapter`
- Allocation -> Catalog: `CatalogAllocationArtifactQuery`
- Allocation -> provider implementations: `GameServerAllocator`
- provider lookup: `GameServerAllocatorRegistry`

Allocations does not import Session repositories or Catalog repositories in production code.

## Durable / Ephemeral / Derived Matrix

| Field / concept | Classification | Storage | Source of truth | Recovery semantics |
| --- | --- | --- | --- | --- |
| `allocationId` | Durable | PostgreSQL `game_server_allocations.allocation_id` | PostgreSQL | Reused as the stable idempotency key across retries and reconciliation. |
| `sessionId` | Durable | PostgreSQL `game_server_allocations.session_id` | PostgreSQL | Binds one allocation lifecycle to one durable session. |
| `provider` | Durable | PostgreSQL `provider` | PostgreSQL | Determines the registry entry used for later reads and release. |
| `providerReference` | Durable when assigned | PostgreSQL `provider_reference` | PostgreSQL after persistence | Reused for release or provider-side lookup if present. |
| `status` | Durable | PostgreSQL `status` | PostgreSQL | Materialized to `expired` only from pre-ready states when the deadline elapses. |
| `gameId` | Durable | PostgreSQL `game_id` | PostgreSQL snapshot | Preserved independently from future Catalog changes. |
| `gameVersion` | Durable | PostgreSQL `game_version` | PostgreSQL snapshot | Preserved for retry/reconciliation. |
| `protocolVersion` | Durable | PostgreSQL `protocol_version` | PostgreSQL snapshot | Preserved for retry/reconciliation. |
| `runtimeProfile` | Durable | PostgreSQL `runtime_profile` | PostgreSQL | Derived once from the Catalog artifact/server type and reused. |
| `requestedAt` | Durable | PostgreSQL `requested_at` | PostgreSQL | Stable allocation request timestamp. |
| `provisioningAt` | Durable | PostgreSQL `provisioning_at` | PostgreSQL | Marks the first claim of provider work. |
| `readyAt` | Durable | PostgreSQL `ready_at` | PostgreSQL | Set only when durable ready persistence succeeds. |
| `failedAt` | Durable | PostgreSQL `failed_at` | PostgreSQL | Set when provider failure is durably recorded. |
| `releasedAt` | Durable | PostgreSQL `released_at` | PostgreSQL | Set only after provider release succeeds and the row is durably updated. |
| `expiresAt` | Durable deadline | PostgreSQL `expires_at` | PostgreSQL | Converts stale `requested`/`provisioning` rows to `expired` on access. |
| `failureCode` | Durable | PostgreSQL `failure_code` | PostgreSQL | Stable semantic failure classification. |
| connection host | Durable when ready | PostgreSQL `connection_host` | PostgreSQL after ready persistence | Cleared on failed/released outcomes. |
| connection port | Durable when ready | PostgreSQL `connection_port` | PostgreSQL after ready persistence | Cleared on failed/released outcomes. |
| transport | Durable when ready | PostgreSQL `connection_transport` | PostgreSQL after ready persistence | Not usable unless status is `ready`. |
| connection token reference | Durable when ready | PostgreSQL `connection_token_reference` | PostgreSQL after ready persistence | Reference only; not a raw credential secret. |
| token expiry | Durable when ready | PostgreSQL `connection_expires_at` | PostgreSQL after ready persistence | Nullable when the provider has no token expiry. |
| provider health | Ephemeral | none | live dependency/provider behavior | Surfaces as semantic unavailability; no durable health field is persisted. |
| allocation age | Derived | none | computed from persisted timestamps | Recomputed whenever needed; not stored separately. |

## Final State Machine

Actual code states are:

- `requested`
- `provisioning`
- `ready`
- `failed`
- `releasing`
- `released`
- `expired`

Terminal states:

- `failed`
- `released`
- `expired`

### Legal transition matrix

| From | To | Allowed? | Notes |
| --- | --- | --- | --- |
| none | `requested` | Yes | Allocation row is created before any provider result is persisted. |
| `requested` | `provisioning` | Yes | First successful claim wins provider invocation. |
| `requested` | `ready` | Yes | Supported by state rules when a provider returns immediate readiness. |
| `requested` | `failed` | Yes | Provider failure is durably recorded. |
| `requested` | `expired` | Yes | Materialized on access when deadline passes. |
| `provisioning` | `ready` | Yes | Durable convergence after provider success or reconciliation. |
| `provisioning` | `failed` | Yes | Durable convergence after provider failure. |
| `provisioning` | `expired` | Yes | Materialized on access when deadline passes before readiness. |
| `ready` | `releasing` | Yes | Release request starts durable release workflow. |
| `failed` | `releasing` | Yes | Failed allocations are still releasable if the provider created something. |
| `releasing` | `released` | Yes | Provider release succeeded and durable row converged. |
| `released` | any | No | Terminal. |
| `expired` | any | No | Terminal. |

## Concurrency And Idempotency

- PostgreSQL row locking and the partial unique active-allocation index guarantee at most one active allocation row per session.
- `claimProvisioning(allocationId)` moves exactly one `requested` row to `provisioning` under lock before provider invocation.
- The provider request carries the durable `allocationId` as the idempotency key.
- If provider success occurs but ready persistence fails, the row remains durable `provisioning`; retry reuses the same row and calls `provider.getAllocation(...)` before allocating again.

## Failure And Recovery Semantics

### Durable row created, provider fails

- row remains the same `allocationId`
- status becomes `failed`
- `failureCode` is durable
- no connection descriptor is persisted
- caller receives semantic `ALLOCATION_FAILED`, not a raw provider exception

### Provider succeeds, database persistence fails

- no second active allocation row is created
- same `allocationId` is retried
- allocator reconciliation reads provider state first when the durable row is already `provisioning`
- durable state converges to `ready` when persistence recovers

This is the process-crash-equivalent recovery path for P02.

## Session Relation

- Session `allocating` means Session has claimed the need for an allocation request.
- Allocation `ready` is the provider/resource truth that allows Session to project to Session `ready`.
- Session and Allocation do not silently duplicate the same truth:
  - Session does not store provider reference or connection descriptor.
  - Allocation does not store participant authorization or gameplay lifecycle beyond resource provisioning state.

## ConnectionDescriptor Security

Implemented fields:

- `transport`
- `host`
- `port`
- `secure`
- `protocolVersion`
- `tokenReference`
- `expiresAt`

Security rules in the current implementation:

- non-`ready` allocations do not expose a usable connection descriptor
- connection details are returned only through Session-authenticated routes
- logs record allocation lifecycle events but do not log connection credentials
- token support is only a nullable reference field today; no raw bearer token issuance flow exists in P02

## Explicit P02 Non-Goals

- no Docker container creation, start, stop, or cleanup
- no Docker socket access
- no dynamic host port assignment
- no container labels or container health probes
- no Kubernetes client or Agones SDK integration
- no fake runtime endpoint in stable runtime