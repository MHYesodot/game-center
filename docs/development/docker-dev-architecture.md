# Docker DEV Architecture

## Goal

Local development must be Docker-first. Developers should need as little host setup as possible beyond Docker Desktop, Git, and an IDE.

## External Entry Point

All local entry should flow through one gateway:

- `http://localhost:8080`

Examples:

- `/` -> platform web
- `/api/*` -> platform-api
- `/ws/*` -> realtime entry in a later slice

## Networks

### `edge`

- used by the gateway and externally reachable entry points

### `platform`

- internal platform service-to-service networking

### `observability`

- telemetry stack traffic

## Service Discovery Rules

Containers must communicate via Docker DNS names only.

Examples:

- `postgres:5432`
- `redis:6379`
- `nats:4222`
- `platform-api:3000`

Forbidden inside containers:

- `localhost`
- `127.0.0.1`

## Compose Profiles

The workspace uses a layered compose model:

- `docker-compose.yml` holds the production-like baseline topology
- `docker-compose.dev.yml` overrides only the services that need mounted source and watchers for local development

Initial profile plan:

- `observability`
- `board-game`
- `simulation`
- `full`

### Initial practical usage

- default `docker compose up` starts gateway, web, platform-api, postgres, redis, nats, minio
- `observability` adds otel collector, prometheus, grafana, loki, tempo
- gameplay-related profiles remain optional and off by default

## Hot Reload Model

### Web app

- source is bind-mounted
- Vite watcher runs inside container
- dependencies stored in container volumes

### Node / NestJS services

- source is bind-mounted
- TypeScript compilation runs in watch mode inside the container
- runtime restart is handled separately from compilation so Nest boot uses compiled output
- dependencies stored in container volumes

Current platform API DEV loop:

- initial `tsc` build for startup validation
- `tsc --watch` with polling for Docker Desktop bind-mount reliability on Windows
- `nodemon` watching compiled `dist/**/*.js` for runtime restarts

Gateway routing notes:

- Traefik uses a static file provider for stability on this Windows Docker Desktop setup
- DEV mode mounts a dedicated dynamic config file so `/` targets the Vite server on `web:5173`
- rebuilding a routed application container may require a gateway restart so Traefik re-resolves the upstream container address

### Future Go services

- source bind-mounted
- Go watcher inside container

## Persistent Volumes

Named volumes should exist for:

- PostgreSQL data
- Redis data
- MinIO data
- service-level `node_modules` volumes for watch-mode stability

## Health Check Rules

Every service must expose:

- `/health/live`
- `/health/ready`

Compose should use health checks and condition-based dependencies rather than startup ordering assumptions.

## Startup Flow

```text
gateway
  waits for web and platform-api to become ready

platform-api
  waits for postgres / redis / nats readiness as required

web
  can start independently, but API functionality depends on gateway-routed services
```

## Initial Container Set

### Implemented now

- gateway
- web
- platform-api
- postgres
- redis
- nats
- minio

### Planned later, not yet implemented

- realtime-gateway
- dedicated board game servers
- dedicated arcade game servers
- dedicated simulation servers

## Development Constraints

1. Containers should support hot reload without rebuilding images for every code change.
2. Production-compatible Dockerfiles are preferred, but DEV runtime should use mounted source and long-running watchers.
3. Platform API design must not expose Docker-specific assumptions directly.
4. Translation validation and architecture validation commands must run cleanly inside the standard workspace toolchain.
5. Desktop and mobile architectures are defined before implementation; no empty runtime shells are required in this slice.