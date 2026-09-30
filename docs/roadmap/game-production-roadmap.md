# Game Production Roadmap

This document defines the reusable gate model for every production game.

Current prototypes are references only. They are not automatically valid production foundations.

## Universal Game Gate Model

Every production game must pass these gates in order:

- `G0 Concept Lock`
- `G1 Architecture Lock`
- `G2 Core Mechanics`
- `G3 Vertical Slice`
- `G4 Multiplayer / Authority`
- `G5 Platform Integration`
- `G6 Content Complete`
- `G7 Alpha`
- `G8 Beta`
- `G9 Release Candidate`
- `G10 Production`

No game may skip `G1` and begin major implementation on an unapproved architecture.

## G0 Concept Lock

Must answer:

- genre
- core loop
- target audience
- session duration
- single-player or multiplayer
- target platforms
- monetization assumptions
- competitive or casual orientation
- authoritative requirements

## G1 Architecture Lock

Must decide:

- engine
- language
- client architecture
- server architecture
- network model
- authoritative ownership
- persistence shape
- replay strategy
- platform SDK integration shape
- build and deployment model

No major implementation before this gate.

## G2 Core Mechanics

- Core gameplay works locally.
- The game proves its primary loop.
- No platform polish is required yet.

## G3 Vertical Slice

One small but production-quality gameplay loop exists, including:

- visual target
- audio target
- input target
- performance target
- basic UX target

## G4 Multiplayer / Authority

If the game is multiplayer, it must prove:

- authoritative server behavior
- reconnect handling
- latency handling
- desync strategy
- result authority
- basic abuse protection

## G5 Platform Integration

Integrate the platform systems that apply to the game:

- Auth
- Lobby
- Matchmaking
- Session
- Allocator
- Platform SDK
- Result Pipeline

## G6 Content Complete

- All launch content exists.
- Production status cannot hide behind placeholder levels, placeholder progression, or placeholder assets.

## G7 Alpha

- Feature complete.
- Bugs are allowed.
- No major system is missing.

## G8 Beta

- Content locked.
- Focus moves to performance, security, compatibility, and operational readiness.

## G9 Release Candidate

- Only release-blocking fixes are allowed.
- Architecture, protocol, and content churn stop unless a release blocker requires change.

## G10 Production

- Release artifact signed where applicable.
- Tested, deployed, and operationally supported.
- Monitoring, rollback path, and support ownership are in place.

## Initial Production Game Portfolio

### Board Arena

Purpose:

- prove authoritative turn-based multiplayer

Current direction:

- likely authoritative server: Go
- final client engine: `DECISION REQUIRED DURING PHASE`

### Arcade Runner

Purpose:

- prove browser and mobile-friendly arcade distribution with fast gameplay

Candidate engines:

- Phaser
- PixiJS
- Godot

### Flight Simulator

Purpose:

- prove native high-end 3D and dedicated-server platform capability

Current direction:

- likely engine: Unreal Engine 5

## Production Game Definition Of Done

A game is not production-complete just because it launches.

At minimum it must have:

- production architecture
- no prototype-only runtime dependency
- platform SDK integration
- full gameplay loop
- authoritative model where required
- match and session integration
- reconnect handling
- results integration
- telemetry
- localization
- accessibility
- settings
- error handling
- performance targets met
- production assets
- tests
- deployment path
- operational monitoring
- release artifact