# ADR-024 Matchmaking Persistence And Queue Runtime

Status: Accepted

## Context

Matchmaking moved beyond the placeholder overview model in Foundation Slice 4. The platform needed a concrete durability boundary for requests, proposals, acceptance history, duplicate prevention, timeout handling, and outage recovery without starting Session persistence or dedicated game-server allocation.

The slice also required proof that Matchmaking does not leak Redis or Drizzle dependencies into the domain layer, does not bypass Catalog's public boundary, and does not force NATS into the hot path without a real downstream consumer.

## Decision

- Persist durable matchmaking requests, proposals, and proposal membership in PostgreSQL.
- Store active queue ordering, proposal leases, and queue locks only in Redis.
- Keep Matchmaking inside the modular monolith with explicit repository and runtime-store ports.
- Allow Matchmaking to depend on Catalog only through the public catalog query boundary.
- Stop the slice at `MatchReadySink`; do not implement Session persistence or allocator orchestration yet.
- Do not add NATS-driven queue processing in this slice because there is no real consumer boundary yet.

## Durable / Ephemeral Split

Durable PostgreSQL state owns:

- request identity and requester identity
- queue compatibility tuple
- request lifecycle status and terminal outcome
- request expiry deadline
- proposal identity, lifecycle status, and match id
- proposal member participation and acceptance history
- proposal resolution timestamps

Ephemeral Redis state owns:

- queue ordering
- queue lock ownership
- proposal lease presence and TTL
- runtime queue-position projection

Derived projections own:

- materialized expired request status on access
- materialized expired proposal state on access
- queue position
- candidate count
- match-ready handoff payload

## Concurrency

Duplicate requester protection and queue-cycle correctness use the following strategy:

- open a PostgreSQL transaction
- lock active requester rows or candidate request rows with `FOR UPDATE`
- rely on a partial unique active-request index for DB-level duplicate prevention
- use a short Redis queue lock to prevent two workers from selecting the same queue slice concurrently
- durably create the proposal and update selected requests before removing Redis queue entries

The active-request unique index provides durable protection if two concurrent enqueue operations race the same requester.

## Redis Model

Matchmaking runtime state uses a versioned namespace, defaulting to `gc:v1:mm`.

Key families:

- `gc:v1:mm:queue:{queueKey}`
- `gc:v1:mm:lock:queue:{queueKey}`
- `gc:v1:mm:proposal:{proposalId}`

Queue ordering is stored as a sorted set scored by `requestedAt` epoch milliseconds. Queue keys use a 15-minute TTL. Proposal leases use a TTL derived from the proposal timeout window. Queue locks use a 5-second TTL.

## Postgres Model

Three tables model the durable state:

- `matchmaking_requests`
- `match_proposals`
- `match_proposal_members`

Key constraints:

- one active request per requester where status is `queued` or `proposed`
- one non-null `match_id` per proposal
- one proposal membership row per `(proposal_id, request_id)`

No JSONB is required in Slice 4 because the durable compatibility tuple is bounded and relational.

## Expiry And Reconstruction

- request expiry is stored durably in PostgreSQL
- proposal timeout is stored durably in PostgreSQL and mirrored as a Redis lease
- access after proposal timeout durably marks pending members as `timed_out`, expires the proposal, and requeues surviving requests
- Redis flush or restart loses only runtime coordination keys; durable requests and proposals remain intact
- queued requests are reconstructed into Redis on later access paths if runtime state is missing

## Failure Semantics

PostgreSQL down:

- process stays alive
- readiness returns `503`
- durable matchmaking operations return controlled `503` with `MATCHMAKING_UNAVAILABLE`

Redis down:

- process stays alive
- readiness returns `503`
- `GET request` may still return durable state with unavailable runtime projection
- queue mutation paths return controlled `503` with `MATCHMAKING_UNAVAILABLE`

Recovery of either dependency does not require restarting platform-api or the gateway.

## Alternatives Considered

### Keep matchmaking entirely in Redis

Rejected because request history, duplicate prevention, proposal membership, and terminal outcomes must survive Redis loss.

### Persist queue ordering in PostgreSQL only

Rejected because queue ordering, position, and short-lived worker locks are high-churn runtime concerns better handled by Redis.

### Add Session persistence and allocator orchestration now

Rejected because Slice 4 stops at durable match readiness and should not widen into Session ownership prematurely.

### Add NATS-driven worker coordination now

Rejected because no real cross-boundary consumer exists yet and the modular monolith can run queue cycles directly through internal abstractions.

## Consequences

- Matchmaking now has a clear durable/runtime boundary that survives Redis loss.
- Duplicate requester races are protected by PostgreSQL rather than only runtime assumptions.
- Timeout and rejection semantics are preserved durably and can rehydrate runtime state after Redis loss.
- Session ownership remains cleanly separated behind `MatchReadySink`, preserving the future extraction path.