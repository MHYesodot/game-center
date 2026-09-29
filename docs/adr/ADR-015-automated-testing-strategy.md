# ADR-015 Automated Testing Strategy

Status: Accepted

## Context

Game Center spans platform API, web, future desktop, future mobile, and game integration contracts. Manual verification alone is insufficient.

## Decision

Automated testing is mandatory for done criteria.

Required layers:

- unit
- domain
- integration
- contract
- API
- E2E
- visual regression
- accessibility

CI quality gates must cover lint, typecheck, build, translation validation, tests, and required E2E suites.

## Alternatives Considered

- primarily manual QA
- unit-test-only strategy
- deferring E2E until after desktop/mobile arrive

## Consequences

- deterministic seed data and isolated test environments become foundational requirements
- web, desktop, and mobile each need platform-appropriate E2E tooling
- architecture docs and contracts become testable artifacts rather than prose only