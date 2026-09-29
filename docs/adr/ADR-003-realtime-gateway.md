# ADR-003 Realtime Gateway

Status: Accepted

## Context

Realtime workloads are connection-heavy and operationally different from request/response business services. The current prototype embeds WebSocket handling directly inside the lobby server.

## Decision

Introduce a dedicated realtime gateway as a separate concern, with Go as the default implementation language.

The realtime gateway is responsible for:

- WebSocket connection handling
- presence fanout
- high-volume routing
- auth/session validation at the edge

The realtime gateway is not responsible for owning platform business logic and must integrate with `services/platform-api` rather than replacing it.

## Alternatives Considered

- Embedding WebSockets in each business service
- Keeping realtime logic inside lobby-service
- Using Node business services as the primary realtime fanout layer

## Consequences

- The current ws-based lobby transport is temporary only.
- Platform services publish/consume events and commands through stable contracts instead of raw socket ownership.