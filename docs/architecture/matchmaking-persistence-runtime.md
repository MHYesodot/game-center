# Matchmaking Persistence And Runtime Architecture

Status: Accepted source of truth for Foundation Slice 4

## Purpose

Matchmaking Slice 4 separates durable request and proposal ownership from ephemeral queue runtime coordination.

- PostgreSQL is the durable source of truth for matchmaking requests, proposal membership, request history, and terminal outcomes.
- Redis is the ephemeral source of truth for live queue ordering, queue locks, proposal leases, and queue-position projection.
- NATS is not part of the runtime-critical matchmaking path in this slice because no real cross-boundary consumer exists yet.
- Session persistence and dedicated game-server allocation are explicitly out of scope; Matchmaking stops at `MatchReadySink`.

## Durable / Ephemeral / Derived Model

| Field / concept | Classification | Storage | Source of truth | Recovery behavior |
| --- | --- | --- | --- | --- |
| request identity and requester identity | Durable | PostgreSQL `matchmaking_requests` | PostgreSQL | Preserved across process and Redis restarts. |
| queue compatibility tuple | Durable | PostgreSQL `matchmaking_requests` and `match_proposals` | PostgreSQL | Re-read directly from durable rows. |
| request lifecycle status | Durable | PostgreSQL `matchmaking_requests.status` | PostgreSQL | Materialized as `expired` on access when `expiresAt` has elapsed. |
| request terminal outcome | Durable | PostgreSQL `matchmaking_requests.terminal_outcome` | PostgreSQL | Preserved for history and deterministic retries. |
| proposal status and membership | Durable | PostgreSQL `match_proposals` + `match_proposal_members` | PostgreSQL | Preserved for accept/reject/timeout arbitration. |
| matched timestamps and final match identity | Durable | PostgreSQL `match_proposals.match_id` + timestamps | PostgreSQL | Preserved even if runtime coordination is lost. |
| queue ordering | Ephemeral | Redis sorted set | Redis while available | Rebuilt from durable queued requests on later access. |
| queue lock | Ephemeral | Redis string lock key | Redis while available | Recreated on the next worker attempt. |
| proposal lease | Ephemeral | Redis string key with TTL | Redis while available | Cleared on proposal resolution or lost on Redis flush without corrupting durable state. |
| queue position | Derived | Redis rank projection | Redis sorted set | Recomputed when runtime exists; unavailable when Redis is down. |
| candidate count | Derived | Redis sorted set cardinality | Redis sorted set | Recomputed when runtime exists; zeroed in unavailable projection. |
| expired request/proposal view | Derived durable projection | Computed from durable timestamps | PostgreSQL timestamps | Materialized durably on follow-up access paths. |

## Final Request State Machine

| From | To | Command / trigger | Allowed? | Reason / invariant |
| --- | --- | --- | --- | --- |
| none | `queued` | `enqueue` | Yes | New compatible player demand is born queued. |
| `queued` | `queued` | repeated enqueue same requester + same queue | Yes | Idempotent reuse of the active request. |
| `queued` | `proposed` | queue cycle selects request | Yes | Transition is durable and atomic with proposal creation. |
| `queued` | `cancelled` | requester cancel | Yes | Active demand may be withdrawn before a terminal outcome. |
| `queued` | `expired` | access after `expiresAt` | Yes | Expiry is materialized durably on access. |
| `proposed` | `matched` | all proposal members accept | Yes | Final durable outcome before session handoff boundary. |
| `proposed` | `queued` | proposal rejected or expires | Yes | Non-terminal proposal returns surviving requests to queue. |
| `proposed` | `cancelled` | cancelling participant or proposal cancellation | Yes | Cancelling member exits the flow durably. |
| `proposed` | `failed` | match-ready handoff fails after durable match | Yes | Matchmaking records the failure without inventing Session persistence. |
| `matched` / `cancelled` / `expired` / `failed` | mutable state | No | Terminal for Slice 4 transport semantics. |

## Final Proposal State Machine

| From | To | Command / trigger | Allowed? | Reason / invariant |
| --- | --- | --- | --- | --- |
| none | `pending` | queue cycle creates proposal | Yes | Proposal is born pending with a timeout window. |
| `pending` | `matched` | all members accept | Yes | Durable match decision is finalized. |
| `pending` | `rejected` | any member rejects | Yes | Rejector is cancelled and remaining members requeue. |
| `pending` | `expired` | timeout materialized on read/write access | Yes | Pending non-responders become `timed_out` and requests requeue. |
| `pending` | `cancelled` | member cancellation tears down the proposal | Yes | The cancelling request exits; survivors requeue. |
| `pending` | `failed` | downstream handoff boundary fails after match creation | Yes | Durable failure is preserved for operator visibility. |
| terminal state | any mutable state | No | Proposal resolution is single-assignment in Slice 4. |

## PostgreSQL Model

### `matchmaking_requests`

- Purpose: durable matchmaking request aggregate root
- PK: `request_id`
- Key indexes: `(queue_key, status, requested_at)`, `(game_id, status)`, `(expires_at)`, `(active_proposal_id)`
- Partial unique constraint: one active request per `(requester_type, requester_id)` where `status in ('queued', 'proposed')`

### `match_proposals`

- Purpose: durable proposal aggregate root
- PK: `proposal_id`
- Unique constraint: one non-null `match_id`
- Key indexes: `(queue_key, status)`, `(expires_at)`

### `match_proposal_members`

- Purpose: durable proposal participation and acceptance history
- PK: `id`
- FK: `proposal_id -> match_proposals.proposal_id` with cascade delete
- FK: `request_id -> matchmaking_requests.request_id` with cascade delete
- Unique constraint: `(proposal_id, request_id)`
- Key indexes: `(request_id)`, `(player_id)`

## Redis Runtime Model

| Key pattern | Purpose | Value type | TTL | Refresh behavior | Cleanup trigger | Durable source of truth |
| --- | --- | --- | --- | --- | --- | --- |
| `gc:v1:mm:queue:{queueKey}` | queue ordering for active requests | Redis sorted set of `requestId` scored by `requestedAt` epoch | 15 minutes | refreshed on enqueue | match selection, cancel, expiry, Redis loss | PostgreSQL queued requests |
| `gc:v1:mm:lock:queue:{queueKey}` | short worker lock per queue | Redis string owner token | 5 seconds | refreshed by reacquire only | lock expiry or explicit release | PostgreSQL rows remain canonical |
| `gc:v1:mm:proposal:{proposalId}` | lease for a pending proposal timeout window | Redis string of `expiresAt` | derived from proposal timeout | created on proposal creation | proposal resolution, expiry, Redis loss | PostgreSQL proposal row |

Queue ordering is stable FIFO by `requestedAt`, then `requestId` lexical tie-break through the strategy layer.

## Atomicity And Compensation

- Queue cycle acquires a Redis queue lock before reading candidate request ids.
- After the lock is acquired, Matchmaking opens a PostgreSQL transaction and locks candidate request rows with `FOR UPDATE`.
- Durable proposal creation and request transition to `proposed` happen before Redis queue removal.
- After the durable transaction commits, the selected request ids are removed from Redis and the proposal lease is written.
- If Redis removal or lease write fails, durable state remains canonical and later read paths can reconstruct runtime entries.
- If `MatchReadySink` fails after durable `matched`, Matchmaking records proposal and requests as `failed`; it does not create Session rows in this slice.

## Duplicate Prevention And Concurrency

- PostgreSQL row locking serializes queue-cycle updates for the same request rows.
- The partial unique active-request constraint prevents duplicate active demand per requester.
- Enqueue treats same-requester same-queue races as idempotent by re-reading the active durable request after the uniqueness race.
- Queue lock plus durable row checks prevent two workers from durably creating two live proposals for the same selected request set.

## Reconstruction And Expiry

- `GET request` restores a missing Redis queue entry for a still-queued durable request.
- Proposal timeout is materialized durably during proposal reads and accept/reject commands.
- Expired or rejected proposals requeue surviving requests through runtime reconstruction rather than requiring a background distributed job system.
- Redis flush or restart loses queue and lease keys only; durable requests and proposals remain readable and recoverable.

## Failure Semantics

- PostgreSQL outage:
  - `/health/live` remains `200`
  - `/health/ready` returns `503`
  - durable matchmaking commands return controlled `503` with `MATCHMAKING_UNAVAILABLE`
- Redis outage:
  - `/health/live` remains `200`
  - `/health/ready` returns `503`
  - `GET request` may still return durable state with `runtime.available = false`
  - queue mutation paths return controlled `503` with `MATCHMAKING_UNAVAILABLE`

## Test Isolation Strategy

- PostgreSQL integration tests create a unique database per test app and drop it afterward.
- Redis integration tests use a unique namespace per test and delete namespace keys afterward.
- Race tests cover duplicate enqueue, worker collision, cancel-vs-match convergence, timeout-vs-accept convergence, and Redis queue reconstruction.