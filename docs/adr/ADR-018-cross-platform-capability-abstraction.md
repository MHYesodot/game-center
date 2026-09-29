# ADR-018 Cross-platform Capability Abstraction

Status: Accepted

## Context

Web, desktop, and mobile expose different platform capabilities. Business flows need stable abstractions rather than direct environment-specific APIs leaking into shared code.

## Decision

Define platform capability abstractions for operations such as notifications, secure storage, deep links, and application lifecycle.

Examples:

- shared core capabilities: notifications, secureStorage, deepLinks, appLifecycle
- desktop-specialized capabilities: gameInstall, gameLaunch, fileSystem, autoUpdate
- mobile-specialized capabilities: pushNotifications, backgroundLifecycle, storeDeepLinks

## Alternatives Considered

- direct browser, Tauri, or React Native API calls throughout application code
- one universal runtime assumption for all clients

## Consequences

- shared logic can depend on interfaces rather than environment APIs
- platform adapters can evolve independently
- tests can mock capability interfaces cleanly