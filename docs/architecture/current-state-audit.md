# Current-State Audit

## Scope

Audit date: 2026-09-29

This document records the repository state that existed before the architecture reset. It remains as a historical baseline rather than the current runtime layout.

## Current Repository Inventory

```text
game-center/
├── apps/
│   └── web/
├── games/
│   ├── production/
│   └── prototypes/
│       ├── arcade-runner/
│       ├── board-arena/
│       └── flight-sim/
├── packages/
│   ├── config/
│   ├── contracts/
│   ├── observability/
│   └── platform-sdk-ts/
├── services/
│   ├── _deprecated/
│   │   └── lobby-server/
│   ├── platform-api/
│   └── realtime-gateway/
├── .vscode/
├── docs/
├── docker-compose.yml
├── docker-compose.dev.yml
├── package.json
├── package-lock.json
└── README.md
```

Historical prototype paths referenced below describe the baseline that motivated the reset and migration plan.

## Implemented Components

| Component | Path | Current Responsibility | Language / Runtime | Status |
| --- | --- | --- | --- | --- |
| Main portal prototype | `apps/portal` | Game discovery, category browsing, per-game lobby UI | React + TypeScript + Vite | `KEEP`, `REFACTOR`, `MOVE` |
| Board game prototype | `apps/board-arena` | Local browser board experience for Signal Grid | TypeScript + Vite + DOM | `PROTOTYPE ONLY` |
| Arcade prototype | `apps/arcade-runner` | Local canvas runner prototype | TypeScript + Vite + Canvas 2D | `PROTOTYPE ONLY` |
| Simulation prototype | `apps/flight-sim` | Browser 3D mission-bay preview | TypeScript + Three.js + Vite | `PROTOTYPE ONLY` |
| Lobby server prototype | `services/lobby-server` | Catalog, lobby CRUD, readiness, WebSocket updates, board game rules | TypeScript + Express + ws | `REPLACE` |
| Root workspace config | `package.json` | npm workspaces and dev scripts | npm workspaces | `KEEP`, `EXPAND` |
| Root README | `README.md` | Prototype-oriented project description | Markdown | `REPLACE` |

## Technology Inventory

| Area | Current Choice | Notes |
| --- | --- | --- |
| Platform web | React + TypeScript + Vite | Aligned with target direction, but missing TanStack Query and app naming conventions |
| Platform business backend | Express + ws | Violates target default of NestJS for platform business services |
| Realtime infrastructure | Embedded ws inside lobby service | Violates separation between business services and connection-heavy gateway layer |
| Board gameplay server | Embedded in lobby service | Strong architecture violation; game rules live inside platform service |
| Arcade engine | Custom canvas loop | Acceptable only as prototype; final engine choice must be explicit per game |
| 3D / simulation | Three.js browser preview | Acceptable only as preview/reference, not default full-scale simulation architecture |
| Database | None | Missing source-of-truth persistence |
| Cache / ephemeral state | None | Missing Redis |
| Messaging | None | Missing event bus and bounded contexts |
| Object storage | None | Missing MinIO/S3-compatible foundation |
| Observability | None | Missing OpenTelemetry, logs, metrics, tracing |
| Containers | None | Missing Docker-first local dev environment |

## Current Dependencies by Component

| Component | Dependencies of Note |
| --- | --- |
| `apps/portal` | `react`, `react-dom`, `react-router-dom` |
| `apps/board-arena` | Vite + TypeScript only |
| `apps/arcade-runner` | Vite + TypeScript only |
| `apps/flight-sim` | `three`, Vite, TypeScript |
| `services/lobby-server` | `express`, `ws`, `cors`, `tsx` |

## Architectural Violations

### 1. Platform and game responsibilities are mixed

The current lobby service contains platform responsibilities and game-specific authoritative rules in the same process.

Evidence:

- `services/lobby-server/src/server.ts` contains lobby orchestration and board win-detection logic.
- `POST /api/lobbies/:id/board/move` is game-specific and does not belong in a platform lobby service.

Impact:

- Prevents platform neutrality.
- Creates `if game === ...` style drift inside core services.
- Blocks addition of heterogeneous game runtimes.

### 2. Platform backend stack does not match the required default

The current platform backend prototype uses Express instead of NestJS.

Impact:

- Diverges from the required TypeScript + NestJS default for business services.
- Makes cross-service consistency harder as the platform grows.

### 3. Realtime and business concerns are collapsed

WebSocket handling is embedded directly inside the lobby service instead of being isolated behind a realtime gateway.

Impact:

- Weakens scalability boundaries.
- Couples transport decisions to business logic.

### 4. No versioned contracts or manifests

There is no `packages/contracts`, no versioned API contract set, and no standard game manifest model.

Impact:

- No stable integration boundary between platform and game products.
- No safe way to support polyglot dedicated game servers.

### 5. No platform infrastructure foundations

The repository currently lacks:

- PostgreSQL
- Redis
- NATS JetStream
- MinIO
- OpenTelemetry
- Prometheus / Grafana / Loki / Tempo
- Docker Compose profiles
- Gateway entry point

Impact:

- Local development does not reflect target operating model.
- Future services would accumulate ad hoc wiring.

### 6. Prototype clients are in production-facing positions

The current top-level `apps/*` layout places prototype game implementations beside the platform web app without a clear `games/` boundary.

Impact:

- Makes game products look like platform apps.
- Encourages leakage of prototype assumptions into the platform core.

## Component Classification

| Component | Classification | Rationale |
| --- | --- | --- |
| `apps/portal` | `KEEP` + `MOVE` + `REFACTOR` | Correct platform-web direction, but should become `apps/web` and consume contracts rather than local hardcoded catalog state |
| `services/lobby-server` | `REPLACE` | Correct domain area but wrong framework and wrong boundary; game logic must be removed from platform service |
| `apps/board-arena` | `PROTOTYPE ONLY` | Useful UX/interaction reference only; final board product requires dedicated `games/board/...` structure and authoritative Go server |
| `apps/arcade-runner` | `PROTOTYPE ONLY` | Useful pacing reference only; production arcade direction is Phaser, PixiJS, or Godot |
| `apps/flight-sim` | `PROTOTYPE ONLY` | Keep as browser preview reference only; production simulation direction is Unreal Engine 5 |
| Root workspace | `KEEP` + `EXPAND` | Monorepo direction is correct, but structure must change substantially |

## Immediate Gaps Against Target Architecture

1. No separation between platform services and game servers.
2. No Docker-first development environment.
3. No gateway entry point.
4. No persistent data layer.
5. No event bus.
6. No health/readiness standard across services.
7. No contracts / SDK source of truth.
8. No ADR set.
9. No repository-level architecture source of truth.

## Audit Conclusion

The current repository is a prototype monorepo with promising UI and gameplay references, but it is not yet a valid platform architecture. The main portal can be evolved into the platform web app. The current lobby server and game prototypes should not be treated as target architecture.