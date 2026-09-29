# ADR-006 Messaging Infrastructure

Status: Accepted

## Context

Platform services require low-coupling integration for lifecycle events, projection updates, and async workflows. The current prototype has no event backbone.

## Decision

Use NATS JetStream as the event bus for platform integration.

Examples:

- `player.created`
- `lobby.created`
- `match.created`
- `session.started`
- `session.completed`
- `achievement.unlocked`
- `leaderboard.updated`

## Alternatives Considered

- Direct HTTP chaining only
- Shared database integration
- RabbitMQ or Kafka from day one

## Consequences

- Services integrate asynchronously without shared tables.
- Event contracts must be documented and versioned.
- Operational complexity stays moderate for the current scale.