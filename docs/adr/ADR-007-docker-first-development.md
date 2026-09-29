# ADR-007 Docker-first Development

Status: Accepted

## Context

The platform will include multiple services, data stores, and observability dependencies. Running each dependency manually on host machines would create inconsistent development environments.

## Decision

Local development is Docker-first.

Developer prerequisites should be limited to:

- Docker Desktop
- Git
- IDE

Core runtime dependencies such as PostgreSQL, Redis, NATS, MinIO, and observability components must run in containers.

## Alternatives Considered

- Host-installed databases and brokers
- Manual service startup instructions as the default
- Kubernetes-first for local development

## Consequences

- Compose profiles become a first-class development tool.
- The repository keeps a production-like base compose file plus a DEV override for watched services.
- Service configuration must use Docker DNS names.
- Hot reload must work with bind mounts and in-container watchers.
- On this Windows Docker Desktop setup, Traefik uses a static file provider rather than Docker socket discovery.
- DEV web traffic targets the Vite server directly, while platform API DEV uses `tsc --watch` plus a separate runtime restarter.