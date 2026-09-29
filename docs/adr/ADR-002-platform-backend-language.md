# ADR-002 Platform Backend Architecture And Language

Status: Accepted

## Context

Game Center requires multiple platform domains with shared conventions, moderate complexity, and strong developer consistency. Uncontrolled service-by-service language selection would create polyglot chaos, and immediate service-per-domain deployment would add premature operational complexity.

## Decision

Use TypeScript + NestJS as the default stack for platform business domains, implemented in Phase 1 as a modular monolith under `services/platform-api`.

The following domains start as modules inside one NestJS runtime:

- auth
- players
- catalog
- social
- lobby
- matchmaking
- sessions

## Alternatives Considered

- Express-only services
- Separate microservice per domain in Phase 1
- Go for all backend services
- Mixed language per domain from day one

## Consequences

- Existing Express prototype services are reference material only.
- Shared platform conventions become easier across validation, config, modules, testing, and extraction paths.
- Domains must still preserve strict boundaries, repository abstractions, and extraction readiness.
- Exceptions require explicit ADRs.