# Game Center

Game Center is being reset into a platform-oriented architecture.

The current codebase contains a platform web prototype, gameplay prototypes, and a prototype lobby server. Those assets are not the final production architecture and must be interpreted through the architecture documents in `docs/`.

## Source Of Truth

Start here:

- `docs/architecture/system-overview.md`
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
- `games/prototypes/flight-sim` -> 3D preview prototype, reference only
- `services/_deprecated/lobby-server` -> deprecated prototype, not part of the default platform runtime

## Current Build

```bash
npm run build
```

## Current Dev Commands

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run docker:up
npm run docker:down
npm run docker:logs
npm run docker:reset
```

Prototype inspection commands remain available but are not part of the default platform development flow.