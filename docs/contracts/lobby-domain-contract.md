# Lobby Domain Contract

Status: Accepted source of truth for Foundation Slice 3

Lobby in Slice 3 is split between durable PostgreSQL state and ephemeral Redis runtime state.

## Durable / Ephemeral / Derived Matrix

| Field / concept | Classification | Storage | Source of truth | Recovery behavior |
| --- | --- | --- | --- | --- |
| `lobbyId` | Durable | PostgreSQL `lobbies.lobby_id` | PostgreSQL | Survives Redis loss and service restarts. |
| `gameId` | Durable | PostgreSQL `lobbies.game_id` | PostgreSQL | Re-read on every durable fetch. |
| `ownerPlayerId` | Durable | PostgreSQL `lobbies.owner_player_id` | PostgreSQL | Recomputed only through durable owner-transfer logic, never from Redis. |
| `visibility` | Durable | PostgreSQL `lobbies.visibility` | PostgreSQL | Survives Redis loss unchanged. |
| `capacity` | Durable | PostgreSQL `lobbies.capacity` | PostgreSQL | Used for transactional seat enforcement after recovery. |
| `minimumPlayers` | Durable | PostgreSQL `lobbies.minimum_players` | PostgreSQL | Used for start gating after recovery. |
| `status` | Durable | PostgreSQL `lobbies.status` | PostgreSQL | Materialized as `expired` on access when `expiresAt` has elapsed. |
| `configuration` | Durable | PostgreSQL `lobbies.configuration` JSONB | PostgreSQL | Survives Redis loss unchanged. |
| `membership` | Durable | PostgreSQL `lobby_members` | PostgreSQL | Membership history survives Redis loss and outage windows. |
| `joinedAt` | Durable | PostgreSQL `lobby_members.joined_at` | PostgreSQL | Preserved for deterministic owner selection. |
| `leftAt` | Durable | PostgreSQL `lobby_members.left_at` | PostgreSQL | Marks inactive membership without deleting history. |
| `ready state` | Ephemeral | Redis set | Redis while available | Lost on Redis flush/restart; rebuilt by new ready operations only. |
| `presence` | Ephemeral | Redis hash | Redis while available | Lost on Redis flush/restart; defaults to disconnected projection. |
| `connection state` | Ephemeral | Redis hash payload | Redis while available | Lost on Redis flush/restart; defaults to disconnected projection. |
| `reconnect state` | Ephemeral | Redis hash payload `reconnectDeadlineAt` | Redis while available | Lost on Redis flush/restart; reconnect grace is not durable. |
| `locks` | Derived implementation concern | PostgreSQL row lock on `lobbies` during write transactions | PostgreSQL transaction | Re-established per command; never persisted as domain data. |
| `heartbeat` | Ephemeral | Redis presence `lastSeenAt` | Redis while available | Lost on Redis flush/restart; no durable corruption. |
| `member count` | Derived | Computed from durable active members | PostgreSQL membership rows | Recomputed on every read. |
| `allReady` | Derived | Computed from active durable members plus Redis ready set | Mixed: PostgreSQL + Redis | Falls back to `false` when Redis data is lost or unavailable. |
| `availableSeats` | Derived | `capacity - active durable members` | PostgreSQL | Recomputed on every read. |
| `expiry` | Durable deadline + derived status | PostgreSQL `lobbies.expires_at` | PostgreSQL | On access, an expired open lobby is durably updated to `expired` and runtime keys are cleared. |

## Final State Machine

Actual code states are `open`, `starting`, `started`, `closed`, and `expired`.

| From | To | Command / trigger | Allowed? | Reason / invariant |
| --- | --- | --- | --- | --- |
| none | `open` | `createLobby` | Yes | New lobbies are created only in `open`. |
| `open` | `open` | `joinLobby` | Yes | Adds active durable membership or returns idempotent projection for existing active member. |
| `open` | `open` | `setReady` | Yes | Ready is runtime-only; durable status does not change. |
| `open` | `open` | non-owner leave | Yes | Membership changes; lobby remains open if active members remain. |
| `open` | `open` | owner leave with successor | Yes | Owner transfers deterministically to oldest active durable member. |
| `open` | `closed` | owner `closeLobby` | Yes | Explicit owner close. |
| `open` | `closed` | owner leave as last active member | Yes | No active membership remains. |
| `open` | `starting` | owner `startLobby` | Yes | Requires minimum players satisfied and all active members ready. |
| `open` | `expired` | access after `expiresAt` | Yes | `expireIfNeeded` durably updates status and clears runtime state. |
| `starting` | `starting` | repeated `startLobby` | Yes | Idempotent retry; no second durable transition. |
| `starting` | `closed` | owner `closeLobby` | Yes | Explicit close remains allowed before `started`. |
| `starting` | any join/leave/ready | No | `INVALID_LOBBY_STATE`; runtime is already transitioning. |
| `started` | any command in Slice 3 | No | `started` is terminal in this slice. |
| `closed` | any mutating command | No | `closed` is terminal. |
| `expired` | any mutating command | No | `expired` is terminal. |

## Ownership Policy

- When a normal member leaves an `open` lobby, only that member becomes inactive; ownership does not change.
- When the owner leaves an `open` lobby and another active member exists, ownership transfers to the oldest active durable member.
- Successor selection is deterministic: earliest `joinedAt`, then `playerId` lexical tie-break.
- When the owner leaves and no active members remain, the lobby transitions to `closed`.
- Owner leave is rejected outside `open` because leave is rejected outside `open` for all members.

## Reconnect Semantics

- Durable membership survives disconnect because membership is stored only in PostgreSQL and disconnect never writes `leftAt`.
- Presence is runtime-only and stored in Redis under the lobby presence hash.
- Disconnect moves runtime `connectionState` to `reconnecting` and writes `reconnectDeadlineAt`.
- Reconnect grace is `2` minutes (`LOBBY_RECONNECT_GRACE_MS`).
- Ready does not survive disconnect; disconnect removes the member from the Redis ready set.
- If Redis state is lost entirely, durable membership still survives and runtime projects as disconnected/unready.

## Ready-State Semantics

- A member may become ready only when they are an active durable member and the lobby status is `open`.
- Ready is reset when a new member joins.
- Ready is reset when any member leaves.
- Ready is reset on disconnect because `markDisconnected` removes the player from the ready set.
- Ready is cleared for all members when the lobby enters `starting`, `closed`, or `expired` because runtime keys are removed.
- Configuration is immutable after lobby creation in Slice 3, so there is no configuration-mutation command and therefore no runtime reset path tied to config changes.

## Expiry Policy

- `expiresAt` is stored durably in PostgreSQL on the lobby record.
- New open lobbies receive `expiresAt = now + 4 hours`.
- Successful join and leave operations extend `expiresAt`.
- `GET /api/lobbies/:lobbyId` may return an expired lobby: the access path first materializes expiry durably, then returns status `expired`.
- Join and start against an expired lobby fail with `INVALID_LOBBY_STATE` after the durable status is advanced to `expired`.
- Expiry cleanup clears Redis runtime keys and keeps durable lobby and membership history intact.

## Cleanup Policy

| Terminal / cleanup state | PostgreSQL durable state | Redis runtime state |
| --- | --- | --- |
| `closed` | Lobby row remains with status `closed`; membership history remains intact. | Presence and ready keys are deleted. |
| `expired` | Lobby row remains with status `expired`; membership history remains intact. | Presence and ready keys are deleted during `expireIfNeeded`. |
| `starting` | Lobby row remains with status `starting`. | Presence and ready keys are deleted immediately after start to prevent stale ready/presence state. |
| `started` | No transition implementation in Slice 3 beyond contract shape. | No separate cleanup path yet because `started` is not entered by transport flow in Slice 3. |

## Error Contract

Actual lobby error codes are:

- `LOBBY_NOT_FOUND`
- `LOBBY_FULL`
- `LOBBY_CLOSED`
- `NOT_LOBBY_MEMBER`
- `NOT_LOBBY_OWNER`
- `INVALID_LOBBY_STATE`
- `PLAYER_NOT_READY`
- `LOBBY_NOT_READY`
- `LOBBY_UNAVAILABLE`
- `GAME_NOT_FOUND`
- `INVALID_GAME_CONFIGURATION`
- `INVALID_JOIN_CODE`
- `PRIVATE_LOBBY_ACCESS_DENIED`
- `INVALID_PLAYER_ID`

## Identity Boundary

Slice 3 uses a transitional test/development identity boundary:

- identity source: `x-player-id`
- optional request correlation: `x-request-id`
- request body never supplies player identity

Removal condition:

- replace `x-player-id` once the Auth boundary provides authenticated player identity to the Lobby transport layer.