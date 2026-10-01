# ADR-028 Realtime Gateway Control-Plane Boundary

Status: Accepted

## Context

ADR-003 established that realtime transport should be separated from the business runtime, but P04 required closure on the exact boundary and operating semantics.

The repository now contains a real Go websocket gateway, a Redis runtime registry, and NATS-based cross-node event fanout. The closure risk was not whether a gateway should exist, but whether it would stay inside the approved platform control-plane boundary instead of drifting into persistence or gameplay ownership.

## Decision

The P04 realtime gateway is locked to the following responsibilities:

- websocket handshake, heartbeat, payload, and rate-limit enforcement
- typed subscription lifecycle for player, lobby, matchmaking-request, and session channels
- process-local connection ownership and bounded outbound queues
- Redis-backed runtime projection for connection metadata, channel membership, and presence
- core NATS live fanout consumption for concrete platform realtime events

The gateway must not own any of the following:

- PostgreSQL or Drizzle access
- Lobby, Matchmaking, Session, or Allocation persistence logic
- gameplay packet proxying or game-server protocol design
- authenticated identity redesign beyond the transitional P04 player binding

Platform domain code remains authoritative for subscription authorization and event publication through public boundaries in `services/platform-api`.

## Consequences

- Session `ready` proofs depend on the existing Platform API migration set being applied explicitly in DEV; compose startup does not auto-migrate the database.
- Redis and NATS remain operational dependencies for readiness, but only Redis owns runtime projection and only NATS owns best-effort cross-node transport.
- Game products keep authoritative gameplay transport outside the realtime gateway.
- Architecture validation must reject gateway persistence leaks, gameplay protocol leakage, and non-gateway imports of gateway internals.