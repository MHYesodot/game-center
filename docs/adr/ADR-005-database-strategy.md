# ADR-005 Database Strategy

Status: Accepted

## Context

The platform needs durable data ownership and clear service boundaries. Local prototypes currently use in-memory state only.

## Decision

- PostgreSQL is the primary relational source of truth.
- Redis is used only for cache, ephemeral coordination, distributed locks, presence, and short-lived state.
- Every service owns its data boundary.

Logical separation is required even when services share the same PostgreSQL instance in DEV.

## Alternatives Considered

- Redis as a source of truth
- A single shared schema with direct cross-service reads
- Fully separate database instance per service from the first prototype phase

## Consequences

- Direct cross-service table access is forbidden.
- Migrations become service-owned concerns.
- DEV can stay practical while preserving boundaries.