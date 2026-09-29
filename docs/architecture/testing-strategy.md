# Testing Strategy

Status: Accepted source of truth for automated testing expectations

## Definition Of Done

A feature is not done until it has:

- implementation
- translations
- LTR verification
- RTL verification
- unit or domain tests
- integration tests where relevant
- E2E workflow coverage
- accessibility verification
- design-token compliance
- documentation and contracts where relevant

## Test Pyramid

- Unit tests: pure logic, formatting helpers, validators, mapping helpers
- Domain tests: lobby lifecycle, matchmaking lifecycle, session lifecycle, compatibility rules
- Integration tests: PostgreSQL, Redis, NATS, MinIO with isolated test infrastructure
- Contract tests: compatibility and shape validation across platform API, realtime gateway, games, and clients
- API tests: route-level behavior and error code expectations
- E2E tests: user workflows across clients
- Visual regression: shared UI and critical screens
- Accessibility: audits for navigation, focus, semantics, contrast, and reduced motion

## Platform Tooling Direction

- Web E2E: Playwright
- Desktop E2E: tool to be standardized via ADR for Tauri
- Mobile E2E: Maestro or Detox via ADR

## CI Matrix

Suites should be split into:

- PR suite
- main branch suite
- nightly full matrix
- release suite

## Required Matrix Direction

- Web / Chromium
- Web / Firefox
- Web / WebKit
- Desktop / Windows
- Desktop / macOS
- Mobile / Android
- Mobile / iOS
- Tablet / iPad layout

## Localization E2E

At least one LTR and one RTL locale must be in E2E coverage:

- English
- Hebrew

## Test Data Rule

All integration and E2E suites must use deterministic, resettable seed data.

## Test Isolation Rule

- never use production databases
- never use ad hoc shared DEV databases for integration or E2E
- always use isolated testing environments