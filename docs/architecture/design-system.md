# Design System Architecture

Status: Accepted source of truth for design tokens and theming foundations

## Source Of Truth

`packages/design-tokens` is the mandatory source of truth for cross-platform design tokens.

## Required Token Families

- colors
- semantic colors
- spacing
- typography
- font sizes
- font weights
- line heights
- radii
- shadows
- elevation
- motion
- durations
- breakpoints
- z-index
- opacity
- component sizing

## Semantic Layer

Components must consume semantic tokens such as:

- `surface.primary`
- `surface.secondary`
- `surface.elevated`
- `text.primary`
- `text.secondary`
- `action.primary`
- `border.subtle`
- `status.success`

They must not depend directly on palette values unless the component is itself part of token definition work.

## Themes

Architecture must support at least:

- `light`
- `dark`

Themeing is a semantic-token mapping, not a pile of component overrides.

## Current Web Audit

Raw values identified in the web app before this slice:

- hex colors in `index.css`
- rgba surface and border values in `App.css`
- local radii values such as `16px`, `24px`, `32px`, `999px`
- local shadow values
- local display/body font references

This slice migrates the current portal toward semantic CSS variables without redesigning the UI.

## Cross-platform Outputs

Future outputs can include:

- CSS variables
- TypeScript theme objects
- React Native theme exports
- JSON exports for external consumers

But one token source remains authoritative.