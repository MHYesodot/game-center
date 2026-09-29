# ADR-013 Design System & Token Architecture

Status: Accepted

## Context

The platform must support consistent theming and reusable visual language across web, desktop, and mobile without each feature inventing local styles.

## Decision

Use `packages/design-tokens` as the single source of truth for cross-platform design tokens.

Rules:

- semantic tokens are the component-facing API
- raw values belong in token definitions, not feature components
- themes are mappings of semantic tokens
- `light` and `dark` must be supported architecturally

## Alternatives Considered

- local CSS variables per feature
- direct raw color usage in components
- theme implementation through component overrides only

## Consequences

- shared visual primitives can evolve without touching every component
- web, desktop, and mobile can consume the same conceptual token source
- CI can enforce token usage over time