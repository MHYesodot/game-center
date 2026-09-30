# Game Center

Game Center is being reset into a platform-oriented architecture.

The current codebase contains a platform web prototype, gameplay prototypes, and a prototype lobby server. Those assets are not the final production architecture and must be interpreted through the architecture documents in `docs/`.

## Source Of Truth

Start here:

- `docs/architecture/system-overview.md`
- `docs/architecture/game-client-architecture.md`
- `docs/architecture/prototype-game-client-audit.md`
- `docs/architecture/current-state-audit.md`
- `docs/architecture/repository-migration-plan.md`
- `docs/architecture/technology-matrix.md`
- `docs/development/docker-dev-architecture.md`
- `docs/adr/`

## Current Prototype Components

- `apps/web` -> active platform web app
- `services/platform-api` -> active Phase 1 NestJS modular monolith
- `services/realtime-gateway` -> Go skeleton only
- `games/prototypes/board-arena` -> board prototype, reference only
- `games/prototypes/arcade-runner` -> arcade prototype, reference only
- `games/prototypes/flight-sim` -> 3D preview prototype, reference only, not a production simulation path
- `services/_deprecated/lobby-server` -> deprecated prototype, not part of the default platform runtime

## Developer Quick Start

```bash
npm ci
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis nats gateway web platform-api
npm run db:prepare
```

Open `http://localhost:8080` after the stack is up.

## Core Commands

```bash
npm run build
npm run lint
npm run validate
npm run test
npm run test:integration
npm run test:e2e
npm run db:generate
npm run db:status
npm run db:migrate
npm run db:seed
npm run db:prepare
npm run docker:down
```

Prototype inspection commands remain available but are not part of the default platform development flow.

Production game direction is fixed by architecture decisions rather than by the current prototypes:

- board titles -> web or Godot client depending on title, authoritative Go server
- arcade titles -> Phaser, PixiJS, or Godot
- high-end racing / flight / simulation -> Unreal Engine 5 + C++ / Blueprints + Unreal dedicated server