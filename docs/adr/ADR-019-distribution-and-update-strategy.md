# ADR-019 Distribution and Update Strategy

Status: Accepted

## Context

Game distribution differs significantly across web, desktop, and mobile. The platform cannot assume one runtime or one launch mechanism for every game.

## Decision

Treat distribution and launch as platform-aware concerns expressed through manifests and capability abstractions.

Rules:

- desktop may install, update, manage versions, and launch native executables
- mobile must respect App Store and Play Store constraints
- game manifests must declare platform availability and leave room for future distribution metadata

## Alternatives Considered

- assuming browser runtime for every game
- assuming mobile can install arbitrary executables
- hiding platform constraints behind vague launcher behavior

## Consequences

- manifest models include platform availability and future distribution metadata
- launcher and install workflows remain separate from generic web navigation flows
- desktop and mobile rollout strategies can diverge while preserving shared contracts