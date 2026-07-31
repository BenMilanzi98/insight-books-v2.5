# ADR-007: Database Idempotency

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

**Status:** Accepted (conditional where noted)

## Context

POS lacks server idempotency today.

## Decision

Unique constraints on snapshot/transmission/fiscalNumber/attempts; app checks insufficient.

## Alternatives considered

Redis-only — rejected as sole control.

## Consequences

Requires schema.

## Implementation phases

5,11,12

## Evidence

Phase 2 IDEMPOTENCY_AUDIT

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
