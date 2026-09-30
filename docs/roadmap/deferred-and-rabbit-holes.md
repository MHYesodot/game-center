# Deferred And Rabbit Holes

If work is listed here, an agent must not implement it merely because it appears useful while completing another phase.

Moving an item out of this document requires an explicit roadmap decision.

## Deferred / Rabbit-Hole List

- Kubernetes before P28.
- Agones before P28.
- Premature microservices.
- Advanced MMR before the baseline matchmaking and session flow proves insufficient.
- Recommendation engines before the core platform loop is production-complete.
- Economy before Inventory.
- Store before ledger design.
- Tournaments before Sessions and Authoritative Results are stable.
- Large admin UI before concrete operational requirements exist.
- Flight Simulator production before the platform SDK and runtime foundation exist.
- Prototype polishing as a substitute for production architecture.
- SDKs without real consumers.
- NATS events without real consumers.
- Workflow-engine abstractions without a concrete workflow problem.
- Distributed saga frameworks without proven orchestration pain.
- CQRS or Event Sourcing without proven need.
- Redis as durable truth.
- Generic repositories.
- Generic plugin systems without a concrete consumer.
- Premature multi-region infrastructure.
- Premature sharding.

## Governance Rule

Useful is not the same as approved.

- If an item appears here, it is not authorized implementation scope unless the roadmap is explicitly updated.
- Discoveries that relate to these topics must be recorded under `NEXT_PHASE`, `PLANNED_LATER`, or `NOT_PLANNED`, not silently implemented.
- The existence of an abstraction opportunity is not by itself evidence that the abstraction should be built now.