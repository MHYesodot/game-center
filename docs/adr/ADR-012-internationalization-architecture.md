# ADR-012 Internationalization Architecture

Status: Accepted

## Context

Game Center must serve multiple clients and locales, including mandatory RTL support for Hebrew. Hard-coded UI text inside application components creates duplication, inconsistent translations, and architecture drift.

## Decision

Adopt a translation-file-only architecture with required locales `en` and `he` from the foundation phase onward.

Rules:

- no hard-coded user-facing strings inside UI components
- locale determines text direction
- formatting uses `Intl` or localization helpers
- backend APIs return stable error codes instead of translated UI text
- translation validation is mandatory in CI

## Alternatives Considered

- English-only first pass with later localization retrofit
- component-local text constants
- backend-provided translated messages

## Consequences

- all client surfaces must use the localization layer
- translation files are split by domain or feature
- RTL becomes a first-class architectural invariant rather than a later polish task