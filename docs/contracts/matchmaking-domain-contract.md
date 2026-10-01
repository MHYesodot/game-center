# Matchmaking Domain Contract

Status: Accepted source of truth for Foundation Slice 4

Matchmaking in Slice 4 is split between durable PostgreSQL state and ephemeral Redis queue-runtime state.

## Durable / Ephemeral / Derived Matrix

| Field / concept | Classification | Storage | Source of truth | Recovery behavior |
| --- | --- | --- | --- | --- |
| `requestId` | Durable | PostgreSQL `matchmaking_requests.request_id` | PostgreSQL | Survives Redis loss and process restarts. |
| `requester` | Durable | PostgreSQL `matchmaking_requests.requester_type`, `requester_id` | PostgreSQL | Governs idempotent active-request ownership. |
| `queue` compatibility tuple | Durable | PostgreSQL request/proposal rows | PostgreSQL | Re-read directly from durable rows. |
| `status` | Durable | PostgreSQL `matchmaking_requests.status` | PostgreSQL | Materialized as `expired` on access after `expiresAt`. |
| `requestedAt` | Durable | PostgreSQL `matchmaking_requests.requested_at` | PostgreSQL | Preserved for FIFO selection and auditability. |
| `expiresAt` | Durable deadline | PostgreSQL `matchmaking_requests.expires_at` | PostgreSQL | Used to materialize durable expiry and runtime cleanup. |
| `terminalOutcome` | Durable | PostgreSQL `matchmaking_requests.terminal_outcome` | PostgreSQL | Preserved for player-visible history and reconciliation. |
| `activeProposalId` | Durable pointer | PostgreSQL `matchmaking_requests.active_proposal_id` | PostgreSQL | Cleared on terminal or requeue transitions. |
| proposal members and acceptance statuses | Durable | PostgreSQL `match_proposal_members` | PostgreSQL | Preserved across Redis flush and used for timeout/reject arbitration. |
| queue ordering | Ephemeral | Redis sorted set | Redis while available | Rebuilt from durable queued requests on demand. |
| queue lock | Ephemeral | Redis lock key | Redis while available | Re-established per worker attempt. |
| proposal lease | Ephemeral | Redis lease key | Redis while available | Cleared on resolution or lost safely during Redis outage. |
| queue position | Derived | Redis rank projection | Redis sorted set | Recomputed when runtime exists; unavailable otherwise. |
| candidate count | Derived | Redis sorted set cardinality | Redis sorted set | Recomputed when runtime exists; defaults to zero when unavailable. |

## Request State Machine

Actual code states are `queued`, `proposed`, `matched`, `cancelled`, `expired`, and `failed`.

| From | To | Command / trigger | Allowed? | Reason / invariant |
| --- | --- | --- | --- | --- |
| none | `queued` | `enqueue` | Yes | New compatible demand enters the queue. |
| `queued` | `queued` | repeated `enqueue` same requester and queue | Yes | Idempotent reuse of active request. |
| `queued` | `proposed` | `runQueueCycle` selection | Yes | Durable proposal creation owns the transition. |
| `queued` | `cancelled` | `cancelRequest` | Yes | Requester may withdraw before proposal selection. |
| `queued` | `expired` | access after `expiresAt` | Yes | Expiry is materialized durably. |
| `proposed` | `matched` | all proposal members accept | Yes | Matchmaking reaches a durable ready-for-handoff outcome. |
| `proposed` | `queued` | proposal rejection or timeout | Yes | Surviving requests resume search. |
| `proposed` | `cancelled` | member cancellation or self-rejection | Yes | Cancelling member exits durably. |
| `proposed` | `failed` | `MatchReadySink` fails after durable match | Yes | Failure is recorded without inventing Session persistence. |
| terminal state | mutable state | No | Terminal request outcomes do not reopen in Slice 4. |

## Proposal State Machine

Actual code states are `pending`, `matched`, `rejected`, `expired`, `cancelled`, and `failed`.

| From | To | Command / trigger | Allowed? | Reason / invariant |
| --- | --- | --- | --- | --- |
| none | `pending` | proposal creation | Yes | Proposal is born with a fixed acceptance window. |
| `pending` | `matched` | all members accepted | Yes | Final durable match decision. |
| `pending` | `rejected` | any member rejects | Yes | Rejector cancels and survivors requeue. |
| `pending` | `expired` | timeout materialized on access | Yes | Pending members become `timed_out` and requests requeue. |
| `pending` | `cancelled` | participant cancellation | Yes | Proposal is torn down so survivors can resume queueing. |
| `pending` | `failed` | downstream handoff failure | Yes | Matchmaking records a durable failed outcome. |
| terminal state | mutable state | No | Proposal resolution is single-assignment. |

## Queue Runtime Policy

- `queueType`: only `quick-play` is implemented in Slice 4.
- `matchSize`: `2`
- `proposalTimeoutMs`: `30_000`
- queue namespace default: `gc:v1:mm`
- queue TTL: `15 minutes`
- queue lock TTL: `5 seconds`

## Error Contract

Actual matchmaking error codes are:

- `MATCHMAKING_REQUEST_NOT_FOUND`
- `MATCHMAKING_REQUEST_NOT_ACTIVE`
- `MATCH_PROPOSAL_NOT_FOUND`
- `MATCH_PROPOSAL_NOT_PARTICIPANT`
- `MATCH_PROPOSAL_ALREADY_RESOLVED`
- `MATCH_PROPOSAL_EXPIRED`
- `ALREADY_QUEUED`
- `INCOMPATIBLE_GAME`
- `MATCHMAKING_UNAVAILABLE`
- `INVALID_PLAYER_ID`

## Identity Boundary

P05 runtime identity for Matchmaking routes is provided by the authenticated Auth session boundary:

- identity source: authenticated `gc_session` cookie
- optional request correlation: `x-request-id`
- request body never supplies player identity

Transitional note:

- `x-player-id` remains isolated to test-only migration helpers while older integration fixtures are cut over.

## Explicit Non-Goals For Slice 4

- no Session persistence
- no dedicated game-server allocator implementation
- no social, party, or tournament implementation
- no ranking or MMR sophistication beyond queue-policy and strategy abstractions