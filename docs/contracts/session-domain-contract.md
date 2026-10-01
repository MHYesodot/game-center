# Session Domain Contract

Status: Accepted source of truth for P01 Session Lifecycle

## Boundary

Sessions starts only after Matchmaking has produced a trusted matched proposal.

- inbound trusted read boundary: `MatchReadyQuery.getMatchReady(matchId)`
- inbound push boundary: `SessionMatchReadyHandler.onMatchReady(match)`
- outbound allocation boundary: `SessionAllocationPort.requestAllocation(input)`

Sessions must not read Matchmaking repositories, tables, or Redis internals directly.

## Durable Aggregate

### `GameSession`

- `sessionId`
- `source.kind = 'matchmaking'`
- `source.matchId`
- `source.proposalId`
- `gameId`
- `queueType`
- `platform`
- `region`
- `gameVersion`
- `protocolVersion`
- `status`
- `participants`
- `createdAt`
- `updatedAt`
- `startedAt`
- `completedAt`
- `failedAt`
- `cancelledAt`
- `expiresAt`
- `failureCode`

### `SessionParticipant`

- `playerId`
- `sourceRequestId`
- `sourceLobbyId`
- `joinedAt`

## State Contract

Supported states in code:

- `created`
- `allocating`
- `ready`
- `connecting`
- `active`
- `completing`
- `completed`
- `failed`
- `cancelled`
- `expired`

Terminal states:

- `completed`
- `failed`
- `cancelled`
- `expired`

P01 transport uses only:

- `created`
- `allocating`
- `failed`
- `cancelled`
- `expired`

## Idempotency Contract

- `create session from match` is idempotent by `matchId`
- participant authorization is evaluated against the persisted roster, not the request body
- concurrent retries must converge on one durable session row
- allocator request dispatch may be claimed only once from `created`

## API Contract

### `POST /api/sessions`

Auth:

- authenticated `gc_session` cookie required
- `x-request-id` remains optional correlation id

Body:

- `matchId`

Behavior:

- creates or reuses the durable session for the trusted matched proposal
- returns the session only when the caller is one of the session participants
- does not return allocator endpoint metadata in P01

### `GET /api/sessions/:sessionId`

- caller must be a session participant
- non-participants receive semantic not-found behavior

### `POST /api/sessions/:sessionId/cancel`

- caller must be a session participant
- cancellation is allowed only before the session becomes `active`

## Error Contract

- `SESSION_NOT_FOUND`
- `MATCH_NOT_READY`
- `SESSION_INVALID_STATE`
- `SESSION_EXPIRED`
- `SESSION_CREATION_FAILED`
- `SESSION_UNAVAILABLE`
- `INVALID_PLAYER_ID`

## Explicit Non-Goals For P01

- no fake server id, host, port, endpoint, or token
- no realtime connection orchestration
- no runtime result ingestion
- no Redis-owned session state
- no Session imports of Matchmaking persistence internals