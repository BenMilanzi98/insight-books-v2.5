# ADR-001: MRA EIS Bounded Context

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

**Status:** Accepted (conditional where noted)

## Context

Need isolation of MRA DTOs and compliance lifecycle from accounting.

## Decision

Introduce dedicated MraEis context that references but does not own Sale/Journal/Inventory.

## Alternatives considered

Embed EIS fields on Sale only — rejected (couples status, weak idempotency).

## Consequences

Clear ownership; more tables; adapters required.

## Implementation phases

4–5+

## Evidence

Phase 2 handover; Phase 1 contract pack

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
