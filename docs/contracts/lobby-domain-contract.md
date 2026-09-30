# Lobby Domain Contract

Foundation Slice 3 defines Lobby as a durable PostgreSQL-backed domain with Redis-backed runtime state.

## Durable / Ephemeral / Derived Matrix

| Field | Classification | Notes |
| --- | --- | --- |
| `lobbyId` | DURABLE | Stable lobby identity. |
| `gameId` | DURABLE | Catalog-linked game identifier. |
| `ownerPlayerId` | DURABLE | Must always reference an active durable member unless lobby is `closed` or `expired`. |
| `status` | DURABLE | Explicit lifecycle state machine. |
| `visibility` | DURABLE | `public` or `private`. |
| `capacity` | DURABLE | Seat cap for active members. |
| `minimumPlayers` | DURABLE | Start precondition boundary. |
| `configuration` | DURABLE | Versioned, bounded game-specific lobby configuration. |
| `joinCodeHash` | DURABLE | Only for private lobby access control when configured. |
| `createdAt` | DURABLE | Audit timestamp. |
| `updatedAt` | DURABLE | Audit timestamp. |
| `closedAt` | DURABLE | Populated only after close. |
| `expiresAt` | DURABLE | Policy-driven expiry boundary. |
| `LobbyMember.joinedAt` | DURABLE | Membership history. |
| `LobbyMember.leftAt` | DURABLE | History-preserving leave marker. |
| `presence` | EPHEMERAL | Online/offline runtime signal only. |
| `connectionState` | EPHEMERAL | `connected`, `disconnected`, `reconnecting`. |
| `ready` | EPHEMERAL | Runtime-only ready state. |
| `lastSeenAt` | EPHEMERAL | Heartbeat/presence freshness. |
| `reconnectDeadlineAt` | EPHEMERAL | Short-lived reconnect grace window. |
| runtime locks | EPHEMERAL | Redis coordination only, never source of truth. |
| operation idempotency cache | EPHEMERAL | Optional runtime optimization only. |
| `activeMemberCount` | DERIVED | From active durable members. |
| `availableSeats` | DERIVED | `capacity - activeMemberCount`. |
| `allMembersReady` | DERIVED | From active durable members and ready runtime state. |
| `connectedMemberCount` | DERIVED | From runtime presence. |

## State Machine

Initial state is `open`.

Allowed transitions:

- `open -> starting`
- `starting -> started`
- `open -> closed`
- `starting -> closed`
- `open -> expired`

Terminal states:

- `started`
- `closed`
- `expired`

Invalid transitions fail with `INVALID_LOBBY_STATE`.

## Ownership Policy

- Every non-terminal lobby has exactly one owner.
- Owner must be an active durable member.
- If the owner leaves an `open` lobby and other active members remain, ownership transfers deterministically to the oldest active durable member.
- If the owner leaves and no active members remain, the lobby closes.
- Owner leave is not allowed once the lobby has moved past `open`.

## Join Semantics

- Join is idempotent.
- Repeated join by an already active member returns the current lobby projection without duplicating membership or consuming capacity.
- Private lobbies require a matching join code when configured.
- Capacity is enforced on durable active membership, not runtime presence.

## Leave Semantics

- Leave marks `leftAt` on the durable membership row; membership history is retained.
- Repeated leave by a non-active member fails with `NOT_LOBBY_MEMBER`.
- Leaving in `starting` or `started` fails with `INVALID_LOBBY_STATE` in this slice.

## Ready Semantics

- Ready state exists only in Redis.
- Only active durable members can toggle ready.
- Ready is allowed only while the lobby is `open`.
- Ready state resets when a member joins, leaves, or lobby configuration changes.
- Disconnect clears ready. Reconnect restores presence only; the player must ready again.

## Start Semantics

- Caller must be the owner.
- Lobby must be `open`.
- Active member count must be between `minimumPlayers` and `capacity`.
- All active durable members must currently be ready.
- Start is idempotent once the lobby has already entered `starting`.

## Failure Semantics

- PostgreSQL outage: durable operations fail with `503` and `LOBBY_UNAVAILABLE`.
- Redis outage: runtime-dependent operations fail with `503` and `LOBBY_UNAVAILABLE`.
- Durable data remains authoritative if Redis state is lost or flushed.