# Lobby Persistence And Runtime Architecture

Status: Accepted source of truth for Foundation Slice 3

## Purpose

Lobby Slice 3 separates durable coordination state from ephemeral runtime state.

- PostgreSQL is the durable source of truth for lobby identity, lifecycle, and membership history.
- Redis is the ephemeral source of truth for live runtime signals such as presence and ready state.
- NATS is not part of the runtime-critical lobby path in this slice.

## Durable / Ephemeral / Derived Model

| Field / concept | Classification | Storage | Source of truth | Recovery behavior |
| --- | --- | --- | --- | --- |
| lobby identity and game binding | Durable | PostgreSQL `lobbies` | PostgreSQL | Fully preserved across process and Redis restarts. |
| ownership | Durable | PostgreSQL `lobbies.owner_player_id` + active `lobby_members` owner row | PostgreSQL | Reconstructed directly from durable rows. |
| lifecycle status | Durable | PostgreSQL `lobbies.status` | PostgreSQL | Expiry is materialized durably on later access. |
| visibility and join-code hash | Durable | PostgreSQL `lobbies` | PostgreSQL | Preserved across runtime loss. |
| capacity and minimum players | Durable | PostgreSQL `lobbies` | PostgreSQL | Used for concurrency-safe admission after recovery. |
| configuration | Durable | PostgreSQL JSONB | PostgreSQL | Immutable after create in Slice 3. |
| membership history | Durable | PostgreSQL `lobby_members` | PostgreSQL | Preserved for audit and deterministic owner transfer. |
| ready state | Ephemeral | Redis set | Redis | Cleared by Redis loss, join, leave, disconnect, start, close, expiry. |
| presence / connection state | Ephemeral | Redis hash | Redis | Cleared by Redis loss, close, start, expiry. |
| reconnect grace | Ephemeral | Redis hash payload | Redis | Lost on Redis flush/restart. |
| active member count | Derived | Computed | PostgreSQL | Recomputed on every read. |
| available seats | Derived | Computed | PostgreSQL | Recomputed on every read. |
| all-members-ready | Derived | Computed | PostgreSQL active members + Redis ready set | Recomputed; defaults false after Redis loss. |
| connected member count | Derived | Computed | Redis presence | Recomputed; defaults zero after Redis loss or outage fallback. |

## Final State Machine

| From | To | Command | Allowed? | Reason / invariant |
| --- | --- | --- | --- | --- |
| none | `open` | create | Yes | Lobby is born open. |
| `open` | `open` | join | Yes | Durable membership add or idempotent no-op. |
| `open` | `open` | ready | Yes | Runtime-only mutation. |
| `open` | `open` | leave with remaining members | Yes | Membership history changes only. |
| `open` | `closed` | close | Yes | Owner-controlled terminal close. |
| `open` | `closed` | owner leaves last seat | Yes | No active members remain. |
| `open` | `starting` | start | Yes | Requires owner, min players, and all active members ready. |
| `open` | `expired` | access after `expiresAt` | Yes | Expiry is materialized during read/write access. |
| `starting` | `starting` | repeated start | Yes | Idempotent retry. |
| `starting` | `closed` | close | Yes | Explicit close still allowed before runtime handoff exists. |
| `closed` / `expired` / `started` | any mutable transition | No | Terminal or unsupported in Slice 3. |

## Ownership Policy

- Exactly one active owner is enforced by a partial unique index over active owner rows.
- Non-owner leave preserves owner.
- Owner leave selects the next owner deterministically from active durable members by oldest `joinedAt`, then `playerId` lexical tie-break.
- If no successor exists, the lobby closes.

## Reconnect And Ready Semantics

- Durable membership survives disconnect because disconnect does not mutate PostgreSQL membership.
- Presence and reconnect metadata live only in Redis.
- Disconnect clears the ready set entry for that player.
- Reconnect grace is `2` minutes.
- Joining a lobby clears the lobby ready set to avoid stale consensus after membership changes.
- Leaving a lobby clears the lobby ready set for the same reason.
- Starting, closing, and expiring a lobby remove all runtime keys.
- Configuration is immutable after create, so there is no config-change reset path in Slice 3.

## Expiry And Cleanup

- `expiresAt` is durable and stored in PostgreSQL.
- Open lobbies expire four hours after the last durable activity that extends expiry.
- On access after expiry, the service updates status to `expired` and clears Redis runtime keys.
- Expired lobbies remain readable as durable history.

## PostgreSQL Model

### `lobbies`

- Purpose: durable lobby aggregate root
- PK: `lobby_id`
- JSONB: `configuration`
- Indexes: `(game_id, status)`, `(owner_player_id)`, `(status)`, `(expires_at)`

### `lobby_members`

- Purpose: durable membership history
- PK: `id`
- FK: `lobby_id -> lobbies.lobby_id` with cascade delete
- Unique constraints:
  - one active membership per `(lobby_id, player_id)` where `left_at is null`
  - one active owner per `lobby_id` where `left_at is null and role = 'owner'`
- Indexes: `(lobby_id, joined_at)`, `(player_id)`

## Capacity Concurrency Strategy

- Mutating lobby operations run inside a PostgreSQL transaction.
- Join first locks the target `lobbies` row with `FOR UPDATE` through `getByIdForUpdate`.
- After the lock is acquired, active durable membership count is recomputed from PostgreSQL rows.
- Only then does the service decide whether a seat is available and insert the new active membership row.
- The partial unique index on active membership provides a DB-level fallback against duplicate active membership for the same player.
- The row lock serializes concurrent last-seat joins so the second request observes the updated durable count and returns `LOBBY_FULL`.

## Redis Runtime Model

| Key pattern | Purpose | Value type | TTL | Refresh behavior | Cleanup trigger | Durable source of truth |
| --- | --- | --- | --- | --- | --- | --- |
| `gc:v1:lobby:{lobbyId}:presence` | live presence and reconnect data per active member | Redis hash of JSON payloads keyed by `playerId` | 15 minutes | refreshed on `markConnected` and `markDisconnected` | start, close, expiry, explicit clear, Redis loss | PostgreSQL membership rows |
| `gc:v1:lobby:{lobbyId}:ready` | ready consensus for active members | Redis set of `playerId` values | 15 minutes | refreshed on `setReadyState` and `markDisconnected` | join, leave, disconnect for member, start, close, expiry, Redis loss | PostgreSQL membership rows define which members matter |

The namespace is versioned by default through `LOBBY_RUNTIME_NAMESPACE ?? 'gc:v1'`.

## Failure Semantics

- PostgreSQL outage:
  - `/health/live` remains `200`
  - `/health/ready` returns `503`
  - durable lobby commands return controlled `503` with `LOBBY_UNAVAILABLE`
- Redis outage:
  - `/health/live` remains `200`
  - `/health/ready` returns `503`
  - `GET lobby` may still return durable state with runtime projection `available: false`
  - runtime-dependent actions such as ready and start return controlled `503` with `LOBBY_UNAVAILABLE`

## Test Isolation Strategy

- PostgreSQL integration tests create a unique database per test app and drop it afterward.
- Redis integration tests use a unique namespace per test and delete namespace keys afterward.
- The tests do not reuse or mutate shared DEV state.