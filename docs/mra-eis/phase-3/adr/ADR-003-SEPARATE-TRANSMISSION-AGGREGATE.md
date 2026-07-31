# ADR-003: Separate Transmission Aggregate

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

**Status:** Accepted (conditional where noted)

## Context

Accounting vs compliance outcomes must diverge.

## Decision

EIS status lives on Transmission (+ receipt projection), not Sale.status.

## Alternatives considered

Overload Sale.status — rejected.

## Consequences

UI must show dual status.

## Implementation phases

5,13,14

## Evidence

Phase 2 FUTURE_TRANSMISSION_STATE

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
