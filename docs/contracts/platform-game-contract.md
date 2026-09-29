# Platform Game Contract Overview

Status: Draft architecture contract

## Purpose

This document defines the boundary between platform services and independent game products. It is not the final wire-format specification, but it is the mandatory conceptual contract for future implementation.

## Contract Principles

1. Platform services never embed game-specific rules.
2. Game servers are authoritative for gameplay state and results.
3. Contracts are versioned.
4. Games are discovered through manifests, not `if game == ...` platform branching.

## Contract Surfaces

### HTTP / Gateway contracts

- authentication
- player profile
- catalog and manifest discovery
- lobby lifecycle
- matchmaking lifecycle
- session lifecycle metadata

### Async event contracts

- `player.created`
- `lobby.created`
- `match.created`
- `session.started`
- `session.completed`
- `achievement.unlocked`
- `leaderboard.updated`

### Game session contracts

- `CreateSession`
- `JoinSession`
- `LeaveSession`
- `PlayerReady`
- `StartMatch`
- `Heartbeat`
- `Reconnect`
- `EndMatch`
- `ReportResult`
- `TerminateSession`

## Required Version Metadata

Every client, session, and dedicated game server must provide:

- `gameId`
- `gameVersion`
- `protocolVersion`
- `buildVersion`

## Future Contract Packaging

The repository will introduce:

```text
packages/contracts/
  player/
  lobby/
  matchmaking/
  session/
  game-server/
```

OpenAPI is the default for HTTP contracts. AsyncAPI is the default for event contracts. Protobuf or gRPC may be introduced only where justified by ADR.