# Realtime Gateway

Status: Accepted source of truth for P04 Realtime Gateway

## Purpose

P04 turns `services/realtime-gateway` into the platform control-plane realtime transport.

The gateway owns connection lifecycle, subscriptions, routing, delivery policy, and bounded transport reliability. It does not own Lobby, Matchmaking, Session, Allocation, or gameplay truth.

## Ownership Map

### Gateway responsibility

- accept and close WebSocket connections
- resolve the current transitional platform identity during handshake
- bind one immutable identity to each connection
- validate protocol version and inbound message envelopes
- maintain process-local socket handles
- maintain Redis-backed connection metadata, subscription membership, and presence projection
- enforce heartbeat, handshake timeout, read limits, payload limits, outbound queue bounds, and rate limits
- consume platform realtime events and fan them out to authorized subscribers
- keep `/health/live` process-local and `/health/ready` dependency-aware

### Platform API responsibility

- remain source of truth for Lobby, Matchmaking, Session, and Allocation domains
- decide whether a player may observe a lobby, matchmaking request, or session channel
- execute domain commands routed through public transport boundaries
- publish only concrete realtime events that have a real gateway consumer
- preserve the existing transitional identity boundary until P05 replaces it

### Redis responsibility

- store versioned ephemeral connection metadata
- store player-to-connection membership
- store channel-to-connection membership
- store connection-to-channel membership
- store presence projection and short-lived reconnect metadata
- store optional rate-limit counters when a limit must outlive one goroutine or connection

Redis is not durable truth and does not own lobby membership, matchmaking ownership, or session participation.

### NATS responsibility

- carry concrete platform realtime events from platform-api to gateway processes
- support cross-node fanout without sharing socket ownership
- remain event transport only; not a generic event soup

### Game server responsibility

- own gameplay authority and game-specific transport
- receive players directly through `ConnectionDescriptor` returned by Allocation and Session flows

### Client responsibility

- open the WebSocket
- send the required handshake with protocol and transitional identity data
- send explicit subscribe and unsubscribe intent
- tolerate duplicate events and reconnect according to documented backoff policy

## Control Plane vs Gameplay Plane

- Realtime Gateway = platform control-plane realtime for lobby, matchmaking, session, and direct player updates.
- Dedicated game servers = gameplay data plane and authoritative game simulation.
- The gateway must not proxy gameplay packets by default.

## Transitional Identity Boundary

P04 uses the current transitional identity boundary:

- handshake identity source: `x-player-id` equivalent payload material presented during websocket handshake
- optional correlation material remains request/message scoped
- the client may not mutate identity after the handshake succeeds

Removal condition:

- replace transitional identity binding when P05 provides authenticated player identity for gateway connections

## Connection Model

### Connection

- `connectionId`: gateway-issued opaque identifier
- `playerId`: resolved transitional platform identity
- `gatewayNodeId`: process-lifecycle node identifier
- `state`: `connecting | connected | closing | closed`
- `protocolVersion`
- `clientType`
- `clientVersion`
- `platform`
- `connectedAt`
- `lastHeartbeatAt`
- `remoteAddress` safe metadata only

### Registry split

- process-local registry owns live socket handles and outbound queues
- Redis registry owns only metadata, presence, subscriptions, and node ownership hints

## Redis Runtime Model

Default namespace: `gc:v1:rt`

Key families:

- `gc:v1:rt:connection:<connectionId>`
- `gc:v1:rt:player:<playerId>:connections`
- `gc:v1:rt:channel:<channel>:connections`
- `gc:v1:rt:connection:<connectionId>:channels`
- `gc:v1:rt:presence:<playerId>`

Policy:

- all connection-related keys carry TTL
- heartbeat and activity refresh TTL
- stale metadata must disappear without graceful shutdown
- socket objects never leave process memory

## Channel Model

P04 channel categories:

- `player:<playerId>`
- `lobby:<lobbyId>`
- `matchmaking:request:<requestId>`
- `session:<sessionId>`

Clients do not choose arbitrary channel strings. They send typed subscribe intent, and gateway validation is delegated to platform-api through public boundaries.

## Transport Contract Summary

- protocol version: `realtime.v1`
- command and event envelopes are versioned and schema validated
- ACK distinguishes transport receipt from domain success
- error payloads carry stable semantic codes instead of localized strings
- delivery is at-least-once/best-effort per channel, not exactly-once and not globally ordered

## Failure Semantics

Redis down:

- live remains up
- ready becomes down
- existing sockets stay connected when possible
- registry and subscription mutations fail semantically

NATS down:

- live remains up
- ready becomes down when event delivery is configured
- existing sockets remain bounded but new event fanout is degraded

platform-api down:

- live remains up
- handshake, authorization, and command routes fail semantically where they depend on platform-api
- existing sockets do not gain new authority from cached client claims