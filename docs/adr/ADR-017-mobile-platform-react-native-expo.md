# ADR-017 Mobile Platform — React Native / Expo

Status: Accepted

## Context

Mobile Game Center must operate as a real native application on Android, iPhone, and iPad, not as a thin WebView wrapper.

## Decision

Use React Native + Expo + TypeScript for the future mobile client.

The future application path is `apps/mobile`.

Rules:

- mobile shares contracts, SDKs, translations, tokens, and platform-neutral logic where appropriate
- mobile does not assume DOM component reuse
- iPad is first-class and must support tablet-appropriate navigation and layouts

## Alternatives Considered

- WebView wrapper approach
- native iOS and Android apps with no shared TypeScript layer
- direct reuse of web DOM component packages

## Consequences

- mobile UI architecture remains separate from DOM UI
- mobile E2E tooling must be standardized later
- shared packages should remain platform-neutral wherever practical