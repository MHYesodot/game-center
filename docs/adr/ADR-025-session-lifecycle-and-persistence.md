# ADR-025 Session Lifecycle And Persistence

Status: Accepted

## Context

Matchmaking Slice 4 now emits a durable matched outcome and stops at a `MatchReadySink` boundary. The repository still contained a placeholder Sessions module that fabricated allocator output and served seed data from memory.

P01 requires a real session domain without drifting into allocator implementation, realtime orchestration, or authentication work from later phases.

## Decision

- Persist Sessions in PostgreSQL through Drizzle.
- Model session ownership around a durable `matchId -> sessionId` invariant.
- Snapshot the trusted Matchmaking outcome into the session aggregate and participant rows.
- Keep P01 Postgres-only; do not introduce Redis until a concrete runtime need exists.
- Keep allocator orchestration behind `SessionAllocationPort` only.
- Do not fabricate server identity, endpoint, host, port, or connection token.
- Expose session creation and reads through HTTP now:
  - `POST /api/sessions`
  - `GET /api/sessions/:sessionId`
  - `POST /api/sessions/:sessionId/cancel`
- Read Matchmaking only through a public `MatchReadyQuery` boundary and receive push handoff through `SessionMatchReadyHandler`.

## Consequences

- Session creation is now durable and idempotent by `matchId`.
- Participant authorization is enforced from persisted session membership.
- Allocation request dispatch is concurrency-safe without leaking fake runtime metadata.
- Matchmaking remains decoupled from Session persistence internals.
- P02 can add allocator callbacks and ready/connection metadata without reworking the P01 storage boundary.

## Alternatives Considered

- continuing placeholder in-memory session data: rejected because it cannot satisfy P01 durability or idempotency
- storing session runtime in Redis now: rejected because no current session behavior requires ephemeral ownership
- reading Matchmaking tables directly from Sessions internals: rejected because it breaks module boundaries and duplicates source-of-truth rules
- returning fake allocator data during create: rejected because it creates a false public contract before a real allocator exists