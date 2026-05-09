# RUNTIME EventPublisher port replace EventEmitter in domain

Legacy `TASKS.md` still flagged direct `EventEmitter` inheritance in domain
classes as a dependency inversion violation.

Done when:
- domain classes publish through an explicit port instead of inheriting directly from `EventEmitter`
- concrete event publishing lives at an adapter boundary
- the cut does not blur domain events with transport or runtime wiring
