# ADR-011 Platform API ORM Selection

Status: Accepted

## Context

Phase 1 introduces a NestJS modular monolith with multiple domain modules that must preserve logical data ownership inside one PostgreSQL instance. The platform must use exactly one ORM / data access stack.

## Decision

Use Drizzle ORM for the Platform API.

## Comparison Summary

### Prisma

- strong developer experience
- mature migration tooling
- central schema model can become a coordination bottleneck across many domain modules

### Drizzle

- TypeScript-first with explicit SQL-oriented schemas
- fits modular domain boundaries well
- lower abstraction overhead
- easier to keep repository-level control close to domain modules

### TypeORM

- familiar in NestJS ecosystems
- decorator-heavy active-record style can blur domain and persistence concerns
- less desirable for extraction-oriented domain boundaries

## Why Drizzle

Drizzle best matches the current requirements:

- modular monolith with strong domain boundaries
- repository abstraction over one PostgreSQL instance
- explicit control over schemas and queries
- future extraction path without deep ORM coupling

## Alternatives Considered

- Prisma
- TypeORM
- raw SQL with no ORM

## Consequences

- Platform API will standardize on Drizzle when persistence implementation is added.
- No second ORM may be introduced into the Platform API without a new ADR.
- Domain modules must still access storage through repositories, not through direct ORM coupling in domain code.