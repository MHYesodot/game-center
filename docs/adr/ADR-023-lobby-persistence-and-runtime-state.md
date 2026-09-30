# ADR-023 Lobby Persistence And Runtime State

Status: Accepted

## Context

Lobby moved beyond placeholder modeling in Foundation Slice 3. The platform needed a concrete durability boundary that supports ownership transfer, membership history, seat-capacity correctness, readiness semantics, dependency outages, and Redis restart tolerance without expanding into matchmaking, sessions, or game-server allocation.

The slice also required proof that Lobby does not leak persistence or runtime clients into the domain layer and does not couple directly to Catalog persistence internals.

## Decision

- Persist durable lobby state in PostgreSQL.
- Store only ephemeral runtime state in Redis.
- Keep Lobby inside the modular monolith with explicit repository/runtime ports.
- Allow Lobby to depend on Catalog only through a public catalog query boundary.
- Use NATS only when a real downstream consumer boundary exists; do not expand lobby events in Slice 3.

## Durable / Ephemeral Split

Durable PostgreSQL state owns:

- lobby identity
- game binding
- owner identity
- visibility
- capacity and minimum players
- versioned configuration
- join-code hash
- lifecycle status
- timestamps including `createdAt`, `updatedAt`, `closedAt`, and `expiresAt`
- durable membership history with `joinedAt` and `leftAt`

Ephemeral Redis state owns:

- presence
- connection state
- ready state
- reconnect deadline
- heartbeat freshness

Derived projections own:

- active member count
- available seats
- all-members-ready
- connected member count

## State Machine

Actual code states are:

- `open`
- `starting`
- `started`
- `closed`
- `expired`

Slice 3 transitions:

- create -> `open`
- `open -> starting` through `startLobby`
- `open -> closed` through owner close or owner-last-member leave
- `starting -> closed` through owner close
- `open -> expired` through access after `expiresAt`
- repeated start while already `starting` is idempotent

`closed`, `expired`, and `started` are terminal for the transport flow in Slice 3.

## Concurrency

Capacity correctness for last-seat races uses the following strategy:

- open a PostgreSQL transaction
- lock the target `lobbies` row with `FOR UPDATE`
- load active durable membership under the lock
- re-evaluate capacity from active durable membership count
- insert the new membership only if a seat is still available

The active-membership partial unique index provides DB-level protection against duplicate active membership for the same player.

## Redis Model

Lobby runtime state uses a versioned namespace, defaulting to `gc:v1`.

Key families:

- `gc:v1:lobby:{lobbyId}:presence`
- `gc:v1:lobby:{lobbyId}:ready`

Both key families use a 15-minute TTL. Presence is stored as a hash of JSON payloads keyed by `playerId`. Ready is stored as a set of ready `playerId` values.

## Postgres Model

Two tables model the durable state:

- `lobbies`
- `lobby_members`

Key constraints:

- one active membership per `(lobby_id, player_id)` where `left_at is null`
- one active owner per lobby where `left_at is null and role = 'owner'`

`configuration` is stored as JSONB because game-specific configuration is bounded but opaque to the platform.

## Reconnect

- disconnect is runtime-only and does not remove durable membership
- disconnect moves connection state to `reconnecting`
- reconnect grace is two minutes
- disconnect clears ready state
- reconnect restores presence only; ready must be reasserted
- Redis flush or restart loses runtime state but not durable membership

## Expiry

- `expiresAt` is stored durably in PostgreSQL
- new open lobbies start with a four-hour expiry window
- successful join and leave operations extend expiry
- access after expiry durably transitions the lobby to `expired`
- expiry clears Redis runtime state and preserves durable rows

## Failure Semantics

PostgreSQL down:

- process stays alive
- readiness returns `503`
- durable lobby operations return controlled `503` with `LOBBY_UNAVAILABLE`

Redis down:

- process stays alive
- readiness returns `503`
- `GET lobby` may still return durable state with unavailable runtime projection
- runtime-dependent commands return controlled `503` with `LOBBY_UNAVAILABLE`

Recovery of either dependency does not require restarting platform-api or the gateway.

## Alternatives Considered

### Persist runtime state in PostgreSQL

Rejected because ready/presence/reconnect state is ephemeral, high-churn, and should not be treated as durable history.

### Keep all lobby state in Redis

Rejected because ownership transfer, audit timestamps, and membership history must survive Redis loss and dependency restarts.

### Let Lobby query Catalog persistence directly

Rejected because it breaks module boundaries and prevents future extraction.

### Add NATS lifecycle events now

Rejected because no real consumer boundary exists yet and event expansion would add accidental complexity.

## Consequences

- Lobby has a clear durability boundary that survives Redis loss.
- Concurrency-sensitive seat admission is protected by PostgreSQL, not by optimistic runtime assumptions.
- Runtime semantics stay lightweight and recoverable.
- Dependency failures degrade in a controlled way instead of crashing the process.
- Future Auth work can replace the transitional `x-player-id` transport boundary without reworking the domain model.