# Program Roadmap

This directory is the permanent source of truth for program sequencing, phase status, release gates, and explicitly deferred work.

## Navigation

- [Master Platform Roadmap](./master-platform-roadmap.md)
- [Game Production Roadmap](./game-production-roadmap.md)
- [Release Gates](./release-gates.md)
- [Deferred And Rabbit Holes](./deferred-and-rabbit-holes.md)

## How To Use This Roadmap

- Current platform phase status is recorded in [master-platform-roadmap.md](./master-platform-roadmap.md) in the phase index and per-phase sections.
- Phase transitions happen only when the current phase satisfies its exit criteria and the mandatory release gate in [release-gates.md](./release-gates.md).
- New discoveries must be classified as `BLOCKER`, `NEXT_PHASE`, `PLANNED_LATER`, or `NOT_PLANNED` before any implementation response is chosen.
- Significant roadmap changes must be explicit and must record what changed, why it changed, the dependency impact, the phase-order impact, and which future work moved.

## Source Of Truth Hierarchy

- Roadmap: what, when, dependencies, status.
- ADR: why an architectural decision was made.
- Architecture docs: how the current system is structured.
- Contract docs: exact behavior and interfaces.
- Runbooks: how to operate, deploy, and test the system.

No single document in this directory replaces ADRs, architecture docs, contract docs, or runbooks.