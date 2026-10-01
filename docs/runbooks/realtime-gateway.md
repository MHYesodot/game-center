# Realtime Gateway Runbook

## Prerequisites

- Docker Desktop or Docker Engine is running.
- The DEV stack is up through `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d`.
- `services/platform-api`, `postgres`, `redis`, `nats`, `gateway`, and `realtime-gateway` are healthy.
- Platform API migrations are applied explicitly before runtime proofs:
  - `npm run db:prepare`
  - or at minimum `docker compose exec -T platform-api npm run db:migrate`

## Health Checks

- Routed platform readiness: `http://localhost:8080/health/ready`
- Gateway websocket path: `ws://localhost:8080/realtime/v1/ws`
- Realtime gateway direct readiness: `http://localhost:8081/health/ready`

## Expected Runtime Model

- Handshake binds one `playerId` to one connection and implicitly subscribes that connection to `player:<playerId>`.
- Explicit subscriptions are limited to typed player, lobby, matchmaking-request, and session targets.
- Redis stores only runtime projection under `gc:v1:rt:*` keys.
- NATS carries best-effort live fanout only; it is not durable replay in P04.

## Manual Proof Checklist

- Confirm routed handshake succeeds through `ws://localhost:8080/realtime/v1/ws`.
- Confirm lobby updates reach an authorized lobby subscriber.
- Confirm matchmaking request and proposal updates reach the owning player or request subscriber.
- Confirm session `ready` reaches the player channel after both proposal members accept.
- Confirm a player can explicitly subscribe to `session:<sessionId>` after authorization and read the same session state through HTTP.

## Session READY Proof Notes

- The public flow is: enqueue two compatible requests, observe `matchmaking.proposal.updated`, accept both members, wait for `session.updated` with `status = ready` on the player channel, then subscribe to `session:<sessionId>`.
- If proposal acceptance returns `SESSION_CREATION_FAILED`, first verify the database contains `game_server_allocations`.

Check from Postgres:

```bash
docker compose exec -T postgres psql -U gamecenter -d gamecenter -c "select table_name from information_schema.tables where table_schema = 'public' and table_name = 'game_server_allocations';"
```

If the table is missing, apply the committed migrations and rerun the proof:

```bash
docker compose exec -T platform-api npm run db:migrate
```

## Failure Semantics

- Redis outage: readiness goes down, existing sockets may remain connected, and subscription mutation commands return `REALTIME_UNAVAILABLE`.
- NATS outage: readiness goes down and cross-node event delivery is degraded until reconnect succeeds.
- Platform API outage: handshake and subscription authorization fail semantically; the gateway does not invent authority from client input.
- Slow consumer: the overloaded connection is closed to preserve bounded fanout behavior.

## Recovery Steps

- After pulling schema changes, rerun `npm run db:migrate` before claiming the stack is ready for session or allocation proofs.
- If routed handshake fails with platform dependency symptoms, inspect `game-center-platform-api-1` first.
- If events are published but not delivered locally, inspect gateway local subscription indexing and Redis membership mutation before blaming NATS.