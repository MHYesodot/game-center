# Platform Domain Model

Status: Accepted source of truth for Foundation Slice 1.1 domain modeling

## Module Classification

| Module | Classification | Scope in Phase 1 |
| --- | --- | --- |
| Auth | Boundary placeholder | Identity boundary only. No meaningful implementation beyond status until authentication use cases arrive. |
| Players | Boundary placeholder | Player profile ownership boundary only. No persistence work in this slice. |
| Social | Boundary placeholder | Friends, parties, and presence boundary only. No persistence work in this slice. |
| Catalog | Active domain seed | Canonical game definitions, manifests, versions, and capabilities. |
| Lobby | Active domain seed | Pre-session room lifecycle, members, readiness, visibility, and launch intent. |
| Matchmaking | Active persisted domain | Durable matchmaking requests and proposals in PostgreSQL plus ephemeral queue runtime coordination in Redis. |
| Sessions | Active domain seed | Session metadata, participant roster, connection handoff, result envelope, and game-server allocation orchestration. |

The intent is explicit: Phase 1 keeps boundary shells only where the business capability is not yet active, while the gameplay-adjacent flow is modeled now as real domains. Catalog, Lobby, and Matchmaking are persisted; Sessions remains a seed boundary for later slices.

## Domain Separation Rules

- `Catalog` owns what a game is and which platform capabilities it advertises.
- `Lobby` owns how a group prepares to launch a game.
- `Matchmaking` owns how queued demand becomes a match.
- `Sessions` owns post-match metadata and handoff to an authoritative game runtime.
- `Game Server Allocation` is a subdomain of `Sessions`, not a separate top-level module in Phase 1.
- Platform services never own gameplay state, win logic, or simulation state.
- Platform APIs return domain-safe identifiers, metadata, and error codes rather than translated user messages.

## Catalog Domain

### Aggregates and Value Objects

- `GameDefinition`: product-facing catalog identity and lifecycle status.
- `GameManifest`: integration-facing read projection assembled for clients from persisted catalog records.
- `GameVersion`: compatibility tuple for game, protocol, and build versions.
- `GameCapabilities`: declared support for multiplayer, ranking, spectators, replays, and private rooms.
- `GamePlatformAvailability`: advertised platform matrix for the active catalog version.
- `GameDistributionMetadata`: minimum supported platform version plus launch and distribution strategy metadata.
- `GameRuntime`: client runtime, engine family, and server topology.

### Read Model Shape

- `GameDefinition` owns canonical identity, lifecycle state, category, and semantic localization keys.
- `GameVersion` owns the active compatibility tuple and runtime description.
- `GameCapabilities`, `GamePlatformAvailability`, and `GameDistributionMetadata` hang off the active catalog version.
- `GameManifest` remains the wire-level shape returned to platform clients, but it is a projection rather than the persistence root.

### Invariants

- `gameId` is the canonical integration identifier.
- `slug` is stable for web navigation and operator-facing routing.
- `GameManifest.version` must be present before a title becomes `active`.
- catalog metadata must carry platform availability and future distribution strategy fields.
- `GameCapabilities.multiplayer = true` implies server allocation and session flows are defined, even if the allocator implementation is stubbed in DEV.
- exactly one active catalog version may exist per `gameId` at a time.
- semantic localization keys are persisted as keys only; translated strings remain in the shared i18n bundles.

### Persistence Classification

- Persistent in PostgreSQL: `GameDefinition`, active and historical `GameVersion` rows, version-scoped capabilities, platform availability, and distribution metadata.
- Implementation shape: normalized relational tables joined into the manifest read model through the catalog repository.
- Seed strategy: deterministic idempotent seed data is allowed for DEV, integration tests, and smoke validation so long as the live API still reads from PostgreSQL.
- Ephemeral: none required for baseline catalog reads.

## Lobby Domain

### Aggregates and Value Objects

- `DurableLobbyRecord`: durable lobby aggregate root persisted in PostgreSQL.
- `DurableLobbyMemberRecord`: durable membership history row persisted in PostgreSQL.
- `LobbyConfiguration`: versioned, bounded, opaque configuration stored durably as JSONB.
- `LobbyRuntimeState`: Redis-backed runtime projection for presence and ready state.
- `LobbyState`: `open | starting | started | closed | expired`.
- `LobbyVisibility`: `public | private`.
- `LobbyRole`: `owner | member`.

### Invariants

- Every non-terminal lobby has exactly one active owner at a time.
- Active membership count must never exceed `capacity`.
- Only active durable members may toggle ready state.
- Start requires `minimumPlayers` active members and all active members ready.
- Durable membership survives Redis loss and disconnect because runtime state is not the source of truth for membership.

### Persistent vs Ephemeral

- Persistent in PostgreSQL: lobby identity, game binding, owner, status, visibility, capacity, minimum players, configuration, join-code hash, expiry timestamps, and membership history.
- Ephemeral in Redis: presence, connection state, ready state, reconnect deadline, and heartbeat freshness.
- Derived: active member count, available seats, all-members-ready, connected member count.

## Matchmaking Domain

### Aggregates and Value Objects

- `DurableMatchmakingRequest`: durable request owned by Matchmaking and persisted in PostgreSQL.
- `DurableMatchProposal`: durable proposal aggregate root persisted in PostgreSQL.
- `DurableMatchProposalMember`: durable acceptance member row persisted in PostgreSQL.
- `MatchmakingQueueIdentity`: compatibility tuple composed from game, queue type, platform, region, game version, and protocol version.
- `MatchQueuePolicy`: queue policy abstraction that defines match size and proposal timeout.

### Invariants

- A requester may own at most one active request in `queued` or `proposed` at a time.
- Queue compatibility is determined only by the full queue identity tuple.
- Proposal membership is durable and is the source of truth for accept, reject, timeout, and final match readiness.
- Queue ordering and short-lived worker coordination are ephemeral and recoverable from durable state.
- Matchmaking may depend on Catalog only through the public catalog query boundary.
- Session persistence and game-server allocation remain out of scope for this slice; handoff stops at `MatchReadySink`.

### Persistent vs Ephemeral

- Persistent in PostgreSQL: matchmaking requests, proposal aggregates, proposal membership, request terminal outcome, proposal resolution timestamps, and durable compatibility tuple.
- Ephemeral in Redis: active queue ordering, queue locks, proposal leases, runtime queue position, and recovery-time search coordination.
- Derived: queue position, candidate counts, materialized expired request state on access, and match-ready payload projection.

### Request Lifecycle

`queued -> proposed -> matched`

Exit states:

- `cancelled`
- `expired`
- `failed`

Additional recovery transition:

- `proposed -> queued` when a proposal is rejected or expires.

### Proposal Lifecycle

`pending -> matched`

Exit states:

- `rejected`
- `expired`
- `cancelled`
- `failed`

### Modeling Notes

- Quick play is the only concrete queue type in Slice 4.
- Player requests are the only concrete requester type in Slice 4; party support remains behind the transport and domain abstractions.
- Queue matching uses a strategy abstraction with FIFO as the initial concrete policy.
- Redis loss must not lose durable request or proposal state; runtime queue entries are reconstructed from PostgreSQL on later access.
- NATS is not part of the runtime-critical Matchmaking path in this slice because there is no real cross-boundary consumer yet.

## Sessions Domain

### Aggregates and Value Objects

- `GameSession`: metadata record for a launched play session.
- `SessionParticipant`: player or spectator attached to the session.
- `SessionEndpoint`: connection handoff returned to clients.
- `SessionState`: `allocating -> ready -> active -> ending -> completed | terminated | failed`.
- `SessionResult`: envelope reported by the authoritative game runtime.

### Match vs Session Distinction

- A `Match` is the matchmaking outcome that says who should play.
- A `GameSession` is the runtime instance that says where and how they play.
- Not all sessions come from matchmaking. Private lobbies may allocate a session directly.

### Persistent vs Ephemeral

- Persistent later in PostgreSQL: session identity, participants, version tuple, allocation references, result envelope.
- Ephemeral in Redis later: reconnect tokens, transient connection handoff state, live presence markers.

## Game Server Allocation Subdomain

### Core Types

- `GameServerAllocationRequest`
- `GameServerAllocation`
- `AllocatorDescriptor`

### Ownership Rules

- Allocation orchestration belongs to `Sessions`.
- Actual game runtime provisioning belongs to the allocator implementation.
- DEV may use a future `docker-dev` allocator.
- Production is expected to use a Kubernetes/Agones-backed allocator via ADR.

### Current Phase 1 Rule

- keep allocator as an interface plus no-op DEV implementation
- do not implement real Docker or Kubernetes provisioning in this slice

## Sequence Diagrams

### Catalog to Lobby Launch

```mermaid
sequenceDiagram
    participant Web
    participant Catalog
    participant Lobby

    Web->>Catalog: list active games
    Catalog-->>Web: game definitions + manifests
    Web->>Lobby: create or join lobby for gameId
    Lobby-->>Web: lobby state + members + settings
```

### Matchmaking to Session Allocation

```mermaid
sequenceDiagram
    participant Lobby
    participant Matchmaking
    participant Sessions
    participant Allocator as Game Server Allocator
    participant Runtime as Authoritative Game Runtime

    Lobby->>Matchmaking: enqueue ticket
    Matchmaking-->>Lobby: proposal accepted
    Matchmaking->>Sessions: create session request
    Sessions->>Allocator: allocate game runtime
    Allocator-->>Sessions: server ready endpoint
    Sessions-->>Lobby: session handoff metadata
    Lobby-->>Runtime: players connect using endpoint
```

### Result Reporting

```mermaid
sequenceDiagram
    participant Runtime as Authoritative Game Runtime
    participant Sessions
    participant Platform as Downstream Platform Modules

    Runtime->>Sessions: report session result
    Sessions-->>Platform: integration events
    Sessions-->>Runtime: acknowledgement
```

## Failure Ownership Matrix

| Failure | Owning Domain | Notes |
| --- | --- | --- |
| Game manifest missing or incompatible version | Catalog | launch blocked before lobby launch |
| Lobby host disconnects before allocation | Lobby | lobby ownership reassignment or closure |
| Queue proposal expires | Matchmaking | ticket returns to queue or expires |
| Allocator fails to provision server | Sessions | session enters failed state and lobby receives retry or error surface |
| Runtime never reports heartbeat | Sessions | session marked unhealthy and escalated to allocator or operators |
| Result payload invalid for contract version | Sessions | reject envelope and preserve session for retry or termination |

## Idempotency Requirements

- `enqueue matchmaking ticket`: idempotent by client request key or lobby ticket key.
- `accept proposal`: idempotent by `proposalId + ticketId`.
- `create session from match`: idempotent by `matchId`.
- `allocate server`: idempotent by `sessionId`.
- `report result`: idempotent by `sessionId + reportedAt` or a runtime-issued report identifier.
- `terminate session`: idempotent by `sessionId`.

## Integration Event Catalog

- `catalog.game-published`
- `lobby.created`
- `lobby.ready-check-completed`
- `matchmaking.ticket-queued`
- `matchmaking.match-created`
- `sessions.session-created`
- `sessions.session-ready`
- `sessions.result-reported`
- `sessions.session-terminated`