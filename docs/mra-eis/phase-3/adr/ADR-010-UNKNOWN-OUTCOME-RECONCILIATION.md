# ADR-010: Unknown Outcome Reconciliation Before Retry

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

**Status:** Accepted (conditional where noted)

## Context

Phase 1 timeout research.

## Decision

Timeouts after dispatch enter UNKNOWN_OUTCOME and reconcile before resend; reuse fiscal identity.

## Alternatives considered

Blind retry — rejected.

## Consequences

Needs last-online matching quality.

## Implementation phases

15

## Evidence

Phase 1 TIMEOUT research

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
