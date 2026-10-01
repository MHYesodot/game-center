# Docker DEV Game Allocator Runbook

## Prerequisites

- Docker Desktop or Docker Engine is running
- PostgreSQL, Redis, and NATS are available through the documented DEV compose stack
- host-local integration environment variables are set:
  - `POSTGRES_URL=postgresql://gamecenter:gamecenter@localhost:5432/gamecenter`
  - `REDIS_URL=redis://localhost:6379`

## Build The Test Image

```bash
npm run docker:build:test-game-server
```

## Run The Dedicated Docker Allocation Suite

```bash
npm run test:integration:docker
```

This suite proves:

- real container creation and readiness
- connection-descriptor reachability
- same-session concurrency convergence on one managed container
- restart recovery without duplicate containers
- missing-image failure semantics
- health-timeout failure semantics
- orphan cleanup safety

## Manual Smoke Environment

Set the allocator provider explicitly before starting the API:

```bash
ALLOCATION_PROVIDER=docker
DOCKER_ALLOCATOR_PUBLIC_HOST=127.0.0.1
GAME_SERVER_DOCKER_NETWORK=game-center-game-servers
```

Optional tuning inputs:

- `DOCKER_ALLOCATOR_INTERNAL_PORT`
- `DOCKER_ALLOCATOR_HEALTH_TIMEOUT_MS`
- `DOCKER_ALLOCATOR_HEALTH_POLL_INTERVAL_MS`
- `DOCKER_ALLOCATOR_STOP_TIMEOUT_SECONDS`
- `DOCKER_ALLOCATOR_ORPHAN_MIN_AGE_SECONDS`
- `DOCKER_ALLOCATOR_MEMORY_BYTES`
- `DOCKER_ALLOCATOR_NANO_CPUS`
- `DOCKER_ALLOCATOR_PIDS_LIMIT`

## Orphan Cleanup

Dry run:

```bash
npm --workspace @game-center/platform-api run tsx src/modules/allocations/infrastructure/scripts/cleanup-orphaned-docker-containers.ts --dry-run
```

Live cleanup:

```bash
npm --workspace @game-center/platform-api run tsx src/modules/allocations/infrastructure/scripts/cleanup-orphaned-docker-containers.ts
```

## Expected Failure Meanings

- Docker daemon unavailable: provider readiness fails and allocation commands degrade semantically
- missing image: session creation fails without a leaked ready allocation
- health timeout: failed container is removed and the durable allocation converges to timeout failure