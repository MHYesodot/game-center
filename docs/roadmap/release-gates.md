# Release Gates

This document defines the mandatory completion gate for every roadmap phase.

No platform phase may move to `DONE` unless every applicable item below is satisfied or an explicit exception is recorded as remaining risk.

## Universal Phase Completion Gate

- Architecture and contracts locked for the phase scope.
- Implementation complete for the approved phase scope.
- Unit tests pass.
- Integration tests pass.
- Concurrency or race tests pass where relevant.
- Failure and outage tests pass where relevant.
- Runtime smoke proof is completed where relevant.
- Documentation is updated.
- ADR is updated where applicable.
- Architecture validator is updated where applicable.
- No stale compatibility paths are introduced.
- Full repo gates are clean.
- No new warnings are introduced.
- Explicit remaining risks are listed.
- No unrelated scope is included.

## Phase Closure Rule

A phase cannot be marked `DONE` just because code exists. It must satisfy:

- the phase contract in the roadmap
- the release gate in this document
- any phase-specific runtime proof

If a phase is partially implemented but does not satisfy the gate, it remains `IN_PROGRESS`, `BLOCKED`, or `READY` depending on actual state.

## Universal Quality Commands

Current baseline commands:

```bash
npm run lint
npm run typecheck
npm run validate
npm run test
npm run test:integration
npm run test:integration:docker
npm run build
npm run test:e2e
npm run db:status
docker compose config
docker compose -f docker-compose.yml -f docker-compose.dev.yml config
```

## Integration Test Bootstrap Conditions

`npm run test:integration` is not self-bootstrapping. Run it in the expected dependency environment:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis nats
```

Required host-local environment:

```bash
POSTGRES_URL=postgresql://gamecenter:gamecenter@localhost:5432/gamecenter
REDIS_URL=redis://localhost:6379
```

Docker allocator phases also require:

```bash
docker build -t game-center/test-game-server:p03 -f infrastructure/docker/test-game-server/Dockerfile infrastructure/docker/test-game-server
```

Notes:

- The dev compose override publishes PostgreSQL on `localhost:5432`, Redis on `localhost:6379`, and NATS on `localhost:4222` for host-run validation.
- `npm run test:integration:docker` additionally requires a reachable Docker daemon and uses the explicit `docker` allocation provider.
- Environment bootstrap failures must not be misclassified as product regressions.
- A phase is not complete if it passes only under ad hoc local conditions that are not documented here.

## Runtime Proof Expectations

Phases that change runtime-critical behavior must include at least one direct executable proof at the nearest appropriate boundary, such as:

- process stays live during dependency outage
- command degrades to semantic `503` instead of hanging
- recovery succeeds without duplicate durable state
- concurrency protection prevents duplicate proposals or duplicate session creation

## Remaining Risk Policy

Every phase closure must state:

- known residual risks
- accepted deferrals
- follow-up work that belongs to the next approved phase rather than the current one