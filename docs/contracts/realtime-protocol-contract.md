# Realtime Protocol Contract

Status: Accepted source of truth for P04 Realtime Gateway

## Protocol Version

- current gateway protocol version: `realtime.v1`
- realtime protocol version is independent from frontend bundle version

## Handshake

The client must complete a handshake before registration succeeds.

Required handshake fields:

- `protocolVersion`
- `playerId` using the current transitional identity boundary
- `clientType`
- `clientVersion`
- `platform`

Handshake success means:

- protocol version is supported
- one player identity is resolved and bound to the connection
- `connectionId` is issued by the gateway
- the connection is registered in local and Redis runtime registries
- the player direct channel `player:<playerId>` is subscribed implicitly

Handshake failure means the connection is rejected or closed semantically and must not leave stale Redis state behind.

## Envelope Families

All gateway traffic uses a stable envelope with `protocolVersion` and `messageId`.

### Client command envelope

- `kind = command`
- `type`
- `messageId`
- `timestamp`
- optional `correlationId`
- `payload`

### Server event envelope

- `kind = event`
- `type`
- `messageId`
- `timestamp`
- optional `correlationId`
- `payload`

### ACK envelope

- `kind = ack`
- `type`
- `messageId`
- `timestamp`
- `correlationId`
- `status = received | accepted | rejected`
- optional `details`

### Error envelope

- `kind = error`
- `type = error`
- `messageId`
- `timestamp`
- optional `correlationId`
- `code`
- `messageKey`
- optional safe `details`

## Supported Command Types

- `connection.handshake`
- `connection.ping`
- `subscription.subscribe`
- `subscription.unsubscribe`

P04 does not add domain business commands over websocket beyond subscription and transport control.

## Supported Event Categories

P04 supports concrete platform events only for current flows:

- Lobby updates
- Matchmaking request and proposal updates
- Session lifecycle updates
- direct player-scoped updates

## ACK Semantics

- `received`: gateway accepted the frame and envelope shape
- `accepted`: gateway accepted the command for processing or applied the subscription mutation
- `rejected`: gateway rejected the command semantically or structurally

An ACK never implies that a platform domain transition succeeded unless the event or payload explicitly says so.

Additional command semantics:

- `subscription.subscribe` and `subscription.unsubscribe` return success ACKs only after the local registry and Redis runtime mutation both succeed.
- Dependency failure during handshake or subscription authorization returns semantic `REALTIME_UNAVAILABLE`.
- Rate limiting, oversized payloads, and heartbeat expiry may close the websocket at the transport layer without a preceding domain event envelope.

## Error Codes

Gateway-level semantic codes include:

- `INVALID_MESSAGE`
- `UNKNOWN_MESSAGE_TYPE`
- `UNSUPPORTED_PROTOCOL_VERSION`
- `HANDSHAKE_REQUIRED`
- `HANDSHAKE_TIMEOUT`
- `INVALID_PLAYER_ID`
- `SUBSCRIPTION_DENIED`
- `REALTIME_UNAVAILABLE`
- `RATE_LIMITED`
- `PAYLOAD_TOO_LARGE`
- `SLOW_CONSUMER`

## Disconnect Reasons

- `NORMAL`
- `HEARTBEAT_TIMEOUT`
- `PROTOCOL_ERROR`
- `UNSUPPORTED_VERSION`
- `RATE_LIMITED`
- `SLOW_CONSUMER`
- `SERVER_SHUTDOWN`
- `DEPENDENCY_FAILURE`

## Channel Patterns

- `player:<playerId>`
- `lobby:<lobbyId>`
- `matchmaking:request:<requestId>`
- `session:<sessionId>`

Clients send typed subscription intent; they do not send arbitrary channel strings.

## Delivery Semantics

- best effort per channel
- duplicate delivery tolerated
- no global ordering guarantee
- no exactly-once guarantee
- local recipient fanout skips already-closed connections
- a full outbound queue is treated as a slow-consumer transport failure and the affected connection is closed

## Explicit Non-Goals

- no P05 authentication token model
- no gameplay packet proxy
- no chat or social protocol
- no fake permanent identity contract