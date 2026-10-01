# Game Server Allocation Contract

Status: Accepted source of truth for P03 Docker DEV Game Allocator

## Public Platform Boundary

Session-scoped allocation APIs currently exposed by `services/platform-api`:

- `POST /api/sessions/:sessionId/allocation`
- `GET /api/sessions/:sessionId/allocation`
- `POST /api/sessions/:sessionId/allocation/release`

All three routes require an authenticated `gc_session` cookie for an authorized session participant.

## Runtime Boundary

Allocations accepts work only through:

- `SessionAllocationPort.requestAllocation(input)`
- `SessionAllocationPort.getAllocation(sessionId)`
- `SessionAllocationPort.releaseAllocation(sessionId)`

Session reaches the concrete allocator orchestration through `SessionAllocationPortAdapter`, which delegates to `SessionAllocationOrchestrator`.

## Core Types

### `AllocationStatus`

- `requested`
- `provisioning`
- `ready`
- `failed`
- `releasing`
- `released`
- `expired`

### `ConnectionDescriptor`

- `transport: 'tcp' | 'udp' | 'websocket' | 'quic'`
- `host: string`
- `port: number`
- `secure: boolean`
- `protocolVersion: string`
- `tokenReference: string | null`
- `expiresAt: string | null`

### `AllocationRequest`

- `allocationId`
- `sessionId`
- `gameId`
- `gameVersion`
- `protocolVersion`
- `requestedAt`
- `artifact`
  - `artifactId`
  - `gameId`
  - `gameVersion`
  - `protocolVersion`
  - `buildVersion`
  - `serverType`
  - `runtimeType`
- `runtimeRequirements`
  - `runtimeProfile`
  - `region`
  - `participantCapacity`

### `GameServerAllocation`

- `allocationId`
- `sessionId`
- `provider`
- `providerReference`
- `status`
- `artifact`
- `runtimeRequirements`
- `connection`
- `requestedAt`
- `provisioningAt`
- `readyAt`
- `failedAt`
- `releasingAt`
- `releasedAt`
- `expiresAt`
- `failureCode`

## Provider Contract

### `GameServerAllocator`

- `allocate(request: AllocationRequest): Promise<ProviderAllocationResult>`
- `getAllocation(reference: { allocationId: string; providerReference: string | null }): Promise<ProviderAllocationResult | null>`
- `release(reference: { allocationId: string; providerReference: string | null }): Promise<void>`

### `GameServerAllocatorRegistry`

- `get(provider: AllocationProvider): GameServerAllocator`

Provider set in code:

- `unavailable`
- `test`
- `docker`

The stable runtime default remains `unavailable`. Real Docker allocation is enabled only when `ALLOCATION_PROVIDER=docker` is set explicitly.

## Repository Contract

### `AllocationRepository`

- `getById(allocationId)`
- `getLatestBySessionId(sessionId)`
- `getActiveBySessionId(sessionId)`
- `withTransaction(callback)`

### `AllocationRepositoryTransaction`

- `getById(allocationId)`
- `getByIdForUpdate(allocationId)`
- `getLatestBySessionId(sessionId)`
- `getActiveBySessionId(sessionId)`
- `getActiveBySessionIdForUpdate(sessionId)`
- `createAllocation(input)`
- `updateAllocation(allocation)`

## Invariants

- at most one active allocation row may exist per session for states `requested | provisioning | ready | releasing`
- provider invocation is claimed once from `requested` under a PostgreSQL row lock
- provider success does not create a second allocation row if ready persistence fails
- `ready` requires a connection descriptor
- non-`ready` states must not expose a usable connection descriptor
- repeated release is idempotent once a row has converged to `released`

## Error Contract

Semantic allocation error codes in code:

- `ALLOCATION_NOT_FOUND`
- `ALLOCATION_INVALID_STATE`
- `ALLOCATION_UNAVAILABLE`
- `ALLOCATION_FAILED`
- `ALLOCATION_ALREADY_RELEASED`

Durable failure codes in code:

- `ALLOCATION_PROVIDER_UNAVAILABLE`
- `ALLOCATION_PROVIDER_FAILED`
- `ALLOCATION_PERSISTENCE_FAILED`
- `ALLOCATION_TIMEOUT`

P02 currently uses the first, second, and timeout-oriented paths in implementation. `ALLOCATION_PERSISTENCE_FAILED` remains part of the public contract surface but is not emitted as a durable failure code by the current service.

## Explicit P02 Non-Goals

- no Kubernetes or Agones allocator
- no fabricated server endpoint in the stable runtime
- no allocator-owned gameplay state