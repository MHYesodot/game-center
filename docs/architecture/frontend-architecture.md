# Frontend Architecture

Status: Accepted source of truth for platform client architecture

## Scope

This document defines mandatory frontend architecture rules for web, future desktop shell UI, future mobile UI, and shared frontend packages.

## Mandatory UI Structure

Preferred direction:

```text
apps/web/src/
├── app/
├── features/
│   ├── auth/
│   ├── catalog/
│   ├── lobby/
│   ├── matchmaking/
│   ├── profile/
│   └── social/
├── pages/
└── platform/
```

Current web implementation is still compact, but all future expansion must move toward feature-based organization rather than a flat component bucket.

Within a feature:

```text
feature/
├── components/
├── hooks/
├── services/
├── model/
├── translations/
└── tests/
```

## Shared Boundaries

- `packages/ui` is for truly generic UI only.
- feature-specific UI stays inside the owning feature.
- `apps/desktop` must never import directly from `apps/web`.
- cross-platform sharing should happen through packages such as `contracts`, `platform-sdk-ts`, `i18n`, `design-tokens`, `testing`, and future shared feature packages.

## Internationalization Invariant

- No user-facing text may be hard-coded in React components.
- Text direction derives from locale.
- User-facing formatting must use the localization layer or `Intl`.

## Design System Invariant

- No raw colors, spacing, shadows, radii, or ad hoc typography values in feature components when a token exists.
- semantic tokens are the component-facing source of truth.

## Current Web Audit

### User-facing strings migrated to translations

- portal header and navigation labels
- hero copy
- featured action copy
- metrics labels
- lobby not-found state
- breadcrumb labels
- lobby detail labels

### Remaining acceptable literals in web code

- route segments such as `/game/:slug`
- internal identifiers such as `signal-grid`
- CSS class names
- technical script names such as `npm run dev:prototype:board`

## Architecture Enforcement Direction

Required enforcement in CI:

- lint rule or custom check for hard-coded user-facing strings in JSX
- lint rule or custom check for app-to-app imports
- lint rule or custom check for raw design values outside token definitions