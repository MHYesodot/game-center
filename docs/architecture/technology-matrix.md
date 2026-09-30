# Technology Matrix

## Platform Components

| Component | Responsibility | Language | Framework | Runtime | Containerized | Database | Communication | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `apps/web` | Main platform UX, lobby UX, discovery, profiles, leaderboards | TypeScript | React + Vite + React Router + TanStack Query | Browser | Yes | None directly | HTTP/WebSocket via gateway | Best fit for product-facing web platform |
| `apps/admin` | Administration and moderation tooling | TypeScript | React + Vite | Browser | Yes | None directly | HTTP via gateway | Consistent platform UI stack |
| `apps/launcher` | Download, update, launch workflows | TypeScript initially | TBD | Desktop / Web hybrid | Yes | None directly | HTTP via gateway | Separate launcher concerns from web app |
| `services/platform-api` | Platform HTTP API and domain orchestration inside one runtime | TypeScript | NestJS + Drizzle ORM | Node.js | Yes | PostgreSQL + Redis | HTTP + internal module calls + NATS integration events | Phase 1 modular monolith avoids premature microservices while preserving extraction-ready boundaries while keeping SQL ownership explicit |
| `realtime-gateway` | High-volume connection routing, presence fanout | Go | Native / chosen Go stack | Go runtime | Yes | Redis optional | WebSocket / NATS | Connection-heavy layer separated from business services |

## Platform API Modules

| Module | Responsibility | Storage Ownership | Internal Communication | External Communication | Reason |
| --- | --- | --- | --- | --- | --- |
| `auth` | Identity, JWT/OIDC, service auth | `auth.*` | Application interfaces and domain events | HTTP + integration events | Core platform identity boundary |
| `players` | Profiles and player metadata | `players.*` | Application interfaces and domain events | HTTP + integration events | Player boundary without separate process yet |
| `catalog` | Game catalog and manifest discovery | `catalog.*` persisted in PostgreSQL through Drizzle repositories | Application interfaces and domain events | HTTP `GET /api/games`, `GET /api/games/:slug` + integration events | Platform-owned discovery boundary with a persisted read model |
| `social` | Friends, parties, social graph metadata | `social.*` | Application interfaces and domain events | HTTP + integration events | Preserves extraction path |
| `lobby` | Lobby metadata and readiness | `lobby.*` | Application interfaces and domain events | HTTP + integration events | No game rules allowed |
| `matchmaking` | Queue orchestration | `matchmaking.*` | Application interfaces and domain events | HTTP + NATS | Uses Redis for ephemeral queues |
| `sessions` | Session metadata and game server allocation orchestration | `sessions.*` | Application interfaces and domain events | HTTP + NATS | Owns allocator abstraction and session lifecycle |

## Game Components

| Component | Responsibility | Language | Framework | Runtime | Containerized | Database | Communication | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Board game server | Authoritative turn rules, validation, state | Go | Native Go service | Go runtime | Yes | Game-owned storage as needed | Session contract + events | Go is default for turn-based authoritative servers |
| Board game client | Product-specific board UX | TypeScript or engine-specific | Web stack or Godot depending on title | Browser / native | Yes if web | None directly | Platform SDK + game server protocol | Board production direction is web or Godot, never platform-owned game logic |
| Arcade web client | Arcade gameplay loop | TypeScript | Phaser, PixiJS, or Godot by default | Browser | Yes | None directly | Platform SDK + game protocol | Single-file DOM/canvas implementations remain prototype-only unless an exception is documented |
| Arcade authoritative backend | Score validation or match authority if needed | Go or product-specific | Native service | Go runtime | Yes | Game-owned | Session contract + events | Depends on realtime / anti-cheat needs |
| High-end simulation client | Rendering, simulation UX | C++ / Blueprints | Unreal Engine 5 | Native | Separate delivery | Game-owned | Platform SDK + dedicated server protocol | Three.js is not a production simulation engine |
| Simulation dedicated server | Authoritative simulation state | C++ | Unreal dedicated server | Native | Yes | Game-owned | Session contract + events | Keeps gameplay and simulation authority inside the product |

## Shared Infrastructure

| Component | Responsibility | Language / Tech | Runtime | Containerized | Reason |
| --- | --- | --- | --- | --- | --- |
| PostgreSQL | System of record | PostgreSQL | Docker | Yes | Primary relational store |
| Redis | Cache, ephemeral state, coordination | Redis | Docker | Yes | Not a source of truth |
| NATS JetStream | Async event backbone | NATS | Docker | Yes | Low-coupling event integration |
| MinIO | Object storage in DEV | MinIO | Docker | Yes | S3-compatible local storage |
| Traefik | DEV edge / reverse proxy | Traefik | Docker | Yes | Single entry point for local development |
| Drizzle Kit | Migration generation for platform persistence | TypeScript tooling | Node.js | No | Single ORM and SQL migration toolchain for the platform API |
| OpenTelemetry Collector | Telemetry aggregation | OTel Collector | Docker | Yes | Unified telemetry pipeline |
| Prometheus | Metrics | Prometheus | Docker | Yes | Metrics storage |
| Grafana | Dashboards | Grafana | Docker | Yes | Observability UI |
| Loki | Logs | Loki | Docker | Yes | Centralized logs |
| Tempo | Traces | Tempo | Docker | Yes | Trace backend |