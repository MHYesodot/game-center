# Session Lifecycle Architecture

Status: Accepted source of truth for P01 Session Lifecycle

## Purpose

P01 makes Sessions a real persisted domain.

- PostgreSQL is the durable source of truth for session identity, source match snapshot, participant roster, lifecycle status, expiry, and failure state.
- Redis is not required for session ownership in P01.
- Matchmaking remains responsible for producing the trusted match outcome; Sessions begins at the `MatchReadyQuery` and `SessionMatchReadyHandler` boundaries.
- Game-server allocation remains a boundary only. P01 records the need for allocation and may fail that request, but it does not fabricate server ids, endpoints, ports, or connection tokens.

## Durable / Ephemeral / Derived Model

| Field / concept | Classification | Storage | Source of truth | Recovery behavior |
| --- | --- | --- | --- | --- |
| `sessionId` | Durable | PostgreSQL `game_sessions.session_id` | PostgreSQL | Preserved across restarts and retries. |
| `matchId` | Durable | PostgreSQL `game_sessions.match_id` | PostgreSQL | Enforces idempotent `match -> session` creation. |
| `proposalId` | Durable | PostgreSQL `game_sessions.proposal_id` | PostgreSQL | Preserves the originating trusted Matchmaking decision. |
| source kind | Durable | PostgreSQL `game_sessions.source_kind` | PostgreSQL | P01 supports `matchmaking` only. |
| compatibility tuple | Durable | PostgreSQL `game_sessions.*version`, `platform`, `region`, `queue_type` | PostgreSQL | Preserved for later allocator/runtime consumers. |
| participant roster | Durable | PostgreSQL `game_session_participants` | PostgreSQL | Survives retries and process loss. |
| `status` | Durable | PostgreSQL `game_sessions.status` | PostgreSQL | Materialized as `expired` on access when `expiresAt` elapses. |
| `expiresAt` | Durable deadline | PostgreSQL `game_sessions.expires_at` | PostgreSQL | Access paths durably mark stale pre-active sessions as `expired`. |
| failure code | Durable | PostgreSQL `game_sessions.failure_code` | PostgreSQL | Preserved when allocation request dispatch fails. |
| allocation request dispatch | Derived command effect | `SessionAllocationPort` call | Sessions service + durable transition | Reissued only by explicit retries against the persisted session record. |
| connection handoff | Out of scope in P01 | none | none | Introduced in a later phase with real allocator/runtime integration. |

## Final State Machine

Actual code states are `created`, `allocating`, `ready`, `connecting`, `active`, `completing`, `completed`, `failed`, `cancelled`, and `expired`.

| From | To | Command / trigger | Allowed? | Reason / invariant |
| --- | --- | --- | --- | --- |
| none | `created` | `createSession` from trusted matched proposal | Yes | The session record is born durably before any allocator call. |
| `created` | `allocating` | allocation request claimed and dispatched | Yes | Exactly one caller may claim this transition under row lock. |
| `created` | `failed` | allocation request dispatch fails | Yes | Failure is durable and observable; no fake runtime metadata is returned. |
| `created` | `cancelled` | participant cancel | Yes | Allowed before allocation is underway. |
| `created` | `expired` | access after `expiresAt` | Yes | Expiry is materialized during read/write access. |
| `allocating` | `ready` | future allocator callback | Later phase | State reserved now, not transported in P01. |
| `allocating` | `cancelled` | participant cancel | Yes | Cancellation is still legal before connection handoff exists. |
| `allocating` | `expired` | access after `expiresAt` | Yes | Pre-active sessions can still expire. |
| `allocating` | `failed` | allocator failure callback or timeout policy | Later phase | Failure shape is already part of the lifecycle contract. |
| `ready` | `connecting` | future client handoff starts | Later phase | Reserved for P02+ runtime integration. |
| `connecting` | `active` | future runtime confirms activation | Later phase | Reserved for authoritative runtime lifecycle. |
| `active` | `completing` | future runtime completion starts | Later phase | Reserved state. |
| `completing` | `completed` | future result commit succeeds | Later phase | Reserved state. |
| any pre-active state | `cancelled` | `POST /api/sessions/:sessionId/cancel` by participant | Yes | P01 allows explicit pre-active cancellation. |
| terminal state | any mutable state | No | Terminal states are single-assignment. |

## PostgreSQL Model

### `game_sessions`

- Purpose: durable session aggregate root
- PK: `session_id`
- Unique constraints: `match_id`, `proposal_id`
- Indexes: `(status)`, `(expires_at)`, `(game_id, status)`

### `game_session_participants`

- Purpose: durable participant roster and source snapshot
- PK: `id`
- FK: `session_id -> game_sessions.session_id` with cascade delete
- Unique constraints: `(session_id, player_id)`, `(session_id, source_request_id)`
- Indexes: `(session_id)`, `(player_id)`, `(source_lobby_id)`

## Boundary Rules

- Sessions may read trusted matched state only through `MatchReadyQuery`.
- Matchmaking may notify Sessions only through the `MatchReadySink` to `SessionMatchReadyHandler` handoff.
- Sessions must not import Matchmaking persistence or runtime internals.
- Allocation remains behind `SessionAllocationPort`; P01 does not define a real allocator implementation.

## Failure Semantics

- PostgreSQL outage:
  - `/health/live` remains `200`
  - `/health/ready` returns `503`
  - durable session commands return controlled `503` with `SESSION_UNAVAILABLE`
- Allocation request dispatch failure:
  - session is durably marked `failed`
  - API returns `409` with `SESSION_CREATION_FAILED`
  - no fabricated endpoint or connection token is returned

## Test Isolation Strategy

- PostgreSQL integration tests create an isolated database and run committed migrations from empty.
- HTTP integration tests seed a trusted matched proposal directly in Matchmaking persistence, then exercise session creation through the Nest transport.
- No Redis durability is required for Session correctness in P01.